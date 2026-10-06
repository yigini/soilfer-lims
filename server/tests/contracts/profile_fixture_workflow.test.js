'use strict';
const mockConnections = [];
jest.mock('better-sqlite3', () => {
    const Database = jest.requireActual('better-sqlite3');
    return class TrackedFixtureDatabase extends Database {
        constructor(...args) {
            super(...args);
            mockConnections.push(this);
        }
    };
});
const request = require('supertest');
const jwt = require('jsonwebtoken');
const {beforeGuards} = require('../helpers/legacyWorkflowDatabase');
const originalDatabasePath = process.env.DATABASE_PATH;
const originalDatabaseUrl = process.env.DATABASE_URL;
let app, prisma, fixture, rehearsal;
const getAuthToken = (...args) => require('../helpers/workflowFixtures').createAuthTokenFixture(prisma, ...args);

describe('Guarded profile fixture through the laboratory workflow', () => {
    let manifest, reception, manager, tech, technician;
    const rawKey = 'slims_fixture_profile140_only';
    const call = (url, token, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);
    beforeAll(async () => {
        // Other contract suites can leave more than 1,000 synthetic specimens.
        // Keep the loader's populated-database refusal and give this workflow a
        // fresh owned schema with the real release guards, independent of order.
        rehearsal = beforeGuards({actor: 'system:fixture', installWorkflowStateGuards: true});
        require('../../scripts/install_result_attempt_links').installResultAttemptLinks({dbPath: rehearsal.file, apply: true});
        process.env.DATABASE_PATH = rehearsal.file;
        process.env.DATABASE_URL = `file:${rehearsal.file}`;
        jest.resetModules();
        prisma = require('../../prisma');
        app = require('../../app');
        fixture = require('../../scripts/profile_fixture');
        await require('../../seeds/units').seedUnits(prisma);
        await require('../../seeds/references').seedReferences(prisma);
        await require('../../seeds/catalogue').seedCatalogue({confirmMatches: true});
        expect(await prisma.sample.count()).toBe(0);
        process.env.LIMS_PROFILE_FIXTURE_ENV = fixture.MARKER;
        manifest = await fixture.loadFixture(prisma);
        reception = await getAuthToken('SAMPLE_RECEPTION', manifest.labId, ['GTM'], [manifest.projectId]);
        manager = await getAuthToken('LAB_MANAGER', manifest.labId, ['GTM'], [manifest.projectId]);
        tech = await getAuthToken('LAB_TECHNICIAN', manifest.labId, ['GTM'], [manifest.projectId]);
        technician = jwt.decode(tech).username;
        await prisma.user.updateMany({where: {id: {in: [reception, manager, tech].map(token => jwt.decode(token).id)}}, data: {mustChangePassword: false}});
        await prisma.analysis.upsert({where: {code: 'PH'}, update: {}, create: {code: 'PH', name: 'pH', units: 'pH_units', status: 'active'}});
        const key = await prisma.apiKey.create({data: {id: 'PROFILE-FIXTURE-140-KEY', name: 'Synthetic receiver', keyHash: require('crypto').createHash('sha256').update(rawKey).digest('hex'), keyPrefix: 'slims_fixture', connectionId: 'conn_profile_fixture140', role: 'NSIS_CONSUMER', labs: JSON.stringify([manifest.labId]), projects: JSON.stringify([manifest.projectId]), countries: JSON.stringify(['GTM']), capabilities: JSON.stringify(['SPATIAL', 'SNAPSHOT', 'RECEIPT'])}});
        const db = require('../../services/exchangeStateService').getDb();
        db.prepare("INSERT INTO _exchange_connections (id,name,capabilities,countries,projects,labs,auth_version,status,created_at,updated_at) VALUES (?,?,?,?,?,?,1,'ACTIVE',datetime('now'),datetime('now'))").run(key.connectionId,key.name,key.capabilities,key.countries,key.projects,key.labs);
        db.prepare("INSERT INTO _exchange_connection_keys (id,connection_id,api_key_id,key_status,created_at) VALUES (?,?,?,'ACTIVE',datetime('now'))").run('PROFILE-FIXTURE-140-LINK',key.connectionId,key.id);
    });
    afterAll(async () => {
        delete process.env.LIMS_PROFILE_FIXTURE_ENV;
        await prisma?.$disconnect();
        // app.db keeps a synchronous authentication connection. Close every
        // connection opened on this owned fixture before Windows file cleanup.
        for (const db of mockConnections) {
            if (db.open && rehearsal && require('path').resolve(db.name) === rehearsal.file) db.close();
        }
        process.env.DATABASE_PATH = originalDatabasePath;
        process.env.DATABASE_URL = originalDatabaseUrl;
        rehearsal?.close();
    });
    test('loader refuses production and ordinary databases and is idempotent', async () => {
        expect(() => fixture.assertFixtureEnvironment({...process.env, NODE_ENV: 'production'})).toThrow();
        expect(() => fixture.assertFixtureEnvironment({...process.env, DATABASE_PATH: require('path').resolve(__dirname, '../../prisma/dev.db')})).toThrow();
        expect((await fixture.loadFixture(prisma)).reused).toBe(true);
        expect(await prisma.sample.count({where: {id: {in: manifest.sampleIds}}})).toBe(5);
    });
    test('separate bags retain truthful references and depth intervals after real intake, bench, review and approval', async () => {
        const checklist = {items: Object.fromEntries(['container', 'label', 'quantity', 'condition', 'coc'].map(key => [key, {status: 'PASS', note: 'Synthetic test observation'}]))};
        for (const [index, id] of manifest.sampleIds.entries()) {
            const sample = await prisma.sample.findUnique({where: {id}});
            const intake = await call('/api/reception/intake', reception, {originalId: sample.originalId, projectId: manifest.projectId, decision: 'ACCEPTED', receivedMass: 350, checklist, requiredAnalyses: ['PH']});
            expect({status: intake.status, body: intake.body}).toMatchObject({status: 200, body: {success: true}});
            let items = await prisma.workItem.findMany({where: {sampleId: id}});
            expect(items.map(row => row.analysis).sort()).toEqual(['DRYING', 'PH', 'PREPARATION']);
            expect((await call('/api/work/assign', manager, {workItemIds: items.map(row => row.id), assignee: technician})).status).toBe(200);
            for (const analysis of ['DRYING', 'PREPARATION']) {
                const confirm = await call('/api/workbench/operations/confirm', tech, {workItemId: items.find(row => row.analysis === analysis).id, checklist: [true, true, true], idempotencyKey: `fixture-${id}-${analysis}`});
                expect({status: confirm.status, body: confirm.body}).toMatchObject({status: 200, body: {success: true}});
            }
            const analytic = await prisma.workItem.findFirst({where: {sampleId: id, analysis: 'PH'}});
            const completed = await call('/api/workbench/v2/completion/commit', tech, {entries: [{workItemId: analytic.id, value: String(6.4 + index / 10), version: analytic.version, basis: 'AIR_DRY'}]});
            expect({status: completed.status, body: completed.body}).toMatchObject({status: 200, body: {success: true, saved: 1}});
            const submit = await call('/api/workbench/v2/submissions/commit', tech, {sampleIds: [id], note: 'Synthetic fixture only'});
            expect({status: submit.status, body: submit.body}).toMatchObject({status: 200, body: {success: true}});
            const submission = await prisma.submission.findFirst({where: {sampleId: id}, orderBy: {createdAt: 'desc'}});
            const reviewed = await call(`/api/submissions/${submission.id}/review`, manager, {decisions: [{workItemId: analytic.id, decision: 'ACCEPT', reason: 'Synthetic reference case checked'}]});
            expect({status: reviewed.status, body: reviewed.body}).toMatchObject({status: 200});
            const approved = await call(`/api/samples/${id}/approve`, manager, {});
            expect({status: approved.status, body: approved.body}).toMatchObject({status: 200});
        }
        const exported = await request(app).get('/api/v2/data-exchange/samples').query({projectCode: manifest.projectId, labId: manifest.labId}).set('X-API-KEY', rawKey);
        expect(exported.status).toBe(200);
        expect(exported.body.data).toHaveLength(5);
        const pitRows = exported.body.data.filter(row => [manifest.sampleIds[0],manifest.sampleIds[1]].includes(row.specimenId));
        expect(new Set(pitRows.map(row => row.profile.key))).toEqual(new Set(['DEMO-SURVEY-2026:PIT-DEMO-01']));
        expect(new Set(exported.body.data.map(row => row.labSampleId)).size).toBe(5);
        expect(exported.body.data.find(row => row.specimenId === manifest.sampleIds[4]).profile).toEqual({code: null, key: null, namespace: null, relation: 'UNSPECIFIED'});
        expect(pitRows.map(row => ({topCm: row.sampling.depths.topCm, bottomCm: row.sampling.depths.bottomCm, unit: row.sampling.depths.unit})).sort((a, b) => a.topCm - b.topCm)).toEqual([{topCm: 0, bottomCm: 20, unit: 'cm'}, {topCm: 20, bottomCm: 50, unit: 'cm'}]);
        const decimal = await prisma.sample.findUnique({where: {id: manifest.sampleIds[2]}});
        expect(decimal.depthBottomCm).toBe(20.5);
        const other = JSON.parse((await prisma.sample.findUnique({where: {id: manifest.sampleIds[3]}})).fieldMetadata).profileReference;
        expect(other.namespace).toBe('DEMO-SURVEY-OTHER');
        expect(exported.body.data.find(row=>row.specimenId===manifest.sampleIds[2]).sampling.depths.bottomCm).toBe(20.5);
        expect(exported.body.data.find(row=>row.specimenId===manifest.sampleIds[3]).profile.key).toBe('DEMO-SURVEY-OTHER:PIT-DEMO-01');
    });
});
