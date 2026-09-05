const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { usersDb } = require('../../db');
const { generateToken } = require('../setup');

describe('Package P2: Sample Workspace Projection & Transactional Foundations', () => {
    let mgrUser, techUser, crossLabUser;
    let mgrToken, techToken, crossLabToken;
    let testSample;

    beforeAll(async () => {
        // Create users
        mgrUser = usersDb.create({
            username: 'mgr_ws_p2',
            role: 'LAB_MANAGER',
            labId: 'LAB-P2',
            countries: ['P2C']
        });
        mgrToken = generateToken(mgrUser);

        techUser = usersDb.create({
            username: 'tech_ws_p2',
            role: 'LAB_TECHNICIAN',
            labId: 'LAB-P2',
            countries: ['P2C']
        });
        techToken = generateToken(techUser);

        crossLabUser = usersDb.create({
            username: 'mgr_other_p2',
            role: 'LAB_MANAGER',
            labId: 'LAB-OTHER',
            countries: ['OTH']
        });
        crossLabToken = generateToken(crossLabUser);

        // Create sample in LAB-P2
        testSample = await prisma.sample.create({
            data: {
                id: 'ws-sample-test-001',
                originalId: 'FIELD-P2-001',
                labId: 'S-P2-001',
                assignedLab: 'LAB-P2',
                country: 'P2C',
                status: 'PROCESSING',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                requiredAnalyses: JSON.stringify(['PH_H2O', 'VIS_NIR']),
                workItems: {
                    create: [
                        {
                            id: 'wi-gate-dry-001',
                            analysis: 'DRYING',
                            category: 'Operational Gates',
                            status: 'ACCEPTED',
                            labId: 'LAB-P2'
                        },
                        {
                            id: 'wi-gate-prep-001',
                            analysis: 'PREPARATION',
                            category: 'Operational Gates',
                            status: 'ACCEPTED',
                            labId: 'LAB-P2'
                        },
                        {
                            id: 'wi-an-ph-001',
                            analysis: 'PH_H2O',
                            category: 'Chemical',
                            status: 'SUBMITTED',
                            assignedTo: techUser.username,
                            labId: 'LAB-P2'
                        },
                        {
                            id: 'wi-an-mir-001',
                            analysis: 'VIS_NIR',
                            category: 'Spectroscopy',
                            status: 'ACCEPTED', // S003-like anomaly: ACCEPTED without any results/scans
                            labId: 'LAB-P2'
                        }
                    ]
                }
            }
        });

        // Add result for pH so it has evidence
        await prisma.result.create({
            data: {
                id: 'res-ph-001',
                sampleId: testSample.id,
                param: 'PH_H2O',
                value: '6.85',
                numericValue: 6.85,
                unit: 'pH_units',
                isCurrent: true,
                enteredBy: techUser.username
            }
        });
    });

    afterAll(async () => {
        try {
            await prisma.result.deleteMany({ where: { sampleId: testSample.id } });
            await prisma.workItem.deleteMany({ where: { sampleId: testSample.id } });
            await prisma.sampleOrderRevision.deleteMany({ where: { sampleId: testSample.id } });
            await prisma.sampleAmendment.deleteMany({ where: { sampleId: testSample.id } });
            await prisma.commandReceipt.deleteMany({ where: { targetResource: `Sample:${testSample.id}` } });
            await prisma.sample.deleteMany({ where: { id: testSample.id } });
        } catch (e) {}
    });

    test('1. GET /api/samples/:id/workspace returns unified 5-tab projection', async () => {
        const res = await request(app)
            .get(`/api/samples/${testSample.id}/workspace`)
            .set('Authorization', `Bearer ${mgrToken}`);

        expect(res.status).toBe(200);
        expect(res.body.identity).toBeDefined();
        expect(res.body.identity.id).toBe(testSample.id);
        expect(res.body.identity.fieldId).toBe('FIELD-P2-001');
        expect(res.body.identity.labSampleCode).toBe('S-P2-001');
        expect(res.body.workItems).toBeDefined();
        expect(res.body.workItems.length).toBe(4);
        expect(res.body.operationalGates.allGatesPassed).toBe(true);
        expect(res.body.capabilities).toBeDefined();
        expect(res.body.counters).toBeDefined();
        expect(res.body.counters.ordered).toBe(2);
    });

    test('2. Accurately detects S003-style historical evidence gap on unverified accepted items', async () => {
        const res = await request(app)
            .get(`/api/samples/${testSample.id}/workspace`)
            .set('Authorization', `Bearer ${mgrToken}`);

        expect(res.status).toBe(200);
        expect(res.body.integrity.hasHistoricalGap).toBe(true);
        expect(res.body.integrity.warning).toContain('Historical approval — evidence needs verification');

        const mirItem = res.body.workItems.find(w => w.analysis === 'VIS_NIR');
        expect(mirItem.isHistoricalGap).toBe(true);
        expect(mirItem.blockers).toContain('Historical approval — evidence needs verification');

        const phItem = res.body.workItems.find(w => w.analysis === 'PH_H2O');
        expect(phItem.isHistoricalGap).toBe(false);
    });

    test('3. Expected sample shows "Not yet received" without fabricating received date', async () => {
        const expSample = await prisma.sample.create({
            data: {
                id: 'ws-exp-sample-001',
                originalId: 'EXP-P2-001',
                assignedLab: 'LAB-P2',
                country: 'P2C',
                status: 'EXPECTED',
                receptionDate: null
            }
        });

        const res = await request(app)
            .get(`/api/samples/${expSample.id}/workspace`)
            .set('Authorization', `Bearer ${mgrToken}`);

        expect(res.status).toBe(200);
        expect(res.body.identity.dates.receivedDateDisplay).toBe('Not yet received');
        expect(res.body.capabilities.canReceive.allowed).toBe(true);
        expect(res.body.nextAction.action).toBe('RECEIVE');

        await prisma.sample.delete({ where: { id: expSample.id } });
    });

    test('4. Cross-lab access is strictly denied (403)', async () => {
        const res = await request(app)
            .get(`/api/samples/${testSample.id}/workspace`)
            .set('Authorization', `Bearer ${crossLabToken}`);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN_SCOPE');
    });

    test('5. POST /api/samples/:id/orders applies revision atomically and records receipt', async () => {
        const idempotencyKey = 'order-rev-key-' + Date.now();
        const res = await request(app)
            .post(`/api/samples/${testSample.id}/orders`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                analyses: ['PH_H2O', 'VIS_NIR', 'EC'],
                reason: 'Client requested electrical conductivity',
                idempotencyKey
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.revision).toBeDefined();
        expect(res.body.revision.version).toBe(1);

        // Verify idempotency cache hit
        const retryRes = await request(app)
            .post(`/api/samples/${testSample.id}/orders`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                analyses: ['PH_H2O', 'VIS_NIR', 'EC'],
                reason: 'Client requested electrical conductivity',
                idempotencyKey
            });

        expect(retryRes.status).toBe(200);
        expect(retryRes.body.revision.id).toBe(res.body.revision.id);

        // Clean up created work item for EC
        await prisma.workItem.deleteMany({ where: { sampleId: testSample.id, analysis: 'EC' } });
    });

    test('6. POST /api/samples/:id/custody/move records physical location change and audit', async () => {
        const res = await request(app)
            .post(`/api/samples/${testSample.id}/custody/move`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                location: 'Room 102 - Shelf 4B',
                reason: 'Transfer to analytical bench'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.location).toBe('Room 102 - Shelf 4B');

        const audit = await prisma.auditLog.findFirst({
            where: { entityId: testSample.id, action: 'STORAGE_MOVEMENT' }
        });
        expect(audit).toBeDefined();
        expect(audit.details).toContain('Room 102 - Shelf 4B');
    });
});
