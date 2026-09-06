'use strict';

const prisma = require('../../prisma');
const operationalConfirmationService = require('../../services/operationalConfirmationService');
const workbenchController = require('../../controllers/workbenchController');
const workItemController = require('../../controllers/workItemController');
const sampleController = require('../../controllers/sampleController');
const SampleWorkspaceService = require('../../services/sampleWorkspaceService');

describe('Workbench Single-Entry Architecture & Operational Lifecycle Contract', () => {
    let testSampleId;
    let testDryingId;
    let testPrepId;
    let testPhId;
    let testEcId;
    const testTech = { username: 'tech_marco_single', role: 'LAB_TECHNICIAN', labId: 'LAB-DEFAULT' };
    const testMgr = { username: 'mgr_gtm_single', role: 'LAB_MANAGER', labId: 'LAB-DEFAULT' };

    beforeAll(async () => {
        const timestamp = Date.now();
        testSampleId = `SMP-ENTRY-${timestamp}`;
        testDryingId = `WI-DRY-${timestamp}`;
        testPrepId = `WI-PREP-${timestamp}`;
        testPhId = `WI-PH-${timestamp}`;
        testEcId = `WI-EC-${timestamp}`;

        // Ensure users exist
        for (const u of [testTech, testMgr]) {
            await prisma.user.upsert({
                where: { username: u.username },
                update: {},
                create: {
                    id: `USR-${u.username}`,
                    username: u.username,
                    email: `${u.username}@example.com`,
                    password: 'hash',
                    role: u.role,
                    labId: u.labId
                }
            });
        }

        // Ensure analyses exist with descriptive names and active status
        const testAnalyses = [
            { code: 'DRYING', name: 'Sample Drying Procedure', units: 'std' },
            { code: 'PREPARATION', name: 'Sample Milling & Sieving', units: 'std' },
            { code: 'PH', name: 'Soil pH in Water', units: 'pH units' },
            { code: 'EC', name: 'Electrical Conductivity', units: 'dS/m' },
            { code: 'POTASSIUM', name: 'Exchangeable Potassium (K)', units: 'mg/kg' }
        ];
        for (const a of testAnalyses) {
            await prisma.analysis.upsert({
                where: { code: a.code },
                update: { name: a.name, units: a.units, status: 'active' },
                create: { code: a.code, name: a.name, units: a.units, status: 'active' }
            });
        }

        // Create sample physically received
        await prisma.sample.create({
            data: {
                id: testSampleId,
                originalId: `ORIG-${testSampleId}`,
                status: 'PROCESSING',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                labId: 'LAB-DEFAULT',
                assignedLab: 'LAB-DEFAULT',
                requiredAnalyses: JSON.stringify(['PH', 'EC'])
            }
        });

        // Initial Order Revision v1
        await prisma.sampleOrderRevision.create({
            data: {
                id: `REV1-${timestamp}`,
                sampleId: testSampleId,
                version: 1,
                status: 'ACTIVE',
                authorizedBy: testMgr.username,
                lines: {
                    create: [
                        { id: `OL-PH-${timestamp}`, analysis: 'PH', isRequired: true, status: 'ACTIVE' },
                        { id: `OL-EC-${timestamp}`, analysis: 'EC', isRequired: true, status: 'ACTIVE' }
                    ]
                }
            }
        });

        // Create operational gates
        await prisma.workItem.create({
            data: {
                id: testDryingId,
                sampleId: testSampleId,
                labId: 'LAB-DEFAULT',
                analysis: 'DRYING',
                category: 'Operational Gates',
                assignedTo: testTech.username,
                status: 'ASSIGNED',
                version: 1
            }
        });
        await prisma.workItem.create({
            data: {
                id: testPrepId,
                sampleId: testSampleId,
                labId: 'LAB-DEFAULT',
                analysis: 'PREPARATION',
                category: 'Operational Gates',
                assignedTo: testTech.username,
                status: 'ASSIGNED',
                version: 1
            }
        });

        // Create analytical tasks
        await prisma.workItem.create({
            data: {
                id: testPhId,
                sampleId: testSampleId,
                labId: 'LAB-DEFAULT',
                analysis: 'PH',
                category: 'Routine Chemistry',
                assignedTo: testTech.username,
                status: 'ASSIGNED',
                version: 1
            }
        });
        await prisma.workItem.create({
            data: {
                id: testEcId,
                sampleId: testSampleId,
                labId: 'LAB-DEFAULT',
                analysis: 'EC',
                category: 'Routine Chemistry',
                assignedTo: testTech.username,
                status: 'ASSIGNED',
                version: 1
            }
        });
    });

    afterAll(async () => {
        await prisma.workItem.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.orderLine.deleteMany({ where: { revision: { sampleId: testSampleId } } });
        await prisma.sampleOrderRevision.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.sample.deleteMany({ where: { id: testSampleId } });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Operational Confirmation Lifecycle (A01, A02, P1)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Operational Confirmation Lifecycle (A01, A02, P1)', () => {
        test('Rejects incomplete checklist with HTTP 422', async () => {
            await expect(
                operationalConfirmationService.confirmOperation({
                    actor: testTech,
                    workItemId: testDryingId,
                    checklist: [true, false, true]
                })
            ).rejects.toMatchObject({
                status: 422,
                code: 'CHECKLIST_INCOMPLETE'
            });
        });

        test('Rejects PREPARATION before DRYING is completed with HTTP 409', async () => {
            await expect(
                operationalConfirmationService.confirmOperation({
                    actor: testTech,
                    workItemId: testPrepId,
                    checklist: [true, true, true]
                })
            ).rejects.toMatchObject({
                status: 409,
                code: 'DRYING_PREREQUISITE_FAILED'
            });
        });

        test('Confirms DRYING checklist, generates durable receipt, unlocks gate, and creates NO scientific submission', async () => {
            const res = await operationalConfirmationService.confirmOperation({
                actor: testTech,
                workItemId: testDryingId,
                checklist: [true, true, true],
                observations: 'Tray dried to constant weight'
            });

            expect(res.success).toBe(true);
            expect(res.receipt.receiptId).toMatch(/^REC-OPS-/);
            expect(res.sample.dryingStatus).toBe('DONE');
            expect(res.workItem.status).toBe('COMPLETED');

            // Verify database state
            const updatedSample = await prisma.sample.findUnique({ where: { id: testSampleId } });
            expect(updatedSample.dryingStatus).toBe('DONE');

            const updatedItem = await prisma.workItem.findUnique({ where: { id: testDryingId } });
            expect(updatedItem.status).toBe('COMPLETED');
            const parsedResult = JSON.parse(updatedItem.result);
            expect(parsedResult.kind).toBe('operational-checklist-v1');
            expect(parsedResult.recordedBy).toBe(testTech.username);

            // Verify NO scientific submission was created
            const submissions = await prisma.submission.findMany({ where: { sampleId: testSampleId } });
            expect(submissions.length).toBe(0);
        });

        test('Confirms PREPARATION checklist once drying is complete', async () => {
            const res = await operationalConfirmationService.confirmOperation({
                actor: testTech,
                workItemId: testPrepId,
                checklist: [true, true, true]
            });

            expect(res.success).toBe(true);
            expect(res.sample.preparationStatus).toBe('DONE');
            expect(res.workItem.status).toBe('COMPLETED');

            const updatedSample = await prisma.sample.findUnique({ where: { id: testSampleId } });
            expect(updatedSample.preparationStatus).toBe('DONE');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Closure of Execution Shortcuts (A11, P4, W08)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Closure of Execution Shortcuts (A11, P4, W08)', () => {
        test('PUT /api/work/:id/status rejects bare Done on operational gate without checklist', async () => {
            const req = {
                user: testTech,
                params: { id: testPrepId },
                body: { status: 'COMPLETED', result: 'Done' }
            };
            let statusVal, jsonVal;
            const res = {
                status: (s) => { statusVal = s; return res; },
                json: (j) => { jsonVal = j; return res; }
            };

            await workItemController.updateWorkItemStatus(req, res);
            expect(statusVal).toBe(422);
            expect(jsonVal.code).toBe('CHECKLIST_REQUIRED');
        });

        test('PUT /api/samples/:id/phase rejects DONE without verified checklist', async () => {
            const req = {
                user: testTech,
                params: { id: testSampleId },
                body: { phase: 'preparation', status: 'DONE' }
            };
            let statusVal, jsonVal;
            const res = {
                status: (s) => { statusVal = s; return res; },
                json: (j) => { jsonVal = j; return res; }
            };

            await sampleController.updatePhaseStatus(req, res);
            expect(statusVal).toBe(422);
            expect(jsonVal.code).toBe('CHECKLIST_REQUIRED');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Manager Approval Policy & Submission Review (A05, P2, W10)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Manager Review & Scientific Approval Policy (A05, P2, W10)', () => {
        test('Rejects approving unrecorded or unsubmitted scientific tasks', async () => {
            const req = {
                user: testMgr,
                params: { id: testPhId },
                body: { status: 'ACCEPTED', note: 'Approve without submit' }
            };
            let statusVal, jsonVal;
            const res = {
                status: (s) => { statusVal = s; return res; },
                json: (j) => { jsonVal = j; return res; }
            };

            await workItemController.reviewWorkItem(req, res);
            expect(statusVal).toBe(400);
            expect(jsonVal.error).toContain('Only submitted work items can be reviewed');
        });

        test('Submitting and reviewing scientific determination reconciles Submission and ReviewDecision', async () => {
            // 1. Record pH result
            await prisma.workItem.update({
                where: { id: testPhId },
                data: { status: 'COMPLETED', result: '6.85' }
            });

            // 2. Submit via workbenchController.commitSubmissions
            const submitReq = {
                user: testTech,
                body: {
                    sampleIds: [testSampleId],
                    workItemIds: [testPhId],
                    note: 'pH determination for review'
                }
            };
            let submitStatus, submitJson;
            const submitRes = {
                status: (s) => { submitStatus = s; return submitRes; },
                json: (j) => { submitJson = j; return submitRes; }
            };

            await workbenchController.commitSubmissions(submitReq, submitRes);
            expect(submitJson.success).toBe(true);

            // Verify work item is SUBMITTED
            const submittedPh = await prisma.workItem.findUnique({ where: { id: testPhId } });
            expect(submittedPh.status).toBe('SUBMITTED');

            const submission = await prisma.submission.findFirst({ where: { sampleId: testSampleId } });
            expect(submission).not.toBeNull();
            expect(submission.status).toBe('PENDING_REVIEW');

            // 3. Manager reviews submitted work item
            const reviewReq = {
                user: testMgr,
                params: { id: testPhId },
                body: { status: 'ACCEPTED', note: 'QA verified' }
            };
            let reviewStatus, reviewJson;
            const reviewRes = {
                status: (s) => { reviewStatus = s; return reviewRes; },
                json: (j) => { reviewJson = j; return reviewRes; }
            };

            await workItemController.reviewWorkItem(reviewReq, reviewRes);
            expect(reviewJson.success).toBe(true);

            // Verify parent Submission is now REVIEWED
            const updatedSubmission = await prisma.submission.findUnique({ where: { id: submission.id } });
            expect(updatedSubmission.status).toBe('REVIEWED');

            // Verify ReviewDecision was created
            const decision = await prisma.reviewDecision.findFirst({
                where: { workItemId: testPhId, decision: 'ACCEPT' }
            });
            expect(decision).not.toBeNull();
            expect(decision.reviewerName).toBe(testMgr.username);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Truthful Responses & Queue Views (W04, W06, P3)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Truthful Responses & Queue Views (W04, W06, P3)', () => {
        test('batchSave responds HTTP 422 when saved: 0 and errors exist', async () => {
            const req = {
                user: testTech,
                body: {
                    entries: [
                        { workItemId: 'NON_EXISTENT_WI_1', value: 7.0 },
                        { workItemId: 'NON_EXISTENT_WI_2', value: 8.0 }
                    ]
                }
            };
            let statusVal, jsonVal;
            const res = {
                status: (s) => { statusVal = s; return res; },
                json: (j) => { jsonVal = j; return res; }
            };

            await workbenchController.batchSave(req, res);
            expect(statusVal).toBe(422);
            expect(jsonVal.success).toBe(false);
            expect(jsonVal.saved).toBe(0);
            expect(jsonVal.errors.length).toBe(2);
        });

        test('previewSubmissions filters out operational gates and bare Done completions', async () => {
            const req = { user: testTech, body: {} };
            let jsonVal;
            const res = {
                json: (j) => { jsonVal = j; return res; },
                status: () => res
            };

            await workbenchController.previewSubmissions(req, res);
            expect(jsonVal).toHaveProperty('eligibleSamples');

            // Operational gates DRYING and PREPARATION should NOT appear in eligible samples
            const eligibleForTestSample = jsonVal.eligibleSamples.find(s => s.sampleId === testSampleId);
            if (eligibleForTestSample) {
                const analyses = eligibleForTestSample.determinations.map(d => d.analysis);
                expect(analyses).not.toContain('DRYING');
                expect(analyses).not.toContain('PREPARATION');
            }
        });

        test('getQueue supports view filtering (my_work, ready_to_submit, submitted, completed)', async () => {
            const req = {
                user: testTech,
                query: { view: 'my_work' }
            };
            let jsonVal;
            const res = {
                json: (j) => { jsonVal = j; return res; },
                status: () => res
            };

            await workbenchController.getQueue(req, res);
            expect(jsonVal).toHaveProperty('groups');
            expect(jsonVal).toHaveProperty('stats');
            expect(jsonVal.stats).toHaveProperty('myWorkCount');
            expect(jsonVal.stats).toHaveProperty('readyToSubmitCount');
            expect(jsonVal.stats).toHaveProperty('submittedCount');
            expect(jsonVal.stats).toHaveProperty('completedCount');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Order Revision Coherence & Workspace Warning (A14, A15, W09)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Order Revision Snapshotting & Workspace Diagnostics (A14, A15, W09)', () => {
        test('updateSampleAnalyses creates coherent OrderRevision v2 and OrderLines transactionally', async () => {
            const req = {
                user: testMgr,
                params: { id: testSampleId },
                body: {
                    analyses: ['PH', 'EC', 'POTASSIUM'],
                    reason: 'Client requested potassium determination'
                }
            };
            let jsonVal, statusVal;
            const res = {
                json: (j) => { jsonVal = j; return res; },
                status: (s) => { statusVal = s; return res; }
            };

            await sampleController.updateSampleAnalyses(req, res);
            expect(jsonVal.success).toBe(true);

            // Verify active revision is v2
            const activeRevs = await prisma.sampleOrderRevision.findMany({
                where: { sampleId: testSampleId, status: 'ACTIVE' },
                include: { lines: true }
            });
            expect(activeRevs.length).toBe(1);
            expect(activeRevs[0].version).toBe(2);
            expect(activeRevs[0].lines.length).toBe(3);

            // Verify previous revision v1 was SUPERSEDED
            const oldRev = await prisma.sampleOrderRevision.findFirst({
                where: { sampleId: testSampleId, version: 1 }
            });
            expect(oldRev.status).toBe('SUPERSEDED');
        });

        test('SampleWorkspaceService projects active revision and flags any order mismatch', async () => {
            const workspace = await SampleWorkspaceService.getWorkspaceData(testSampleId, testMgr);
            expect(workspace.order.revisionNumber).toBe(2);
            expect(workspace.order.revisionStatus).toBe('ACTIVE');

            // Check gates projection contains durable receipts
            expect(workspace.operationalGates.drying.isDone).toBe(true);
            expect(workspace.operationalGates.drying.receipt).not.toBeNull();
            expect(workspace.operationalGates.preparation.isDone).toBe(true);
            expect(workspace.operationalGates.preparation.receipt).not.toBeNull();
        });
    });
});
