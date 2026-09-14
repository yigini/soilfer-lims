'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('PM-14 Reception Admissions & Provenance-Based Draft Discard Contracts', () => {
    const SUFFIX = 'PM14-' + Date.now();
    let authReception;
    let authAdmin;
    const testLab = 'LAB-' + SUFFIX;
    const trackedSampleIds = new Set();
    const trackedProjectIds = new Set();

    beforeAll(async () => {
        // Setup lab
        await prisma.lab.create({
            data: { id: testLab, code: SUFFIX.slice(-4), name: 'Lab ' + SUFFIX, country: 'Guatemala', isActive: true }
        });

        // Setup tokens
        const tokenReception = await getAuthToken('SAMPLE_RECEPTION', testLab, ['GTM']);
        authReception = `Bearer ${tokenReception}`;

        const tokenAdmin = await getAuthToken('SUPER_ADMIN', testLab, ['GTM']);
        authAdmin = `Bearer ${tokenAdmin}`;

        // Ensure users don't have mustChangePassword flag
        await prisma.user.updateMany({
            where: { role: { in: ['SAMPLE_RECEPTION', 'SUPER_ADMIN'] } },
            data: { mustChangePassword: false }
        });
    });

    afterAll(async () => {
        // Clean up tracked records
        if (trackedSampleIds.size > 0) {
            await prisma.workItem.deleteMany({ where: { sampleId: { in: Array.from(trackedSampleIds) } } });
            await prisma.result.deleteMany({ where: { sampleId: { in: Array.from(trackedSampleIds) } } });
            await prisma.sample.deleteMany({ where: { id: { in: Array.from(trackedSampleIds) } } });
        }
        if (trackedProjectIds.size > 0) {
            await prisma.koboConfig.deleteMany({ where: { projectCode: { in: Array.from(trackedProjectIds) } } });
            await prisma.project.deleteMany({ where: { id: { in: Array.from(trackedProjectIds) } } });
        }
        await prisma.lab.deleteMany({ where: { id: testLab } });
    });

    it('blocks POST /api/reception/intake when project admissions are PAUSED', async () => {
        const prjId = 'PRJ-PAUSED-' + SUFFIX;
        trackedProjectIds.add(prjId);
        await prisma.project.create({
            data: {
                id: prjId,
                code: prjId,
                name: 'Paused Admissions Project',
                status: 'PAUSED',
                projectType: 'STANDARD',
                labId: testLab
            }
        });

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: 'SMP-INTAKE-PAUSED-' + SUFFIX,
                projectId: prjId,
                decision: 'DRAFT',
                isDraft: true
            });

        expect(res.status).toBe(422);
        expect(res.body.error).toBe('PROJECT_ADMISSIONS_PAUSED');
    });

    it('blocks POST /api/reception/intake on existing expected sample when project is CLOSED', async () => {
        const prjId = 'PRJ-CLOSED-' + SUFFIX;
        trackedProjectIds.add(prjId);
        await prisma.project.create({
            data: {
                id: prjId,
                code: prjId,
                name: 'Closed Admissions Project',
                status: 'CLOSED',
                projectType: 'STANDARD',
                labId: testLab
            }
        });

        const sampleId = 'SMP-EXP-CLOSED-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                projectId: prjId,
                projectCode: prjId,
                status: 'EXPECTED',
                assignedLab: testLab
            }
        });

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                decision: 'DRAFT',
                isDraft: true
            });

        expect(res.status).toBe(422);
        expect(res.body.error).toBe('PROJECT_ADMISSIONS_PAUSED');
    });

    it('blocks POST /api/reception/consignments when consignment targets a PAUSED project', async () => {
        const prjId = 'PRJ-CSG-PAUSED-' + SUFFIX;
        trackedProjectIds.add(prjId);
        await prisma.project.create({
            data: {
                id: prjId,
                code: prjId,
                name: 'Consignment Paused Project',
                status: 'PAUSED',
                projectType: 'STANDARD',
                labId: testLab
            }
        });

        const res = await request(app)
            .post('/api/reception/consignments')
            .set('Authorization', authReception)
            .send({
                consignment: { projectCode: prjId },
                samples: [{ originalId: 'SMP-CSG-PAUSED-' + SUFFIX }]
            });

        expect(res.status).toBe(422);
        expect(res.body.error).toBe('PROJECT_ADMISSIONS_PAUSED');
    });

    it('reverts pre-registered sample in STANDARD project back to EXPECTED on discard', async () => {
        const prjId = 'PRJ-ACTIVE-STD-' + SUFFIX;
        trackedProjectIds.add(prjId);
        await prisma.project.create({
            data: {
                id: prjId,
                code: prjId,
                name: 'Standard Active Project',
                status: 'ACTIVE',
                projectType: 'STANDARD', // Explicitly NOT KOBO_LINKED
                labId: testLab
            }
        });

        const sampleId = 'SMP-PREREG-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                projectId: prjId,
                projectCode: prjId,
                status: 'DRAFT',
                assignedLab: testLab,
                receptionData: JSON.stringify({ isWalkIn: false, checklist: { test: true } })
            }
        });

        const res = await request(app)
            .post('/api/reception/discard')
            .set('Authorization', authReception)
            .send({ id: sampleId });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const sampleInDb = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sampleInDb).not.toBeNull();
        expect(sampleInDb.status).toBe('EXPECTED');
    });

    it('hard deletes ad-hoc walk-in draft sample on discard', async () => {
        const sampleId = 'SMP-WALKIN-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                projectId: null,
                projectCode: null,
                status: 'DRAFT',
                assignedLab: testLab,
                receptionData: JSON.stringify({ isWalkIn: true })
            }
        });

        const res = await request(app)
            .post('/api/reception/discard')
            .set('Authorization', authReception)
            .send({ id: sampleId });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const sampleInDb = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sampleInDb).toBeNull();
    });

    it('does not alter Kobo lastSyncAt timestamp when updating project metadata or credentials', async () => {
        const prjId = 'PRJ-KOBO-EDIT-' + SUFFIX;
        trackedProjectIds.add(prjId);
        await prisma.project.create({
            data: {
                id: prjId,
                code: prjId,
                name: 'Kobo Project',
                status: 'ACTIVE',
                projectType: 'KOBO_LINKED',
                labId: testLab
            }
        });

        const originalSyncTimestamp = new Date('2025-06-15T12:00:00.000Z');
        await prisma.koboConfig.create({
            data: {
                id: 'kobo-cfg-' + SUFFIX,
                labId: testLab,
                projectCode: prjId,
                formId: 'form_123',
                apiToken: 'old_secret_token',
                koboServerUrl: 'https://kf.kobotoolbox.org',
                lastSyncAt: originalSyncTimestamp
            }
        });

        const res = await request(app)
            .put(`/api/projects/${prjId}`)
            .set('Authorization', authAdmin)
            .send({
                koboApiToken: 'new_rotated_secret_token'
            });

        expect(res.status).toBe(200);

        const configInDb = await prisma.koboConfig.findUnique({ where: { id: 'kobo-cfg-' + SUFFIX } });
        expect(configInDb).not.toBeNull();
        expect(configInDb.apiToken).toBe('new_rotated_secret_token');
        expect(new Date(configInDb.lastSyncAt).toISOString()).toBe(originalSyncTimestamp.toISOString());
    });

    it('blocks POST /api/reception/intake when request specifies active project but existing sample belongs to PAUSED project (I01)', async () => {
        const prjPaused = 'PRJ-PAUSED-I01-' + SUFFIX;
        const prjActive = 'PRJ-ACTIVE-I01-' + SUFFIX;
        trackedProjectIds.add(prjPaused);
        trackedProjectIds.add(prjActive);

        await prisma.project.create({
            data: { id: prjPaused, code: prjPaused, name: 'Paused P', status: 'PAUSED', projectType: 'OPEN_INTAKE', labId: testLab }
        });
        await prisma.project.create({
            data: { id: prjActive, code: prjActive, name: 'Active P', status: 'ACTIVE', projectType: 'OPEN_INTAKE', labId: testLab }
        });

        const sampleId = 'SMP-PRE-PAUSED-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                projectId: prjPaused,
                projectCode: prjPaused,
                status: 'EXPECTED',
                assignedLab: testLab
            }
        });

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                projectId: prjActive,
                decision: 'DRAFT',
                isDraft: true
            });

        expect(res.status).toBe(422);
        expect(res.body.error).toBe('PROJECT_ADMISSIONS_PAUSED');

        const sampleInDb = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sampleInDb.status).toBe('EXPECTED');
        expect(sampleInDb.projectId).toBe(prjPaused);
    });

    it('rejects cross-project reassignment via intake with 400 CROSS_PROJECT_CONFLICT', async () => {
        const prj1 = 'PRJ-ACT1-' + SUFFIX;
        const prj2 = 'PRJ-ACT2-' + SUFFIX;
        trackedProjectIds.add(prj1);
        trackedProjectIds.add(prj2);

        await prisma.project.create({
            data: { id: prj1, code: prj1, name: 'Act1', status: 'ACTIVE', projectType: 'OPEN_INTAKE', labId: testLab }
        });
        await prisma.project.create({
            data: { id: prj2, code: prj2, name: 'Act2', status: 'ACTIVE', projectType: 'OPEN_INTAKE', labId: testLab }
        });

        const sampleId = 'SMP-CROSS-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                projectId: prj1,
                projectCode: prj1,
                status: 'EXPECTED',
                assignedLab: testLab
            }
        });

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                projectId: prj2,
                decision: 'DRAFT',
                isDraft: true
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('CROSS_PROJECT_CONFLICT');
    });

    it('preserves pre-registered sample on discard even when client passed mutable isWalkIn: true (I02)', async () => {
        const prjId = 'PRJ-ACT-I02-' + SUFFIX;
        trackedProjectIds.add(prjId);
        await prisma.project.create({
            data: { id: prjId, code: prjId, name: 'Act I02', status: 'ACTIVE', projectType: 'OPEN_INTAKE', labId: testLab }
        });

        const sampleId = 'SMP-PRE-ACTIVE-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                projectId: prjId,
                projectCode: prjId,
                status: 'EXPECTED',
                assignedLab: testLab
            }
        });

        // Client saves draft with isWalkIn: true
        const intakeRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                projectId: prjId,
                decision: 'DRAFT',
                isDraft: true,
                isWalkIn: true
            });
        expect(intakeRes.status).toBe(200);

        // Reception discards draft
        const discardRes = await request(app)
            .post('/api/reception/discard')
            .set('Authorization', authReception)
            .send({ id: sampleId });

        expect(discardRes.status).toBe(200);
        expect(discardRes.body.success).toBe(true);

        // Sample MUST NOT be deleted; MUST revert to EXPECTED
        const sampleInDb = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sampleInDb).not.toBeNull();
        expect(sampleInDb.status).toBe('EXPECTED');
        expect(sampleInDb.projectId).toBe(prjId);
    });

    it('reverts pre-registered sample on DELETE /api/samples/:id even if marked isWalkIn: true', async () => {
        const prjId = 'PRJ-DEL-PRE-' + SUFFIX;
        trackedProjectIds.add(prjId);
        await prisma.project.create({
            data: { id: prjId, code: prjId, name: 'Delete Pre Project', status: 'ACTIVE', projectType: 'OPEN_INTAKE', labId: testLab }
        });

        const sampleId = 'SMP-DEL-PRE-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                projectId: prjId,
                projectCode: prjId,
                status: 'DRAFT',
                assignedLab: testLab,
                receptionData: JSON.stringify({ isWalkIn: true })
            }
        });

        const res = await request(app)
            .delete(`/api/samples/${sampleId}`)
            .set('Authorization', authAdmin);

        expect(res.status).toBe(200);
        expect(res.body.reverted).toBe(true);

        const sampleInDb = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sampleInDb).not.toBeNull();
        expect(sampleInDb.status).toBe('EXPECTED');
    });

    it('hard deletes unattached walk-in sample on DELETE /api/samples/:id', async () => {
        const sampleId = 'SMP-DEL-WALK-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                projectId: null,
                projectCode: null,
                status: 'DRAFT',
                assignedLab: testLab,
                receptionData: JSON.stringify({ isWalkIn: true })
            }
        });

        const res = await request(app)
            .delete(`/api/samples/${sampleId}`)
            .set('Authorization', authAdmin);

        expect(res.status).toBe(200);

        const sampleInDb = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sampleInDb).toBeNull();
    });

    it('reverts pre-registered and deletes walk-in in atomic POST /api/samples/batch-delete', async () => {
        const prjId = 'PRJ-BATCH-DEL-' + SUFFIX;
        trackedProjectIds.add(prjId);
        await prisma.project.create({
            data: { id: prjId, code: prjId, name: 'Batch Del Project', status: 'ACTIVE', projectType: 'OPEN_INTAKE', labId: testLab }
        });

        const preRegSampleId = 'SMP-BATCH-PRE-' + SUFFIX;
        const walkInSampleId = 'SMP-BATCH-WALK-' + SUFFIX;
        trackedSampleIds.add(preRegSampleId);
        trackedSampleIds.add(walkInSampleId);

        await prisma.sample.create({
            data: {
                id: preRegSampleId,
                originalId: preRegSampleId,
                projectId: prjId,
                projectCode: prjId,
                status: 'DRAFT',
                assignedLab: testLab,
                receptionData: JSON.stringify({ isWalkIn: true })
            }
        });
        await prisma.sample.create({
            data: {
                id: walkInSampleId,
                originalId: walkInSampleId,
                projectId: null,
                projectCode: null,
                status: 'DRAFT',
                assignedLab: testLab,
                receptionData: JSON.stringify({ isWalkIn: true })
            }
        });

        const res = await request(app)
            .post('/api/samples/batch-delete')
            .set('Authorization', authAdmin)
            .send({ ids: [preRegSampleId, walkInSampleId] });

        expect(res.status).toBe(200);
        expect(res.body.reverted).toBe(1);
        expect(res.body.deleted).toBe(1);

        const preInDb = await prisma.sample.findUnique({ where: { id: preRegSampleId } });
        expect(preInDb).not.toBeNull();
        expect(preInDb.status).toBe('EXPECTED');

        const walkInDb = await prisma.sample.findUnique({ where: { id: walkInSampleId } });
        expect(walkInDb).toBeNull();
    });

    it('retains desk walk-in origin after reopening and saving twice, and hard deletes on discard (I03)', async () => {
        const originalId = 'WALK-2SAVE-' + SUFFIX;

        // 1. Initial desk intake draft save
        const firstRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId,
                isWalkIn: true,
                isDraft: true,
                decision: 'DRAFT'
            });

        expect(firstRes.status).toBe(200);
        expect(firstRes.body.success).toBe(true);
        const sampleId = firstRes.body.id;
        trackedSampleIds.add(sampleId);

        // 2. Reopen and save draft a second time
        const secondRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId,
                isWalkIn: true,
                isDraft: true,
                decision: 'DRAFT'
            });

        expect(secondRes.status).toBe(200);
        expect(secondRes.body.success).toBe(true);

        // 3. Discard draft
        const discardRes = await request(app)
            .post('/api/reception/discard')
            .set('Authorization', authReception)
            .send({ id: sampleId });

        expect(discardRes.status).toBe(200);
        expect(discardRes.body.success).toBe(true);

        // 4. Sample must be completely deleted, leaving no phantom EXPECTED record
        const sampleInDb = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sampleInDb).toBeNull();
    });

    it('denies generic DELETE /api/samples/:id on a RELEASED sample even for SUPER_ADMIN (I04)', async () => {
        const prjId = 'PRJ-REL-I04-' + SUFFIX;
        trackedProjectIds.add(prjId);
        await prisma.project.create({
            data: { id: prjId, code: prjId, name: 'Released Project', status: 'ACTIVE', projectType: 'OPEN_INTAKE', labId: testLab }
        });

        const sampleId = 'SMP-REL-PROT-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        const approvalDate = new Date();
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                projectId: prjId,
                projectCode: prjId,
                status: 'RELEASED',
                assignedLab: testLab,
                approvedAt: approvalDate,
                approvedBy: 'admin'
            }
        });

        const res = await request(app)
            .delete(`/api/samples/${sampleId}`)
            .set('Authorization', authAdmin);

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('ILLEGAL_STATUS_TRANSITION');

        // Verify sample status and approvals remain completely untouched
        const sampleInDb = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sampleInDb).not.toBeNull();
        expect(sampleInDb.status).toBe('RELEASED');
        expect(sampleInDb.approvedAt).not.toBeNull();
        expect(sampleInDb.approvedBy).toBe('admin');
    });

    it('denies batch delete on RELEASED samples even for SUPER_ADMIN (I04-batch)', async () => {
        const prjId = 'PRJ-REL-BATCH-' + SUFFIX;
        trackedProjectIds.add(prjId);
        await prisma.project.create({
            data: { id: prjId, code: prjId, name: 'Released Batch Project', status: 'ACTIVE', projectType: 'OPEN_INTAKE', labId: testLab }
        });

        const sampleId = 'SMP-REL-BATCH-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                projectId: prjId,
                projectCode: prjId,
                status: 'RELEASED',
                assignedLab: testLab,
                approvedAt: new Date(),
                approvedBy: 'admin'
            }
        });

        const res = await request(app)
            .post('/api/samples/batch-delete')
            .set('Authorization', authAdmin)
            .send({ ids: [sampleId] });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('ILLEGAL_STATUS_TRANSITION');

        const sampleInDb = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sampleInDb).not.toBeNull();
        expect(sampleInDb.status).toBe('RELEASED');
    });

    it('denies reception discard on sample with existing analytical results', async () => {
        const sampleId = 'SMP-WITH-RES-' + SUFFIX;
        trackedSampleIds.add(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                status: 'DRAFT',
                assignedLab: testLab
            }
        });

        await prisma.result.create({
            data: {
                id: 'RES-' + SUFFIX,
                sampleId,
                param: 'pH',
                value: '6.5',
                unit: 'pH'
            }
        });

        const res = await request(app)
            .post('/api/reception/discard')
            .set('Authorization', authReception)
            .send({ id: sampleId });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('CANNOT_DELETE_SAMPLE_WITH_RESULTS');
    });
});

