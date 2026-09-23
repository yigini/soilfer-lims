/**
 * Manager Dashboard Progress & Bottleneck Overview Contract Tests (Refs #120)
 * 
 * Verifies that GET /api/dashboard/home supplies truthful:
 * 1. progressOverview with sample analysis progress (% completion, analytical items only).
 * 2. techWorkload with per-analyst assigned, completed, and pending determination counts.
 * 3. stageCounts representing active laboratory workflow stages.
 * 4. Scoped authorization: cross-lab technicians and specimens are strictly excluded.
 * 5. Scoped System Admin (SUPER_ADMIN with ?labId=) receives matching lab progress overview.
 */
'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_12345';

describe('Manager Dashboard Progress & Bottleneck Overview (Refs #120)', () => {
    let testLab1;
    let testLab2;
    let manager1Token;
    let manager2Token;
    let adminToken;
    let tech1;
    let tech2;
    let otherTech;
    let sampleActive;
    let sampleCompleted;

    beforeAll(async () => {
        const unique = Date.now();
        const pwHash = await bcrypt.hash('password123', 10);

        // Labs
        testLab1 = await prisma.lab.create({
            data: { id: `LAB-MGR-A-${unique}`, name: 'Manager Lab Alpha', code: `MLA-${unique}`, country: 'GTM', isActive: true }
        });
        testLab2 = await prisma.lab.create({
            data: { id: `LAB-MGR-B-${unique}`, name: 'Manager Lab Beta', code: `MLB-${unique}`, country: 'HND', isActive: true }
        });

        // Managers
        const mgr1 = await prisma.user.create({
            data: {
                id: `usr-mgr1-${unique}`,
                username: `mgr1_${unique}`,
                name: 'Alpha Manager',
                email: `mgr1_${unique}@soilfer.org`,
                role: 'LAB_MANAGER',
                labId: testLab1.id,
                password: pwHash,
                isActive: true
            }
        });
        const mgr2 = await prisma.user.create({
            data: {
                id: `usr-mgr2-${unique}`,
                username: `mgr2_${unique}`,
                name: 'Beta Manager',
                email: `mgr2_${unique}@soilfer.org`,
                role: 'LAB_MANAGER',
                labId: testLab2.id,
                password: pwHash,
                isActive: true
            }
        });
        const adminUser = await prisma.user.create({
            data: {
                id: `usr-admin-${unique}`,
                username: `admin_${unique}`,
                name: 'System Administrator',
                email: `admin_${unique}@soilfer.org`,
                role: 'SUPER_ADMIN',
                password: pwHash,
                isActive: true
            }
        });

        // Technicians in Lab 1
        tech1 = await prisma.user.create({
            data: {
                id: `usr-t1-${unique}`,
                username: `tech1_${unique}`,
                name: 'Mario Alvarez (Analyst)',
                email: `t1_${unique}@soilfer.org`,
                role: 'LAB_TECHNICIAN',
                labId: testLab1.id,
                password: pwHash,
                isActive: true
            }
        });
        tech2 = await prisma.user.create({
            data: {
                id: `usr-t2-${unique}`,
                username: `tech2_${unique}`,
                name: 'Elena Fuentes (Analyst)',
                email: `t2_${unique}@soilfer.org`,
                role: 'LAB_TECHNICIAN',
                labId: testLab1.id,
                password: pwHash,
                isActive: true
            }
        });

        // Technician in Lab 2 (Foreign Lab)
        otherTech = await prisma.user.create({
            data: {
                id: `usr-tother-${unique}`,
                username: `techother_${unique}`,
                name: 'Foreign Technician',
                email: `tother_${unique}@soilfer.org`,
                role: 'LAB_TECHNICIAN',
                labId: testLab2.id,
                password: pwHash,
                isActive: true
            }
        });

        // Samples in Lab 1
        sampleActive = await prisma.sample.create({
            data: {
                id: `SMP-A-${unique}-1`,
                originalId: `FLD-A-${unique}-1`,
                labId: `LA-${unique}-001`,
                assignedLab: testLab1.id,
                status: 'PROCESSING',
                receptionDate: new Date('2026-09-20T10:00:00Z'),
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        sampleCompleted = await prisma.sample.create({
            data: {
                id: `SMP-A-${unique}-2`,
                originalId: `FLD-A-${unique}-2`,
                labId: `LA-${unique}-002`,
                assignedLab: testLab1.id,
                status: 'COMPLETED',
                receptionDate: new Date('2026-09-19T10:00:00Z'),
                updatedAt: new Date()
            }
        });

        // Work items for sampleActive in Lab 1:
        // 1 Gate item (DRYING) -> must NOT count as analytical progress
        await prisma.workItem.create({
            data: { id: `WI-${unique}-G1`, sampleId: sampleActive.id, analysis: 'DRYING', status: 'COMPLETED', assignedLab: testLab1.id }
        });
        // 3 Analytical items:
        // Item 1: PH_H2O completed by tech1
        await prisma.workItem.create({
            data: { id: `WI-${unique}-A1`, sampleId: sampleActive.id, analysis: 'PH_H2O', status: 'COMPLETED', assignedTo: tech1.username, assignedLab: testLab1.id }
        });
        // Item 2: EC_1_5 in progress by tech1
        await prisma.workItem.create({
            data: { id: `WI-${unique}-A2`, sampleId: sampleActive.id, analysis: 'EC_1_5', status: 'IN_PROGRESS', assignedTo: tech1.username, assignedLab: testLab1.id }
        });
        // Item 3: OC_WALKLEY_BLACK not assigned
        await prisma.workItem.create({
            data: { id: `WI-${unique}-A3`, sampleId: sampleActive.id, analysis: 'OC_WALKLEY_BLACK', status: 'NOT_ASSIGNED', assignedLab: testLab1.id }
        });

        // Foreign sample in Lab 2
        const sampleForeign = await prisma.sample.create({
            data: {
                id: `SMP-B-${unique}-1`,
                originalId: `FLD-B-${unique}-1`,
                labId: `LB-${unique}-001`,
                assignedLab: testLab2.id,
                status: 'PROCESSING',
                receptionDate: new Date('2026-09-20T10:00:00Z')
            }
        });
        await prisma.workItem.create({
            data: { id: `WI-${unique}-FB`, sampleId: sampleForeign.id, analysis: 'PH_H2O', status: 'PENDING', assignedTo: otherTech.username, assignedLab: testLab2.id }
        });

        manager1Token = jwt.sign({ id: mgr1.id, username: mgr1.username, role: 'LAB_MANAGER', labId: testLab1.id }, JWT_SECRET, { expiresIn: '1h' });
        manager2Token = jwt.sign({ id: mgr2.id, username: mgr2.username, role: 'LAB_MANAGER', labId: testLab2.id }, JWT_SECRET, { expiresIn: '1h' });
        adminToken = jwt.sign({ id: adminUser.id, username: adminUser.username, role: 'SUPER_ADMIN' }, JWT_SECRET, { expiresIn: '1h' });
    });

    test('1. LAB_MANAGER dashboard home includes progressOverview with analytical oversight and techWorkload', async () => {
        const res = await request(app)
            .get('/api/dashboard/home')
            .set('Authorization', `Bearer ${manager1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.progressOverview).toBeDefined();
        const po = res.body.progressOverview;

        // Oversight: sampleActive should have total=3 (analytical items, DRYING excluded), completed=1 -> 33%
        expect(Array.isArray(po.oversight)).toBe(true);
        const activeSampleOversight = po.oversight.find(s => s.sampleId === sampleActive.id);
        expect(activeSampleOversight).toBeDefined();
        expect(activeSampleOversight.total).toBe(3); // PH_H2O, EC_1_5, OC_WALKLEY_BLACK (DRYING gate excluded)
        expect(activeSampleOversight.completed).toBe(1);
        expect(activeSampleOversight.progress).toBe(33);
        expect(activeSampleOversight.isReady).toBe(false);

        // Foreign sample from Lab 2 must NOT be in Lab 1 oversight
        const foreignSampleOversight = po.oversight.find(s => s.sampleId.includes('SMP-B-'));
        expect(foreignSampleOversight).toBeUndefined();

        // Tech Workload: Lab 1 has tech1 and tech2, strictly excluding otherTech
        expect(Array.isArray(po.techWorkload)).toBe(true);
        const t1Work = po.techWorkload.find(t => t.username === tech1.username);
        const t2Work = po.techWorkload.find(t => t.username === tech2.username);
        const foreignTechWork = po.techWorkload.find(t => t.username === otherTech.username);

        expect(t1Work).toBeDefined();
        expect(t1Work.assigned).toBe(2); // PH_H2O and EC_1_5
        expect(t1Work.completed).toBe(1); // PH_H2O
        expect(t1Work.pending).toBe(1); // EC_1_5

        expect(t2Work).toBeDefined();
        expect(t2Work.assigned).toBe(0);

        expect(foreignTechWork).toBeUndefined();

        // Stage Counts
        expect(po.stageCounts).toBeDefined();
        expect(po.stageCounts.inProgress).toBeGreaterThanOrEqual(1);
        expect(po.stageCounts.unassignedTasks).toBeGreaterThanOrEqual(1); // OC_WALKLEY_BLACK
    });

    test('2. SUPER_ADMIN scoped to a lab receives matching progressOverview', async () => {
        const res = await request(app)
            .get('/api/dashboard/home')
            .query({ labId: testLab1.id })
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.progressOverview).toBeDefined();
        const po = res.body.progressOverview;

        const activeSampleOversight = po.oversight.find(s => s.sampleId === sampleActive.id);
        expect(activeSampleOversight).toBeDefined();
        expect(activeSampleOversight.total).toBe(3);
        expect(activeSampleOversight.completed).toBe(1);

        const t1Work = po.techWorkload.find(t => t.username === tech1.username);
        expect(t1Work).toBeDefined();
        expect(t1Work.assigned).toBe(2);
    });

    test('3. Cross-lab isolation: Manager 2 does not see Manager 1 progress or technicians', async () => {
        const res = await request(app)
            .get('/api/dashboard/home')
            .set('Authorization', `Bearer ${manager2Token}`);

        expect(res.status).toBe(200);
        const po = res.body.progressOverview;
        expect(po).toBeDefined();

        // Lab 1 sample must not appear in Lab 2
        const lab1Sample = po.oversight.find(s => s.sampleId === sampleActive.id);
        expect(lab1Sample).toBeUndefined();

        // Lab 1 tech must not appear in Lab 2
        const lab1Tech = po.techWorkload.find(t => t.username === tech1.username);
        expect(lab1Tech).toBeUndefined();

        // Foreign tech must appear in Lab 2
        const lab2Tech = po.techWorkload.find(t => t.username === otherTech.username);
        expect(lab2Tech).toBeDefined();
    });
});

describe('Bounded Correctness & Stage Precedence (Review Comment 5796060402)', () => {
    let stageLab;
    let stageManagerToken;
    let techAlpha;
    let sampleReview;
    let sampleApproval;
    let sampleBench;
    let sampleApprovedToday;
    let sampleApprovedPast;
    let sampleCompletedNoApprovedAt;

    beforeAll(async () => {
        const unique = Date.now() + 5000;
        const pwHash = await bcrypt.hash('password123', 10);

        stageLab = await prisma.lab.create({
            data: { id: `LAB-STAGE-${unique}`, name: 'Stage Precedence Lab', code: `STG-${unique}`, country: 'SLV', isActive: true }
        });

        const mgr = await prisma.user.create({
            data: {
                id: `usr-mgr-stg-${unique}`,
                username: `mgr_stg_${unique}`,
                name: 'Stage Manager',
                email: `mgr_stg_${unique}@soilfer.org`,
                role: 'LAB_MANAGER',
                labId: stageLab.id,
                password: pwHash,
                isActive: true
            }
        });

        techAlpha = await prisma.user.create({
            data: {
                id: `usr-tech-stg-${unique}`,
                username: `tech_stg_${unique}`,
                name: 'Stage Analyst',
                email: `tech_stg_${unique}@soilfer.org`,
                role: 'LAB_TECHNICIAN',
                labId: stageLab.id,
                password: pwHash,
                isActive: true
            }
        });

        stageManagerToken = jwt.sign(
            { id: mgr.id, username: mgr.username, role: 'LAB_MANAGER', labId: stageLab.id },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // 1. Sample with SUBMITTED work + Closure task (ARCHIVING)
        sampleReview = await prisma.sample.create({
            data: {
                id: `SMP-STG-REV-${unique}`,
                originalId: `FLD-STG-REV-${unique}`,
                labId: `L-STG-REV-${unique}`,
                assignedLab: stageLab.id,
                status: 'PROCESSING',
                receptionDate: new Date('2026-09-20T10:00:00Z'),
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });
        await prisma.workItem.create({
            data: { id: `WI-REV-1-${unique}`, sampleId: sampleReview.id, analysis: 'PH_H2O', status: 'SUBMITTED', assignedTo: techAlpha.username, assignedLab: stageLab.id }
        });
        await prisma.workItem.create({
            data: { id: `WI-REV-2-${unique}`, sampleId: sampleReview.id, analysis: 'EC_1_5', status: 'SUBMITTED', assignedTo: techAlpha.username, assignedLab: stageLab.id }
        });
        // Closure item: ARCHIVING must be excluded from denominator!
        await prisma.workItem.create({
            data: { id: `WI-REV-3-${unique}`, sampleId: sampleReview.id, analysis: 'ARCHIVING', status: 'PENDING', assignedLab: stageLab.id }
        });

        // 2. Sample with all ACCEPTED work + Closure task (DISPOSAL)
        sampleApproval = await prisma.sample.create({
            data: {
                id: `SMP-STG-APP-${unique}`,
                originalId: `FLD-STG-APP-${unique}`,
                labId: `L-STG-APP-${unique}`,
                assignedLab: stageLab.id,
                status: 'PROCESSING',
                receptionDate: new Date('2026-09-20T11:00:00Z'),
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });
        await prisma.workItem.create({
            data: { id: `WI-APP-1-${unique}`, sampleId: sampleApproval.id, analysis: 'PH_H2O', status: 'ACCEPTED', assignedTo: techAlpha.username, assignedLab: stageLab.id }
        });
        await prisma.workItem.create({
            data: { id: `WI-APP-2-${unique}`, sampleId: sampleApproval.id, analysis: 'EC_1_5', status: 'ACCEPTED', assignedTo: techAlpha.username, assignedLab: stageLab.id }
        });
        // Closure item: DISPOSAL must be excluded from denominator!
        await prisma.workItem.create({
            data: { id: `WI-APP-3-${unique}`, sampleId: sampleApproval.id, analysis: 'DISPOSAL', status: 'PENDING', assignedLab: stageLab.id }
        });

        // 3. Sample actively in progress at bench
        sampleBench = await prisma.sample.create({
            data: {
                id: `SMP-STG-BCH-${unique}`,
                originalId: `FLD-STG-BCH-${unique}`,
                labId: `L-STG-BCH-${unique}`,
                assignedLab: stageLab.id,
                status: 'PROCESSING',
                receptionDate: new Date('2026-09-20T12:00:00Z'),
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });
        await prisma.workItem.create({
            data: { id: `WI-BCH-1-${unique}`, sampleId: sampleBench.id, analysis: 'PH_H2O', status: 'IN_PROGRESS', assignedTo: techAlpha.username, assignedLab: stageLab.id }
        });
        await prisma.workItem.create({
            data: { id: `WI-BCH-2-${unique}`, sampleId: sampleBench.id, analysis: 'EC_1_5', status: 'PENDING', assignedLab: stageLab.id }
        });

        // 4. Sample approved today (authoritative approvedAt today)
        sampleApprovedToday = await prisma.sample.create({
            data: {
                id: `SMP-STG-TODAY-${unique}`,
                originalId: `FLD-STG-TODAY-${unique}`,
                labId: `L-STG-TODAY-${unique}`,
                assignedLab: stageLab.id,
                status: 'APPROVED',
                receptionDate: new Date('2026-09-20T08:00:00Z'),
                approvedAt: new Date(),
                updatedAt: new Date()
            }
        });

        // 5. Sample approved in the past, but updated today (updatedAt today)
        sampleApprovedPast = await prisma.sample.create({
            data: {
                id: `SMP-STG-PAST-${unique}`,
                originalId: `FLD-STG-PAST-${unique}`,
                labId: `L-STG-PAST-${unique}`,
                assignedLab: stageLab.id,
                status: 'APPROVED',
                receptionDate: new Date('2026-09-01T08:00:00Z'),
                approvedAt: new Date('2026-09-02T10:00:00Z'),
                updatedAt: new Date()
            }
        });

        // 6. Sample completed with null approvedAt, updated today
        sampleCompletedNoApprovedAt = await prisma.sample.create({
            data: {
                id: `SMP-STG-COMP-${unique}`,
                originalId: `FLD-STG-COMP-${unique}`,
                labId: `L-STG-COMP-${unique}`,
                assignedLab: stageLab.id,
                status: 'COMPLETED',
                receptionDate: new Date('2026-09-05T08:00:00Z'),
                updatedAt: new Date()
            }
        });
    });

    test('4. Analytical progress denominator excludes closure tasks (ARCHIVING) and counts SUBMITTED work with READY_FOR_REVIEW badge', async () => {
        const res = await request(app)
            .get('/api/dashboard/home')
            .set('Authorization', `Bearer ${stageManagerToken}`);

        expect(res.status).toBe(200);
        const oversight = res.body.progressOverview?.oversight;
        expect(Array.isArray(oversight)).toBe(true);

        const reviewItem = oversight.find(s => s.sampleId === sampleReview.id);
        expect(reviewItem).toBeDefined();
        // Total must be 2 (PH_H2O and EC_1_5; ARCHIVING must be excluded)
        expect(reviewItem.total).toBe(2);
        // Completed must be 2 (both SUBMITTED items count as completed determinations)
        expect(reviewItem.completed).toBe(2);
        expect(reviewItem.progress).toBe(100);
        expect(reviewItem.readiness).toBe('READY_FOR_REVIEW');
        expect(reviewItem.isReady).toBe(true);
    });

    test('5. Already ACCEPTED sample displays READY_FOR_APPROVAL badge (not READY_FOR_REVIEW) and excludes DISPOSAL from denominator', async () => {
        const res = await request(app)
            .get('/api/dashboard/home')
            .set('Authorization', `Bearer ${stageManagerToken}`);

        expect(res.status).toBe(200);
        const oversight = res.body.progressOverview?.oversight;
        const approvalItem = oversight.find(s => s.sampleId === sampleApproval.id);
        expect(approvalItem).toBeDefined();

        // Total must be 2 (PH_H2O and EC_1_5; DISPOSAL excluded)
        expect(approvalItem.total).toBe(2);
        expect(approvalItem.completed).toBe(2);
        expect(approvalItem.accepted).toBe(2);
        expect(approvalItem.progress).toBe(100);
        // Lifecycle badge must be READY_FOR_APPROVAL, never READY_FOR_REVIEW
        expect(approvalItem.readiness).toBe('READY_FOR_APPROVAL');
        expect(approvalItem.readiness).not.toBe('READY_FOR_REVIEW');
        expect(approvalItem.isReady).toBe(true);
    });

    test('6. Mutually exclusive stage partitioning classifies candidates with strict precedence (FINAL_APPROVAL > AWAITING_REVIEW > IN_PROGRESS)', async () => {
        const res = await request(app)
            .get('/api/dashboard/home')
            .set('Authorization', `Bearer ${stageManagerToken}`);

        expect(res.status).toBe(200);
        const stageCounts = res.body.progressOverview?.stageCounts;
        expect(stageCounts).toBeDefined();

        // The 3 active PROCESSING candidates must be partitioned without double-counting:
        // - sampleApproval -> finalApproval (1)
        // - sampleReview   -> awaitingReview (1)
        // - sampleBench    -> inProgress (1)
        expect(stageCounts.finalApproval).toBe(1);
        expect(stageCounts.awaitingReview).toBe(1);
        expect(stageCounts.inProgress).toBe(1);

        // Neither sampleApproval nor sampleReview can double-count into inProgress
        expect(stageCounts.inProgress + stageCounts.awaitingReview + stageCounts.finalApproval).toBe(3);
    });

    test('7. Stage 5 Completed population counts authoritative approvedAt today, ignoring updatedAt', async () => {
        const res = await request(app)
            .get('/api/dashboard/home')
            .set('Authorization', `Bearer ${stageManagerToken}`);

        expect(res.status).toBe(200);
        const stageCounts = res.body.progressOverview?.stageCounts;

        // Completed population includes: sampleApprovedToday, sampleApprovedPast, sampleCompletedNoApprovedAt
        expect(stageCounts.completed).toBe(3);

        // approvedToday must ONLY count sampleApprovedToday (approvedAt today)
        // sampleApprovedPast (approvedAt in past) and sampleCompletedNoApprovedAt (null approvedAt) must be excluded
        // even though both have updatedAt set to today!
        expect(stageCounts.approvedToday).toBe(1);
    });

    test('8. Destination population contract matches Stage 5 route (/samples?status=SUBMITTED_FULL,APPROVED)', async () => {
        const res = await request(app)
            .get('/api/samples')
            .query({ status: 'SUBMITTED_FULL,APPROVED' })
            .set('Authorization', `Bearer ${stageManagerToken}`);

        expect(res.status).toBe(200);
        const samples = res.body.samples || res.body.data || res.body;
        expect(Array.isArray(samples)).toBe(true);

        const sampleIds = samples.map(s => s.id);
        // Must contain approved samples from stageLab
        expect(sampleIds).toContain(sampleApprovedToday.id);
        expect(sampleIds).toContain(sampleApprovedPast.id);

        // Must NOT contain active processing specimens
        expect(sampleIds).not.toContain(sampleReview.id);
        expect(sampleIds).not.toContain(sampleApproval.id);
        expect(sampleIds).not.toContain(sampleBench.id);
    });
});
