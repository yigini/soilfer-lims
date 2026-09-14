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
});
