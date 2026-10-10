const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { usersDb } = require('../../db');
const { generateToken, ensureTestLab } = require('../setup');
const { setFixtureQcRequirement } = require('../helpers/qcPolicyFixture');

describe('Package P6: Review, Reports & Amendments Verification', () => {
    let mgrUser, techUser, crossLabUser;
    let mgrToken, techToken, crossLabToken, authoriserToken;
    let sampleForReview, sampleDisposed;

    beforeAll(async () => {
        await ensureTestLab('LAB-P6', 'P6C');
        mgrUser = usersDb.create({
            username: 'mgr_p6_test',
            role: 'LAB_MANAGER',
            labId: 'LAB-P6',
            countries: ['P6C']
        });
        mgrToken = generateToken(mgrUser);
        authoriserToken = generateToken(usersDb.create({username:'authoriser_p6_test',role:'LAB_MANAGER',labId:'LAB-P6',countries:['P6C']}));
        await setFixtureQcRequirement(prisma, mgrToken, 'LAB-P6');

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
        sampleForReview = await createSampleFixture(prisma, {
            data: {
                id: 'p6-sample-review-01',
                originalId: 'FIELD-P6-01',
                labId: 'S-P6-01',
                assignedLab: 'LAB-P6',
                country: 'P6C',
                receptionDate: new Date(),
                status: 'SUBMITTED_FULL',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                requiredAnalyses: JSON.stringify(['PH_H2O', 'EC'])
            }
        });
        for (const data of [
                        {
                            id: 'p6-wi-ph-01',
                            analysis: 'PH_H2O',
                            result: '7.12',
                            category: 'Chemical',
                            status: 'SUBMITTED',
                            assignedTo: techUser.username,
                            labId: 'LAB-P6'
                        },
                        {
                            id: 'p6-wi-ec-01',
                            analysis: 'EC',
                            result: '1.45',
                            category: 'Chemical',
                            status: 'SUBMITTED',
                            assignedTo: techUser.username,
                            labId: 'LAB-P6'
                        }
                    ]) {
            await createWorkItemFixture(prisma, { data: { ...data, sampleId: sampleForReview.id } });
        }

        // Add valid results for both items
        // Pin6056586906: each row binds its existing canonical owner.
        for (const data of [
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
            ]) await createExecutionResultFixture(prisma, { attemptStatus: 'SUBMITTED', data });

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

        await prisma.workItem.updateMany({
            where: { id: { in: ['p6-wi-ph-01', 'p6-wi-ec-01'] } }, data: { submissionId: 'p6-sub-001' }
        });

        // Create sample in DISPOSED status to verify immutability
        sampleDisposed = await createSampleFixture(prisma, {
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

    // Pin6056586906: retain execution, report and submission parents until owned database teardown.

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
        const before = { sample: await prisma.sample.findUnique({ where: { id: sampleDisposed.id } }),
            work: await prisma.workItem.findMany({ where: { sampleId: sampleDisposed.id }, orderBy: { id: 'asc' } }),
            audits: await prisma.auditLog.findMany({ where: { sampleId: sampleDisposed.id }, orderBy: { id: 'asc' } }) };
        const res = await request(app)
            .post(`/api/samples/${sampleDisposed.id}/orders`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                analyses: ['PH_H2O', 'VIS_NIR'],
                reason: 'Attempting to add analyses to disposed specimen'
            });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');
        expect({ sample: await prisma.sample.findUnique({ where: { id: sampleDisposed.id } }),
            work: await prisma.workItem.findMany({ where: { sampleId: sampleDisposed.id }, orderBy: { id: 'asc' } }),
            audits: await prisma.auditLog.findMany({ where: { sampleId: sampleDisposed.id }, orderBy: { id: 'asc' } }) }).toEqual(before);
    });

    test('3. Generates report v1 with immutable snapshot and monotonic versioning', async () => {
        const pending = await request(app).post(`/api/reports/generate/${sampleForReview.id}`)
            .set('Authorization', `Bearer ${mgrToken}`).send({});
        expect(pending.status).toBe(409);
        expect(pending.body.code).toBe('SAMPLE_NOT_APPROVED');
        const approval = await request(app).post(`/api/samples/${sampleForReview.id}/approve`)
            .set('Authorization', `Bearer ${mgrToken}`);
        expect(approval.status).toBe(200);
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

    test.each([
        ['orders/preview', { analyses: ['PH_H2O', 'VIS_NIR'] }],
        ['amendments', { type: 'RETEST', reason: 'Attempt physical retesting of disposed material' }],
        ['custody/move', { location: 'Retesting bench', reason: 'Attempt to move disposed material' }]
    ])('disposed material refuses %s with its stable code and zero writes', async (route, body) => {
        const snapshot = async () => ({
            sample: await prisma.sample.findUnique({ where: { id: sampleDisposed.id } }),
            work: await prisma.workItem.findMany({ where: { sampleId: sampleDisposed.id }, orderBy: { id: 'asc' } }),
            results: await prisma.result.findMany({ where: { sampleId: sampleDisposed.id }, orderBy: { id: 'asc' } }),
            amendments: await prisma.sampleAmendment.findMany({ where: { sampleId: sampleDisposed.id }, orderBy: { id: 'asc' } }),
            audits: await prisma.auditLog.findMany({ where: { sampleId: sampleDisposed.id }, orderBy: { id: 'asc' } })
        });
        const before = await snapshot();
        const response = await request(app).post(`/api/samples/${sampleDisposed.id}/${route}`)
            .set('Authorization', `Bearer ${mgrToken}`).send(body);
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('DISPOSED_MATERIAL_IMMUTABLE');
        expect(await snapshot()).toEqual(before);
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
        const pending = await request(app)
            .post(`/api/samples/${sampleForReview.id}/amendments`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                type: 'CLERICAL',
                reason: 'Corrected field GPS coordinate typography on certificate',
                impactAssessment: 'Does not affect analytical chemistry findings.'
            });

        expect(pending.status).toBe(200);
        expect(pending.body.amendment).toMatchObject({status:'PENDING',version:1,authorizedBy:null});
        const res=await request(app).post(`/api/samples/${sampleForReview.id}/amendments/${pending.body.amendment.id}/authorise`)
            .set('Authorization',`Bearer ${authoriserToken}`).send({expectedVersion:pending.body.amendment.version});
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.amendment.type).toBe('CLERICAL');
        expect(res.body.amendment.status).toBe('APPROVED');
    });
});
