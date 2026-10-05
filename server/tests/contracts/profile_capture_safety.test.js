'use strict';
const { createSampleFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const {getAuthToken} = require('../setup');
const kobo = require('../../services/koboService');

describe('Source capture cannot discard provenance or bypass current authority', () => {
    const lab = 'PROFILE-SAFETY-LAB', owner = 'PROFILE-SAFETY-OWNER', project = 'PROFILE-SAFETY-PROJECT', config = 'PROFILE-SAFETY-CONFIG';
    const mapping = {profileReference: {namespace: 'SAFETY-SURVEY', codePath: 'pit'}};
    let manager, receiver;
    beforeAll(async () => {
        for (const id of [lab, owner]) await prisma.lab.create({data: {id, code: id, name: id, country: 'GTM'}});
        await prisma.project.create({data: {id: project, code: project, name: project, labId: owner, assignedLabIds: JSON.stringify([lab]), status: 'ACTIVE'}});
        await prisma.koboConfig.create({data: {id: config, labId: lab, projectCode: project, formId: 'fixture', apiToken: 'fixture-token', fieldMapping: JSON.stringify(mapping)}});
        manager = await getAuthToken('LAB_MANAGER', lab, ['GTM'], [project]);
        receiver = await getAuthToken('SAMPLE_RECEPTION', lab, ['GTM'], [project]);
        await prisma.user.updateMany({where: {id: {in: [manager, receiver].map(token => jwt.decode(token).id)}}, data: {mustChangePassword: false}});
    });
    const update = body => request(app).put(`/api/projects/${project}/kobo-connections/${config}`).set('Authorization', `Bearer ${manager}`).send(body);
    test('legacy configuration saves preserve omitted mapping and explicit changes require the current revision', async () => {
        const omitted = await request(app).put(`/api/kobo/config/${lab}`).set('Authorization', `Bearer ${manager}`).send({projectCode: project, formId: 'fixture', apiToken: 'renewed-fixture-token'});
        expect(omitted.status).toBe(200);
        expect(JSON.parse((await prisma.koboConfig.findUnique({where: {id: config}})).fieldMapping)).toEqual(mapping);
        expect((await update({fieldMapping: mapping})).status).toBe(409);
        const current = await prisma.koboConfig.findUnique({where: {id: config}});
        expect((await update({fieldMapping: mapping, expectedRevision: current.updatedAt.toISOString()})).status).toBe(200);
        expect(await prisma.auditLog.count({where: {entityId: config, action: 'KOBO_CONNECTION_UPDATED'}})).toBe(2);
    });
    test('a removed servicing laboratory cannot update the retained connection', async () => {
        await prisma.project.update({where: {id: project}, data: {assignedLabIds: '[]'}});
        try {expect((await update({formId: 'not-allowed'})).status).toBe(403);} finally {await prisma.project.update({where: {id: project}, data: {assignedLabIds: JSON.stringify([lab])}});}
        expect((await prisma.koboConfig.findUnique({where: {id: config}})).formId).toBe('fixture');
    });
    test('rejecting a specimen preserves entered reference and raw provenance', async () => {
        await createSampleFixture(prisma, {data: {id: 'PROFILE-SAFETY-REJECT', originalId: 'PROFILE-SAFETY-REJECT', assignedLab: lab, projectId: project, projectCode: project, status: 'EXPECTED', metadata: JSON.stringify({sourceEvidence: 'fixture-retained'})}});
        const response = await request(app).post('/api/reception/intake').set('Authorization', `Bearer ${receiver}`).send({originalId: 'PROFILE-SAFETY-REJECT', decision: 'REJECTED', ncReason: 'Damaged synthetic container', profileReference: {code: 'ENTERED-PIT'}});
        expect(response.status).toBe(200);
        const row = await prisma.sample.findUnique({where: {id: 'PROFILE-SAFETY-REJECT'}});
        expect(JSON.parse(row.fieldMetadata).profileReference.code).toBe('ENTERED-PIT');
        expect(JSON.parse(row.metadata).sourceEvidence).toBe('fixture-retained');
    });
    test('a concurrent source edit is not overwritten by final intake', async () => {
        const id = 'PROFILE-SAFETY-CONCURRENT';
        await createSampleFixture(prisma, {data: {id, originalId: id, assignedLab: lab, projectId: project, projectCode: project, status: 'EXPECTED', fieldMetadata: '{}'}});
        // Allocation now occurs inside the intake transaction. Inject the
        // independent committed edit just before that transaction begins.
        const transact = prisma.$transaction.bind(prisma);
        const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (...args) => {
            await prisma.sample.update({where: {id}, data: {fieldMetadata: JSON.stringify({sourceEvidence: 'newer-revision'}), updatedAt: new Date(Date.now() + 1000)}});
            return transact(...args);
        });
        try {
            const checklist = {items: Object.fromEntries(['container', 'label', 'quantity', 'condition', 'coc'].map(key => [key, {status: 'PASS'}]))};
            const response = await request(app).post('/api/reception/intake').set('Authorization', `Bearer ${receiver}`).send({originalId: id, decision: 'ACCEPTED', receivedMass: 350, checklist, profileReference: {code: 'STALE-PIT'}});
            expect(response.status).toBe(409);
            const row = await prisma.sample.findUnique({where: {id}});
            expect(row.status).toBe('EXPECTED');
            expect(JSON.parse(row.fieldMetadata)).toEqual({sourceEvidence: 'newer-revision'});
        } finally {spy.mockRestore();}
    });
    test('force source refresh refuses malformed provenance without clearing it', async () => {
        const id = 'PROFILE-SAFETY-MALFORMED';
        await createSampleFixture(prisma, {data: {id, originalId: 'SAFETY-BAG', assignedLab: lab, projectId: project, projectCode: project, status: 'EXPECTED', metadata: '{broken', fieldMetadata: '{}'}});
        const spy = jest.spyOn(kobo, 'fetchSubmissions').mockResolvedValue([{_id: 1, _uuid: 'fixture', barcode_d1: 'SAFETY-BAG', pit: 'PIT', sampling_succeeded: 'yes'}]);
        try {
            expect((await request(app).post(`/api/kobo/sync-sample/${id}`).set('Authorization', `Bearer ${manager}`)).status).toBe(409);
            const row = await prisma.sample.findUnique({where: {id}});
            expect(row.metadata).toBe('{broken');
            expect(row.fieldMetadata).toBe('{}');
        } finally {spy.mockRestore();}
    });
    test('a mapping changed during normal sync cannot create identities under the old mapping or advance the checkpoint', async () => {
        const before = await prisma.koboConfig.findUnique({where: {id: config}});
        const spy = jest.spyOn(kobo, 'fetchSubmissions').mockImplementationOnce(async () => {
            await prisma.koboConfig.update({where: {id: config}, data: {fieldMapping: JSON.stringify({profileReference: {namespace: 'NEXT-SURVEY', codePath: 'pit'}})}});
            return [{_id: 5, _uuid: 'fixture-stale', barcode_d1: 'SAFETY-STALE-BAG', pit: 'PIT', sampling_succeeded: 'yes'}];
        });
        try {
            const response = await request(app).post(`/api/kobo/sync/${lab}?configId=${config}`).set('Authorization', `Bearer ${manager}`);
            expect(response.status).toBe(200);
            expect(response.body.newSamples).toBe(0);
            expect(await prisma.sample.count({where: {originalId: 'SAFETY-STALE-BAG'}})).toBe(0);
            expect((await prisma.koboConfig.findUnique({where: {id: config}})).lastSubmissionId).toBe(before.lastSubmissionId);
        } finally {spy.mockRestore();await prisma.koboConfig.update({where: {id: config}, data: {fieldMapping: before.fieldMapping}});}
    });
    test('force sync also rejects a changed mapping after its fetch', async () => {
        const id = 'PROFILE-SAFETY-FORCE-STALE';
        await createSampleFixture(prisma, {data: {id, originalId: 'SAFETY-FORCE-BAG', assignedLab: lab, projectId: project, projectCode: project, status: 'EXPECTED', fieldMetadata: '{}', metadata: '{}'}});
        const before = await prisma.koboConfig.findUnique({where: {id: config}});
        const spy = jest.spyOn(kobo, 'fetchSubmissions').mockImplementationOnce(async () => {
            await prisma.koboConfig.update({where: {id: config}, data: {fieldMapping: JSON.stringify({profileReference: {namespace: 'NEXT-SURVEY', codePath: 'pit'}})}});
            return [{_id: 6, _uuid: 'fixture-stale-force', barcode_d1: 'SAFETY-FORCE-BAG', pit: 'PIT', sampling_succeeded: 'yes'}];
        });
        try {
            expect((await request(app).post(`/api/kobo/sync-sample/${id}`).set('Authorization', `Bearer ${manager}`)).status).toBe(409);
            expect((await prisma.sample.findUnique({where: {id}})).fieldMetadata).toBe('{}');
        } finally {spy.mockRestore();await prisma.koboConfig.update({where: {id: config}, data: {fieldMapping: before.fieldMapping}});}
    });
    test('normal source replay also preserves malformed provenance and its checkpoint', async () => {
        const before = await prisma.koboConfig.findUnique({where: {id: config}});
        const spy = jest.spyOn(kobo, 'fetchSubmissions').mockResolvedValue([{_id: 7, _uuid: 'malformed-replay', barcode_d1: 'SAFETY-BAG', pit: 'PIT', sampling_succeeded: 'yes'}]);
        try {
            expect((await request(app).post(`/api/kobo/sync/${lab}?configId=${config}`).set('Authorization', `Bearer ${manager}`)).status).toBe(409);
            expect((await prisma.sample.findUnique({where: {id: 'PROFILE-SAFETY-MALFORMED'}})).metadata).toBe('{broken');
            expect((await prisma.koboConfig.findUnique({where: {id: config}})).lastSubmissionId).toBe(before.lastSubmissionId);
        } finally {spy.mockRestore();}
    });
    test('batch capture rechecks a durable hold added after preflight', async () => {
        const id = 'PROFILE-SAFETY-BATCH-HOLD';
        await createSampleFixture(prisma, {data: {id, originalId: id, assignedLab: lab, projectId: project, projectCode: project, status: 'EXPECTED', fieldMetadata: '{}', metadata: '{}'}});
        const transact = prisma.$transaction.bind(prisma);
        const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (...args) => {
            await prisma.sample.update({where: {id}, data: {metadata: JSON.stringify({provenanceHold: {status: 'AMBIGUOUS_PROVENANCE_HOLD', reason: 'New field evidence'}})}});
            return transact(...args);
        });
        try {
            const checklist = {items: Object.fromEntries(['container', 'label', 'quantity', 'condition', 'coc'].map(key => [key, {status: 'PASS'}]))};
            const response = await request(app).post('/api/reception/consignments').set('Authorization', `Bearer ${receiver}`).send({consignment: {projectId: project}, defaults: {receivedMass: 350, checklist}, samples: [{originalId: id}]});
            expect(response.status).toBe(422);
            expect(response.body.errors).toHaveLength(1);
            const row = await prisma.sample.findUnique({where: {id}});
            expect(row.status).toBe('EXPECTED');
            expect(JSON.parse(row.metadata).provenanceHold.status).toBe('AMBIGUOUS_PROVENANCE_HOLD');
            expect(row.labId).toBeNull();
        } finally {spy.mockRestore();}
    });
});
