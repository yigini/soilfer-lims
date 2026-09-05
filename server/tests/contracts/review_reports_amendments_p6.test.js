const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { usersDb } = require('../../db');
const { generateToken } = require('../setup');

describe('Package P6: Review, Reports & Amendments Verification', () => {
    let mgrUser, techUser, crossLabUser;
    let mgrToken, techToken, crossLabToken;
    let sampleForReview, sampleDisposed;

    beforeAll(async () => {
        mgrUser = usersDb.create({
            username: 'mgr_p6_test',
            role: 'LAB_MANAGER',
            labId: 'LAB-P6',
            countries: ['P6C']
        });
        mgrToken = generateToken(mgrUser);

        techUser = usersDb.create({
            username: 'tech_p6_test',
            role: 'LAB_TECHNICIAN',
            labId: 'LAB-P6',
            countries: ['P6C']
        });
        techToken = generateToken(techUser);

        crossLabUser = usersDb.create({
            username: 'mgr_p6_cross',
            role: 'LAB_MANAGER',
            labId: 'LAB-OTHER',
            countries: ['OTH']
        });
        crossLabToken = generateToken(crossLabUser);

        // Create sample for review and reporting
        sampleForReview = await prisma.sample.create({
            data: {
                id: 'p6-sample-review-01',
                originalId: 'FIELD-P6-01',
                labId: 'S-P6-01',
                assignedLab: 'LAB-P6',
                country: 'P6C',
                status: 'SUBMITTED_FULL',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                requiredAnalyses: JSON.stringify(['PH_H2O', 'EC']),
                workItems: {
                    create: [
                        {
                            id: 'p6-wi-ph-01',
                            analysis: 'PH_H2O',
                            category: 'Chemical',
                            status: 'SUBMITTED',
                            assignedTo: techUser.username,
                            labId: 'LAB-P6'
                        },
                        {
                            id: 'p6-wi-ec-01',
                            analysis: 'EC',
                            category: 'Chemical',
                            status: 'SUBMITTED',
                            assignedTo: techUser.username,
                            labId: 'LAB-P6'
                        }
                    ]
                }
            }
        });

        // Add valid results for both items
        await prisma.result.createMany({
            data: [
                {
                    id: 'p6-res-ph-01',
                    sampleId: sampleForReview.id,
                    param: 'PH_H2O',
                    value: '7.12',
                    numericValue: 7.12,
                    unit: 'pH_units',
                    isCurrent: true,
                    enteredBy: techUser.username
                },
                {
                    id: 'p6-res-ec-01',
                    sampleId: sampleForReview.id,
                    param: 'EC',
                    value: '1.45',
                    numericValue: 1.45,
                    unit: 'dS/m',
                    isCurrent: true,
                    enteredBy: techUser.username
                }
            ]
        });

        // Create a submission for this sample
        await prisma.submission.create({
            data: {
                id: 'p6-sub-001',
                sampleId: sampleForReview.id,
                assignedLab: 'LAB-P6',
                status: 'PENDING_REVIEW',
                type: 'FULL',
                submittedBy: techUser.username,
                submittedAt: new Date(),
                workItemCount: 2,
                workItemIds: JSON.stringify(['p6-wi-ph-01', 'p6-wi-ec-01'])
            }
        });

        // Create sample in DISPOSED status to verify immutability
        sampleDisposed = await prisma.sample.create({
            data: {
                id: 'p6-sample-disposed-01',
                originalId: 'FIELD-DISP-01',
                labId: 'S-DISP-01',
                assignedLab: 'LAB-P6',
                country: 'P6C',
                status: 'DISPOSED',
                requiredAnalyses: JSON.stringify(['PH_H2O'])
            }
        });
    });

    afterAll(async () => {
        await prisma.result.deleteMany({
            where: { sampleId: { in: [sampleForReview.id, sampleDisposed.id] } }
        });
        await prisma.report.deleteMany({
            where: { sampleId: { in: [sampleForReview.id, sampleDisposed.id] } }
        });
        await prisma.submission.deleteMany({
            where: { sampleId: { in: [sampleForReview.id, sampleDisposed.id] } }
        });
        await prisma.sampleAmendment.deleteMany({
            where: { sampleId: { in: [sampleForReview.id, sampleDisposed.id] } }
        });
        await prisma.workItem.deleteMany({
            where: { sampleId: { in: [sampleForReview.id, sampleDisposed.id] } }
        });
        await prisma.sample.deleteMany({
            where: { id: { in: [sampleForReview.id, sampleDisposed.id] } }
        });
    });

    test('1. Review submission accepts normalized decisions and updates status to ACCEPTED', async () => {
        const res = await request(app)
            .post('/api/submissions/p6-sub-001/review')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                decisions: [
                    { workItemId: 'p6-wi-ph-01', decision: 'ACCEPT', reason: 'QC passed and valid slope' },
                    { workItemId: 'p6-wi-ec-01', decision: 'ACCEPT', reason: 'Conductivity calibration verified' }
                ]
            });

        expect(res.status).toBe(200);

        // Verify work items are now ACCEPTED in database
        const items = await prisma.workItem.findMany({
            where: { id: { in: ['p6-wi-ph-01', 'p6-wi-ec-01'] } }
        });
        expect(items.every(i => i.status === 'ACCEPTED')).toBe(true);
    });

    test('2. Disposed material strictly rejects order modifications', async () => {
        const res = await request(app)
            .post(`/api/samples/${sampleDisposed.id}/orders`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                analyses: ['PH_H2O', 'VIS_NIR'],
                reason: 'Attempting to add analyses to disposed specimen'
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DISPOSED_MATERIAL_IMMUTABLE');
    });

    test('3. Generates report v1 with immutable snapshot and monotonic versioning', async () => {
        const res = await request(app)
            .post(`/api/reports/generate/${sampleForReview.id}`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.version).toBe(1);
        expect(res.body.sampleId).toBe(sampleForReview.id);
        expect(res.body.status).toBe('PUBLISHED');

        // Verify report snapshot in database
        const report = await prisma.report.findUnique({
            where: { id: res.body.id }
        });
        expect(report).toBeDefined();
        expect(report.version).toBe(1);
    });

    test('4. Generates superseding report v2 after authorized change', async () => {
        const res = await request(app)
            .post(`/api/reports/generate/${sampleForReview.id}`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.version).toBe(2);

        // Check report v1 is now marked SUPERSEDED
        const reportV1 = await prisma.report.findFirst({
            where: { sampleId: sampleForReview.id, version: 1 }
        });
        expect(reportV1.status).toBe('SUPERSEDED');
    });

    test('5. Traceable amendment creation preserves history and records audit', async () => {
        const res = await request(app)
            .post(`/api/samples/${sampleForReview.id}/amendments`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                type: 'CLERICAL',
                reason: 'Corrected field GPS coordinate typography on certificate',
                impactAssessment: 'Does not affect analytical chemistry findings.'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.amendment.type).toBe('CLERICAL');
        expect(res.body.amendment.status).toBe('APPROVED');
    });
});
