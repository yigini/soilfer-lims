const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const prisma = require('../../prisma');
const draftService = require('../../services/draftService');

describe('Issue #128: Workbench Deep Link Contract', () => {
    let techAToken, techBToken, mgrAToken;
    const labAId = 'LAB-DEEP-A';
    const labBId = 'LAB-DEEP-B';

    let sampleA, sampleB;
    let workItemAActive, workItemACompleted, workItemB;

    beforeAll(async () => {
        techAToken = await getAuthToken('LAB_TECHNICIAN', labAId, ['GTM'], ['ENTER_RESULTS']);
        techBToken = await getAuthToken('LAB_TECHNICIAN', labBId, ['GTM'], ['ENTER_RESULTS']);
        mgrAToken = await getAuthToken('LAB_MANAGER', labAId, ['GTM'], ['ENTER_RESULTS', 'APPROVE_RESULTS']);

        const techAUsername = 'test_lab_technician_labdeepa';
        const techBUsername = 'test_lab_technician_labdeepb';

        // Ensure analyses exist
        await prisma.analysis.upsert({
            where: { code: 'SOC' },
            update: { name: 'Soil Organic Carbon', units: 'g/kg', status: 'active' },
            create: { code: 'SOC', name: 'Soil Organic Carbon', units: 'g/kg', status: 'active' }
        });
        await prisma.analysis.upsert({
            where: { code: 'PH' },
            update: { name: 'Soil pH in Water', units: 'pH units', status: 'active' },
            create: { code: 'PH', name: 'Soil pH in Water', units: 'pH units', status: 'active' }
        });

        const ts = Date.now();

        // Create Sample A (Lab A)
        sampleA = await prisma.sample.create({
            data: {
                id: `SMP-DEEP-A-${ts}`,
                labId: `LAB-A-${ts}`,
                originalId: `FIELD-A-${ts}`,
                assignedLab: labAId,
                status: 'ACCEPTED',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        // Create Sample B (Lab B)
        sampleB = await prisma.sample.create({
            data: {
                id: `SMP-DEEP-B-${ts}`,
                labId: `LAB-B-${ts}`,
                originalId: `FIELD-B-${ts}`,
                assignedLab: labBId,
                status: 'ACCEPTED',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        // Create Sample A2 (Lab A)
        sampleA2 = await prisma.sample.create({
            data: {
                id: `SMP-DEEP-A2-${ts}`,
                labId: `LAB-A2-${ts}`,
                originalId: `FIELD-A2-${ts}`,
                assignedLab: labAId,
                status: 'ACCEPTED',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        // Work Item 1 (Sample A, ASSIGNED to techA)
        workItemAActive = await prisma.workItem.create({
            data: {
                id: `WI-A-ACT-${ts}`,
                sampleId: sampleA.id,
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: techAUsername,
                labId: labAId,
                version: 1
            }
        });

        // Work Item 2 (Sample A, COMPLETED, outside default 'my_work' view)
        workItemACompleted = await prisma.workItem.create({
            data: {
                id: `WI-A-COMP-${ts}`,
                sampleId: sampleA.id,
                analysis: 'PH',
                status: 'COMPLETED',
                assignedTo: techAUsername,
                labId: labAId,
                version: 1
            }
        });

        // Work Item 3 (Sample B, Lab B)
        workItemB = await prisma.workItem.create({
            data: {
                id: `WI-B-ACT-${ts}`,
                sampleId: sampleB.id,
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: techBUsername,
                labId: labBId,
                version: 1
            }
        });
    });

    test('1. Valid deep link with workItemId and matching sampleId resolves and includes item in queue', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                workItemId: workItemAActive.id,
                sampleId: sampleA.id
            });

        expect(res.status).toBe(200);
        expect(res.body.groups).toBeDefined();

        const allItems = res.body.groups.flatMap(g => g.items);
        const resolved = allItems.find(i => i.id === workItemAActive.id);
        expect(resolved).toBeDefined();
        expect(resolved.sampleId).toBe(sampleA.id);
        expect(resolved.analysis).toBe('SOC');
    });

    test('2. Valid deep link for an item with COMPLETED status outside default view resolves successfully', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                workItemId: workItemACompleted.id
            });

        expect(res.status).toBe(200);
        const allItems = res.body.groups.flatMap(g => g.items);
        const resolved = allItems.find(i => i.id === workItemACompleted.id);
        expect(resolved).toBeDefined();
        expect(resolved.status).toBe('COMPLETED');
        expect(resolved.analysis).toBe('PH');
    });

    test('3. Contradictory identifiers: workItemId does not belong to sampleId returns 400 CONTRADICTORY_IDENTIFIERS', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                workItemId: workItemAActive.id,
                sampleId: sampleA2.id // Sample A2 is in Lab A (authorized) but does not own workItemAActive
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('CONTRADICTORY_IDENTIFIERS');
        expect(res.body.message).toContain(workItemAActive.id);
        expect(res.body.message).toContain(sampleA2.id);
    });

    test('4. Cross-lab access denial: Lab A technician requesting Lab B work item returns 403 without leaking details', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                workItemId: workItemB.id
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
        expect(res.body.groups).toBeUndefined();
    });

    test('5. Non-existent work item returns 404 WORK_ITEM_NOT_FOUND', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                workItemId: 'NON_EXISTENT_WI_99999'
            });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('WORK_ITEM_NOT_FOUND');
    });

    test('6. Non-existent sample returns 404 SAMPLE_NOT_FOUND when sampleId alone is queried', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                sampleId: 'NON_EXISTENT_SMP_99999'
            });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('SAMPLE_NOT_FOUND');
    });

    test('7. Another technician assignment in same lab returns 403 FORBIDDEN', async () => {
        const ts = Date.now();
        const techCUsername = `tech_c_${ts}`;
        await prisma.user.create({
            data: {
                id: `usr-tech-c-${ts}`,
                username: techCUsername,
                email: `tech_c_${ts}@soilfer.org`,
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labAId,
                isActive: true
            }
        });

        const workItemTechC = await prisma.workItem.create({
            data: {
                id: `WI-A-TECHC-${ts}`,
                sampleId: sampleA.id,
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: techCUsername,
                labId: labAId,
                version: 1
            }
        });

        // techA tries to access Tech C's work item in the same lab
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                workItemId: workItemTechC.id
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
    });

    test('8. Out-of-country MASTER_USER returns 403 FORBIDDEN', async () => {
        // Master user with Honduras access only tries to access Guatemala sample
        const masterHndToken = await getAuthToken('MASTER_USER', null, ['HND'], ['APPROVE_RESULTS']);

        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${masterHndToken}`)
            .query({
                workItemId: workItemAActive.id,
                sampleId: sampleA.id
            });

        expect(res.status).toBe(403);
    });

    test('9. Role with missing lab returns 403 FORBIDDEN', async () => {
        const noLabTechToken = await getAuthToken('LAB_TECHNICIAN', null, ['GTM'], ['ENTER_RESULTS']);

        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${noLabTechToken}`)
            .query({
                workItemId: workItemAActive.id
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
    });

    test('10. Inactive user fails closed with 401 or 403', async () => {
        const ts = Date.now();
        const inactiveUsername = `inactive_tech_${ts}`;
        await prisma.user.create({
            data: {
                id: `usr-inactive-${ts}`,
                username: inactiveUsername,
                email: `inactive_${ts}@soilfer.org`,
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labAId,
                isActive: false
            }
        });

        const jwt = require('jsonwebtoken');
        const inactiveToken = jwt.sign(
            { id: `usr-inactive-${ts}`, username: inactiveUsername, role: 'LAB_TECHNICIAN', labId: labAId, isActive: false },
            process.env.JWT_SECRET || 'secret'
        );

        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${inactiveToken}`)
            .query({
                workItemId: workItemAActive.id
            });

        expect([401, 403]).toContain(res.status);
    });

    test('11. Conflicting sample/work-item laboratories return 403 FORBIDDEN for lab technician', async () => {
        const ts = Date.now();
        // Sample is assigned to Lab B, but WorkItem is assigned to Lab A
        const conflictingWI = await prisma.workItem.create({
            data: {
                id: `WI-CONFLICT-${ts}`,
                sampleId: sampleB.id, // sampleB is in Lab B
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: 'test_lab_technician_labdeepa',
                labId: labAId, // workItem is in Lab A
                version: 1
            }
        });

        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                workItemId: conflictingWI.id
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
    });

    test('12. Authorization check strictly precedes contradictory identifier diagnostics', async () => {
        // techA (Lab A) requests workItemB (Lab B) with sampleA.id (Lab A).
        // Since techA is unauthorized for workItemB, it must return 403 FORBIDDEN, NOT 400 CONTRADICTORY_IDENTIFIERS.
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                workItemId: workItemB.id,
                sampleId: sampleA.id
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
    });

    test('13. Ambiguous cross-column sample identifier returns 400 AMBIGUOUS_SAMPLE_IDENTIFIER', async () => {
        const ts = Date.now();
        const collisionId = `COLLIDE-${ts}`;

        // Sample 1 has id = collisionId
        await prisma.sample.create({
            data: {
                id: collisionId,
                labId: `LAB-COL-1-${ts}`,
                originalId: `ORIG-COL-1-${ts}`,
                assignedLab: labAId,
                status: 'ACCEPTED',
                projectCode: 'GTM-SOIL-01'
            }
        });

        // Sample 2 has originalId = collisionId
        await prisma.sample.create({
            data: {
                id: `SMP-COL-2-${ts}`,
                labId: `LAB-COL-2-${ts}`,
                originalId: collisionId,
                assignedLab: labAId,
                status: 'ACCEPTED',
                projectCode: 'GTM-SOIL-01'
            }
        });

        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                sampleId: collisionId
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('AMBIGUOUS_SAMPLE_IDENTIFIER');
    });

    test('14. Realistic specimen code deep link (Issue #128): sample.labId and workItem.labId hold specimen identifier while assignedLab holds facility', async () => {
        const ts = Date.now();
        const specimenCode = `GHA0816-1-1C-S-${ts}`;
        const workItemId = `WI-1789634536044-167-${ts}`;
        const techAUsername = 'test_lab_technician_labdeepa';

        const sampleReal = await prisma.sample.create({
            data: {
                id: specimenCode,
                labId: specimenCode,
                originalId: `FIELD-${specimenCode}`,
                assignedLab: labAId,
                status: 'SUBMITTED_PARTIAL',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        const workItemReal = await prisma.workItem.create({
            data: {
                id: workItemId,
                sampleId: sampleReal.id,
                labId: specimenCode,
                assignedLab: labAId,
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: techAUsername,
                version: 1
            }
        });

        // Request deep link using workItemId and specimenCode
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                workItemId: workItemId,
                sampleId: specimenCode
            });

        expect(res.status).toBe(200);
        expect(res.body.targetScopedItem).toBe(workItemId);
        const allItems = res.body.groups.flatMap(g => g.items);
        const found = allItems.find(i => i.id === workItemId);
        expect(found).toBeDefined();
        expect(found.sampleId).toBe(specimenCode);
        expect(found.laboratoryId).toBe(labAId);
        expect(found.analysis).toBe('SOC');
    });

    test('15. Realistic specimen code deep link cross-lab rejection: Lab A tech requesting Lab B specimen code returns 403', async () => {
        const ts = Date.now();
        const specimenCodeB = `GHA-CROSS-B-${ts}`;
        const workItemIdB = `WI-CROSS-B-${ts}`;
        const techBUsername = 'test_lab_technician_labdeepb';

        const sampleRealB = await prisma.sample.create({
            data: {
                id: specimenCodeB,
                labId: specimenCodeB,
                originalId: `FIELD-${specimenCodeB}`,
                assignedLab: labBId,
                status: 'SUBMITTED_PARTIAL',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        await prisma.workItem.create({
            data: {
                id: workItemIdB,
                sampleId: sampleRealB.id,
                labId: specimenCodeB,
                assignedLab: labBId,
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: techBUsername,
                version: 1
            }
        });

        // Tech A in Lab A attempts to access Tech B's item in Lab B
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                workItemId: workItemIdB,
                sampleId: specimenCodeB
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
    });

    test('16. Specimen labId alone resolves assigned work item in technician lab', async () => {
        const ts = Date.now();
        const specimenCodeAlone = `SMP-ALONE-${ts}`;
        const workItemIdAlone = `WI-ALONE-${ts}`;
        const techAUsername = 'test_lab_technician_labdeepa';

        await prisma.sample.create({
            data: {
                id: specimenCodeAlone,
                labId: specimenCodeAlone,
                originalId: `FIELD-${specimenCodeAlone}`,
                assignedLab: labAId,
                status: 'SUBMITTED_PARTIAL',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        await prisma.workItem.create({
            data: {
                id: workItemIdAlone,
                sampleId: specimenCodeAlone,
                labId: specimenCodeAlone,
                assignedLab: labAId,
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: techAUsername,
                version: 1
            }
        });

        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({
                sampleId: specimenCodeAlone
            });

        expect(res.status).toBe(200);
        const allItems = res.body.groups.flatMap(g => g.items);
        const found = allItems.find(i => i.id === workItemIdAlone);
        expect(found).toBeDefined();
    });

    test('17. Foreign work-item laboratory conflict: technician in Lab A cannot save draft via HTTP batch-save when workItem.assignedLab is Lab B even if workItem.labId is Lab A, with zero mutation', async () => {
        const ts = Date.now();
        const techAUsername = 'test_lab_technician_labdeepa';

        const sampleForItem = await prisma.sample.create({
            data: {
                id: `SMP-FOR-ITEM-${ts}`,
                labId: labAId,
                originalId: `FIELD-FOR-ITEM-${ts}`,
                assignedLab: labAId,
                status: 'ACCEPTED',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        const wiForeignItem = await prisma.workItem.create({
            data: {
                id: `WI-FOR-ITEM-${ts}`,
                sampleId: sampleForItem.id,
                analysis: 'PH',
                status: 'ASSIGNED',
                assignedTo: techAUsername,
                labId: labAId, // matching legacy labId
                assignedLab: labBId, // explicit foreign facility!
                version: 1
            }
        });

        const res = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techAToken}`)
            .send({
                draft: true,
                entries: [{
                    workItemId: wiForeignItem.id,
                    value: '6.5',
                    version: 1
                }]
            });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.saved).toBe(0);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors.length).toBe(1);
        expect(res.body.errors[0].workItemId).toBe(wiForeignItem.id);
        expect(res.body.errors[0].code).toBe('OUT_OF_SCOPE');
        expect(res.body.errors[0].error).toContain('Access denied: Work item is in another laboratory');

        // Zero mutation verification
        const draftInDb = await prisma.workItemDraft.findFirst({
            where: { workItemId: wiForeignItem.id }
        });
        expect(draftInDb).toBeNull();

        const wiInDb = await prisma.workItem.findUnique({
            where: { id: wiForeignItem.id }
        });
        expect(wiInDb.status).toBe('ASSIGNED');
        expect(wiInDb.version).toBe(1);
        expect(wiInDb.result).toBeNull();
    });

    test('18. Foreign sample laboratory conflict: technician in Lab A cannot save draft via HTTP batch-save when sample.assignedLab is Lab B even if sample.labId is Lab A, with zero mutation', async () => {
        const ts = Date.now();
        const techAUsername = 'test_lab_technician_labdeepa';

        const sampleForSample = await prisma.sample.create({
            data: {
                id: `SMP-FOR-SMP-${ts}`,
                labId: labAId, // matching legacy labId
                originalId: `FIELD-FOR-SMP-${ts}`,
                assignedLab: labBId, // explicit foreign facility!
                status: 'ACCEPTED',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        const wiForeignSample = await prisma.workItem.create({
            data: {
                id: `WI-FOR-SMP-${ts}`,
                sampleId: sampleForSample.id,
                analysis: 'PH',
                status: 'ASSIGNED',
                assignedTo: techAUsername,
                labId: labAId,
                assignedLab: labAId,
                version: 1
            }
        });

        const res = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techAToken}`)
            .send({
                draft: true,
                entries: [{
                    workItemId: wiForeignSample.id,
                    value: '6.5',
                    version: 1
                }]
            });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.saved).toBe(0);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors.length).toBe(1);
        expect(res.body.errors[0].workItemId).toBe(wiForeignSample.id);
        expect(res.body.errors[0].code).toBe('OUT_OF_SCOPE');
        expect(res.body.errors[0].error).toContain('Access denied: Sample is in another laboratory');

        // Zero mutation verification
        const draftInDb = await prisma.workItemDraft.findFirst({
            where: { workItemId: wiForeignSample.id }
        });
        expect(draftInDb).toBeNull();

        const wiInDb = await prisma.workItem.findUnique({
            where: { id: wiForeignSample.id }
        });
        expect(wiInDb.status).toBe('ASSIGNED');
        expect(wiInDb.version).toBe(1);
        expect(wiInDb.result).toBeNull();
    });

    test('19. Direct draftService enforcement rejects foreign-item and foreign-sample draft save and access', async () => {
        const ts = Date.now();
        const techAUsername = 'test_lab_technician_labdeepa';

        // 1. Foreign-item
        const sample1 = await prisma.sample.create({
            data: {
                id: `SMP-DIR-FOR-ITEM-${ts}`,
                labId: labAId,
                originalId: `FIELD-DIR-FOR-ITEM-${ts}`,
                assignedLab: labAId,
                status: 'ACCEPTED',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        const wi1 = await prisma.workItem.create({
            data: {
                id: `WI-DIR-FOR-ITEM-${ts}`,
                sampleId: sample1.id,
                analysis: 'PH',
                status: 'ASSIGNED',
                assignedTo: techAUsername,
                labId: labAId,
                assignedLab: labBId,
                version: 1
            }
        });

        // 2. Foreign-sample
        const sample2 = await prisma.sample.create({
            data: {
                id: `SMP-DIR-FOR-SMP-${ts}`,
                labId: labAId,
                originalId: `FIELD-DIR-FOR-SMP-${ts}`,
                assignedLab: labBId,
                status: 'ACCEPTED',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        const wi2 = await prisma.workItem.create({
            data: {
                id: `WI-DIR-FOR-SMP-${ts}`,
                sampleId: sample2.id,
                analysis: 'PH',
                status: 'ASSIGNED',
                assignedTo: techAUsername,
                labId: labAId,
                assignedLab: labAId,
                version: 1
            }
        });

        const userA = {
            id: 'user-tech-a-test',
            username: techAUsername,
            role: 'LAB_TECHNICIAN',
            labId: labAId
        };

        await expect(draftService.saveDraft(userA, {
            workItemId: wi1.id,
            value: '6.5'
        })).rejects.toThrow(/Access denied.*laboratory/);

        await expect(draftService.saveDraft(userA, {
            workItemId: wi2.id,
            value: '6.5'
        })).rejects.toThrow(/Access denied.*laboratory/);
    });

    test('20. Positive specimen compatibility: technician in Lab A successfully saves draft for work item with specimen labId and assignedLab Lab A, advancing status to IN_PROGRESS', async () => {
        const ts = Date.now();
        const techAUsername = 'test_lab_technician_labdeepa';
        const specimenCode = `GHA0816-COMPAT-${ts}`;

        const sampleCompat = await prisma.sample.create({
            data: {
                id: specimenCode,
                labId: specimenCode, // Specimen code in labId
                originalId: `FIELD-${specimenCode}`,
                assignedLab: labAId, // Facility assignment in assignedLab
                status: 'ACCEPTED',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                projectCode: 'GTM-SOIL-01'
            }
        });

        const wiCompat = await prisma.workItem.create({
            data: {
                id: `WI-COMPAT-${ts}`,
                sampleId: sampleCompat.id,
                analysis: 'PH',
                status: 'ASSIGNED',
                assignedTo: techAUsername,
                labId: specimenCode, // Specimen code in labId
                assignedLab: labAId, // Facility assignment in assignedLab
                version: 1
            }
        });

        const res = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techAToken}`)
            .send({
                draft: true,
                entries: [{
                    workItemId: wiCompat.id,
                    value: '6.8',
                    version: 1
                }]
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.saved).toBe(1);
        expect(res.body.results[0].status).toBe('drafted');

        // Verify DB mutation occurred as expected
        const draftInDb = await prisma.workItemDraft.findFirst({
            where: { workItemId: wiCompat.id }
        });
        expect(draftInDb).not.toBeNull();
        expect(draftInDb.value).toBe('6.8');

        const wiInDb = await prisma.workItem.findUnique({
            where: { id: wiCompat.id }
        });
        expect(wiInDb.status).toBe('IN_PROGRESS');
    });
});
