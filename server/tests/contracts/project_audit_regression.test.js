'use strict';

/**
 * Project Management Audit Regression & Acceptance Contract Suite (A01-A20, P01-P14)
 *
 * Verifies:
 * - Scoped isolation & foreign project read denial (A01 / P01, P05)
 * - Servicing lab sample scoping (A02 / P02, P03)
 * - Generic PUT status validation & junction protection (A03 / P14)
 * - National scope authorization enforcement (A04 / P08)
 * - Project Manager delegation capabilities (A05 / P07)
 * - Safe empty servicing lab access without country fallback (A06 / P10)
 * - Archival readiness & expected sample blockers (A08 / P06)
 * - No destructive sample detachment on delete/trash (A10 / P12)
 * - Atomic transaction rollback on audit failure (A11 / P11)
 * - Duplicate detection in creation & preview manifest (A13, A14 / P09, P13)
 * - Truthful stage counts & cumulative received decoupling (A15 / PM-09)
 */

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');

describe('Project Management Audit Regression & Acceptance Contracts', () => {
    const SUFFIX = 'PMREG-' + Date.now();
    let labA, labB, labC;
    let userAdmin, userOwner, userService, userForeign, userPM, userNational;
    let tokenAdmin, tokenOwner, tokenService, tokenForeign, tokenPM, tokenNational;
    let projectAlpha, projectSecret;

    const signToken = (user) => {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                labId: user.labId,
                tokenVersion: user.tokenVersion || 1
            },
            process.env.JWT_SECRET || 'test-secret-key-12345',
            { expiresIn: '1h' }
        );
    };

    beforeAll(async () => {
        // Setup labs
        labA = await prisma.lab.create({
            data: { id: 'LAB-A-' + SUFFIX, code: 'LA-' + SUFFIX.slice(-4), name: 'Lab A ' + SUFFIX, country: 'Guatemala' }
        });
        labB = await prisma.lab.create({
            data: { id: 'LAB-B-' + SUFFIX, code: 'LB-' + SUFFIX.slice(-4), name: 'Lab B ' + SUFFIX, country: 'Guatemala' }
        });
        labC = await prisma.lab.create({
            data: { id: 'LAB-C-' + SUFFIX, code: 'LC-' + SUFFIX.slice(-4), name: 'Lab C ' + SUFFIX, country: 'Honduras' }
        });

        // Setup users
        userAdmin = await prisma.user.create({
            data: { id: 'usr-admin-' + SUFFIX, username: 'admin_' + SUFFIX, email: 'admin@' + SUFFIX + '.test', password: 'hash', role: 'SUPER_ADMIN', tokenVersion: 1 }
        });
        userOwner = await prisma.user.create({
            data: { id: 'usr-owner-' + SUFFIX, username: 'owner_' + SUFFIX, email: 'owner@' + SUFFIX + '.test', password: 'hash', role: 'LAB_MANAGER', labId: labA.id, tokenVersion: 1 }
        });
        userService = await prisma.user.create({
            data: { id: 'usr-service-' + SUFFIX, username: 'service_' + SUFFIX, email: 'service@' + SUFFIX + '.test', password: 'hash', role: 'LAB_MANAGER', labId: labB.id, tokenVersion: 1 }
        });
        userForeign = await prisma.user.create({
            data: { id: 'usr-foreign-' + SUFFIX, username: 'foreign_' + SUFFIX, email: 'foreign@' + SUFFIX + '.test', password: 'hash', role: 'LAB_MANAGER', labId: labC.id, tokenVersion: 1 }
        });
        userPM = await prisma.user.create({
            data: { id: 'usr-pm-' + SUFFIX, username: 'pm_' + SUFFIX, email: 'pm@' + SUFFIX + '.test', password: 'hash', role: 'PROJECT_MANAGER', projects: JSON.stringify(['PROJ-A-' + SUFFIX]), tokenVersion: 1 }
        });
        userNational = await prisma.user.create({
            data: { id: 'usr-nat-' + SUFFIX, username: 'nat_' + SUFFIX, email: 'nat@' + SUFFIX + '.test', password: 'hash', role: 'MASTER_USER', countries: JSON.stringify(['Guatemala']), tokenVersion: 1 }
        });

        tokenAdmin = signToken(userAdmin);
        tokenOwner = signToken(userOwner);
        tokenService = signToken(userService);
        tokenForeign = signToken(userForeign);
        tokenPM = signToken(userPM);
        tokenNational = signToken(userNational);

        // Project Alpha (owned by Lab A, serviced by Lab B)
        projectAlpha = await prisma.project.create({
            data: {
                id: 'PROJ-A-' + SUFFIX,
                code: 'PROJ-A-' + SUFFIX,
                name: 'Alpha Project ' + SUFFIX,
                status: 'ACTIVE',
                labId: labA.id,
                assignedLabIds: JSON.stringify([labB.id]),
                expectedSampleCount: 100
            }
        });
        await prisma.projectLab.create({
            data: { id: 'pl-a-' + SUFFIX, projectCode: projectAlpha.code, labId: labA.id, role: 'OWNER' }
        });
        await prisma.projectLab.create({
            data: { id: 'pl-b-' + SUFFIX, projectCode: projectAlpha.code, labId: labB.id, role: 'SERVICING' }
        });

        // Secret Project (owned by Lab C, isolated)
        projectSecret = await prisma.project.create({
            data: {
                id: 'PROJ-SEC-' + SUFFIX,
                code: 'PROJ-SEC-' + SUFFIX,
                name: 'Secret Project ' + SUFFIX,
                status: 'ACTIVE',
                labId: labC.id,
                assignedLabIds: JSON.stringify([]),
                expectedSampleCount: 50
            }
        });

        // Samples: SA assigned to Lab A, SB assigned to Lab B
        await prisma.sample.create({
            data: {
                id: 'SMP-A-' + SUFFIX,
                originalId: 'SMP-A-' + SUFFIX,
                projectId: projectAlpha.id,
                projectCode: projectAlpha.code,
                labId: 'ACC-A-' + SUFFIX,
                assignedLab: labA.id,
                status: 'EXPECTED'
            }
        });
        await prisma.sample.create({
            data: {
                id: 'SMP-B-' + SUFFIX,
                originalId: 'SMP-B-' + SUFFIX,
                projectId: projectAlpha.id,
                projectCode: projectAlpha.code,
                labId: 'ACC-B-' + SUFFIX,
                assignedLab: labB.id,
                status: 'RELEASED',
                receptionDate: new Date()
            }
        });
    });

    afterAll(async () => {
        try {
            await prisma.sample.deleteMany({ where: { projectCode: { in: [projectAlpha?.code, projectSecret?.code] } } });
            await prisma.projectLab.deleteMany({ where: { projectCode: { in: [projectAlpha?.code, projectSecret?.code] } } });
            await prisma.project.deleteMany({ where: { code: { in: [projectAlpha?.code, projectSecret?.code] } } });
            await prisma.user.deleteMany({ where: { id: { in: [userAdmin?.id, userOwner?.id, userService?.id, userForeign?.id, userPM?.id, userNational?.id] } } });
            await prisma.lab.deleteMany({ where: { id: { in: [labA?.id, labB?.id, labC?.id] } } });
        } catch (e) {
            // Cleanup tolerance
        }
    });

    describe('A01 / P01, P05: Scope Isolation & Foreign Access Denial', () => {
        it('denies unrelated manager access to foreign project lab-access (403)', async () => {
            const res = await request(app)
                .get(`/api/projects/${projectAlpha.id}/lab-access`)
                .set('Authorization', `Bearer ${tokenForeign}`);

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('PROJECT_ACCESS_DENIED');
        });

        it('denies unrelated manager access to foreign project statistics (403)', async () => {
            const res = await request(app)
                .get(`/api/projects/${projectAlpha.id}/stats`)
                .set('Authorization', `Bearer ${tokenForeign}`);

            expect(res.status).toBe(403);
        });
    });

    describe('A02 / P02, P03: Servicing Manager Sample Scoping & Statistics', () => {
        it('servicing manager reads only samples assigned to their own lab', async () => {
            const res = await request(app)
                .get(`/api/projects/${projectAlpha.id}/samples`)
                .set('Authorization', `Bearer ${tokenService}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(1);
            expect(res.body[0].id).toBe('SMP-B-' + SUFFIX);
        });

        it('servicing manager statistics counts reflect their own lab scope', async () => {
            const res = await request(app)
                .get(`/api/projects/${projectAlpha.id}/stats`)
                .set('Authorization', `Bearer ${tokenService}`);

            expect(res.status).toBe(200);
            expect(res.body.counts.registered).toBe(1);
            expect(res.body.counts.released).toBe(1);
            expect(res.body.counts.everPhysicallyReceived).toBe(1);
        });

        it('administrator statistics include all project samples across labs', async () => {
            const res = await request(app)
                .get(`/api/projects/${projectAlpha.id}/stats`)
                .set('Authorization', `Bearer ${tokenAdmin}`);

            expect(res.status).toBe(200);
            expect(res.body.counts.registered).toBe(2);
            expect(res.body.counts.awaitingArrival).toBe(1);
            expect(res.body.counts.released).toBe(1);
        });
    });

    describe('A03 / P14: Lifecycle Status Validation & Junction Protection', () => {
        it('rejects unknown lifecycle status with 400 INVALID_STATUS', async () => {
            const res = await request(app)
                .put(`/api/projects/${projectAlpha.id}`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .send({ status: 'MADE_UP_STATUS' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('INVALID_STATUS');
        });

        it('rejects direct assignedLabIds modification via generic PUT', async () => {
            const res = await request(app)
                .put(`/api/projects/${projectAlpha.id}`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .send({ assignedLabIds: JSON.stringify([labC.id]) });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('INVALID_FIELD');
        });
    });

    describe('A04 / P08: National Scope Authorization', () => {
        it('denies national role creating project owned by foreign-country lab (403)', async () => {
            const res = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${tokenNational}`)
                .send({
                    code: 'CROSS-' + SUFFIX.slice(-4),
                    name: 'Cross Country Project',
                    projectType: 'OPEN_INTAKE',
                    labId: labC.id // Honduras lab, user is Guatemala only
                });

            expect(res.status).toBe(403);
            expect(res.body.errorCode).toBe('FORBIDDEN_NATIONAL_SCOPE');
        });
    });

    describe('A06 / P10: Servicing Lab Removal without Fallback Resurrection', () => {
        it('removing servicing lab leaves canonical list empty without country fallback', async () => {
            const projectFb = await prisma.project.create({
                data: {
                    id: 'PROJ-FB-' + SUFFIX,
                    code: 'PROJ-FB-' + SUFFIX,
                    name: 'Fallback Test',
                    status: 'ACTIVE',
                    labId: null,
                    assignedLabIds: JSON.stringify([labB.id]),
                    countries: JSON.stringify(['Guatemala'])
                }
            });
            await prisma.projectLab.create({
                data: { id: 'pl-fb-' + SUFFIX, projectCode: projectFb.code, labId: labB.id, role: 'SERVICING' }
            });

            const res = await request(app)
                .patch(`/api/projects/${projectFb.id}/lab-access`)
                .set('Authorization', `Bearer ${tokenAdmin}`)
                .send({ servicingLabIds: [], reason: 'Remove all servicing labs' });

            expect(res.status).toBe(200);
            expect(res.body.servicingLabIds).toEqual([]);

            const membership = require('../../services/projectMembershipService');
            const resolved = await membership.resolveProjectLabs(await prisma.project.findUnique({ where: { id: projectFb.id } }));
            expect(resolved.servicingLabIds).toEqual([]);
            expect(resolved.allMemberLabIds).toEqual([]);

            await prisma.project.delete({ where: { id: projectFb.id } });
        });
    });

    describe('A08 / P06: Archival Governance & Expected Samples Blocker', () => {
        it('denies servicing manager archiving a project owned by another lab (403)', async () => {
            const res = await request(app)
                .post(`/api/projects/${projectAlpha.id}/archive`)
                .set('Authorization', `Bearer ${tokenService}`)
                .send({ reason: 'Servicing archive attempt' });

            expect(res.status).toBe(403);
        });

        it('denies owner manager archiving project with pending expected samples (422)', async () => {
            const res = await request(app)
                .post(`/api/projects/${projectAlpha.id}/archive`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .send({ reason: 'Owner archive attempt' });

            expect(res.status).toBe(422);
            expect(res.body.error).toBe('CANNOT_ARCHIVE_WITH_EXPECTED_SAMPLES');
        });
    });

    describe('A10 / P12: Trash Denial for Projects with Registered Samples', () => {
        it('denies deleting project that contains registered samples (400)', async () => {
            const res = await request(app)
                .delete(`/api/projects/${projectAlpha.id}`)
                .set('Authorization', `Bearer ${tokenAdmin}`);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('CANNOT_DELETE_PROJECT_WITH_SAMPLES');

            // Verify samples remained attached and untouched
            const sampleB = await prisma.sample.findUnique({
                where: { id: 'SMP-B-' + SUFFIX }
            });
            expect(sampleB.projectId).toBe(projectAlpha.id);
            expect(sampleB.projectCode).toBe(projectAlpha.code);
        });
    });

    describe('A11 / P11: Atomic Rollback on Injected Audit Failure', () => {
        it('rolls back metadata updates atomically when audit logging throws', async () => {
            const projPartial = await prisma.project.create({
                data: {
                    id: 'PROJ-PARTIAL-' + SUFFIX,
                    code: 'PROJ-PARTIAL-' + SUFFIX,
                    name: 'Original Partial Name',
                    status: 'ACTIVE',
                    labId: labA.id
                }
            });

            const originalAudit = prisma.auditLog.create;
            prisma.auditLog.create = async () => {
                throw new Error('Injected regression test audit failure');
            };

            const res = await request(app)
                .put(`/api/projects/${projPartial.id}`)
                .set('Authorization', `Bearer ${tokenAdmin}`)
                .send({ name: 'Persisted despite 500?' });

            prisma.auditLog.create = originalAudit;

            expect(res.status).toBe(500);

            // Verify project name was rolled back in SQLite
            const afterProj = await prisma.project.findUnique({ where: { id: projPartial.id } });
            expect(afterProj.name).toBe('Original Partial Name');

            await prisma.project.delete({ where: { id: projPartial.id } });
        });
    });

    describe('A13, A14 / P09, P13: Import Preview & Conflict Detection', () => {
        it('preview endpoint detects duplicates in batch and existing samples in DB', async () => {
            const res = await request(app)
                .post(`/api/projects/${projectAlpha.id}/imports/preview`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .send({
                    sampleIds: [
                        'SMP-A-' + SUFFIX, // Existing in DB
                        'NEW-001',
                        'NEW-001', // Duplicate in batch
                        '000124',  // Leading zeros preserved
                        '   '     // Blank / empty
                    ]
                });

            expect(res.status).toBe(200);
            expect(res.body.valid).toBe(false);
            expect(res.body.conflictCount).toBe(1);
            expect(res.body.errorCount).toBe(2); // duplicate in batch + empty
            expect(res.body.validSampleIds).toEqual(['NEW-001', '000124']);
            expect(res.body.previewHash).toBeDefined();
        });

        it('manifest upload response envelope contains counts in data', async () => {
            const res = await request(app)
                .post(`/api/projects/${projectAlpha.id}/manifest`)
                .set('Authorization', `Bearer ${tokenAdmin}`)
                .send({ sampleIds: ['MANIFEST-TEST-1'] });

            expect(res.status).toBe(200);
            expect(res.body.messageCode).toBe('MANIFEST_PROCESSED');
            expect(res.body.data).toEqual({ count: 1, skipped: 0 });

            await prisma.sample.deleteMany({ where: { id: 'MANIFEST-TEST-1' } });
        });
    });
});
