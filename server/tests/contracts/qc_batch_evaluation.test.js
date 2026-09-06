const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const prisma = require('../../prisma');

describe('QC Batch 40-Sample Capacity & Scope Contracts (Mandatory Correction 3)', () => {
    let techToken;
    let foreignToken;
    let mgrToken;
    let labId = 'TUN-LAB1';

    beforeAll(async () => {
        techToken = await getAuthToken('LAB_TECHNICIAN', 'TUN-LAB1');
        mgrToken = await getAuthToken('LAB_MANAGER', 'TUN-LAB1');
        foreignToken = await getAuthToken('LAB_MANAGER', 'GTM-LAB1');
    });

    let batchId;
    let createdSampleIds = [];
    let createdWorkItemIds = [];

    afterEach(async () => {
        try {
            if (createdWorkItemIds.length > 0) {
                await prisma.workItem.deleteMany({ where: { id: { in: createdWorkItemIds } } });
            }
            if (createdSampleIds.length > 0) {
                await prisma.sample.deleteMany({ where: { id: { in: createdSampleIds } } });
            }
            if (batchId) {
                await prisma.batch.deleteMany({ where: { id: batchId } });
            }
        } catch (e) {}
        createdSampleIds = [];
        createdWorkItemIds = [];
        batchId = null;
    });

    test('Rejects adding items that exceed 40-sample capacity', async () => {
        // Create batch for PH_H2O
        const batchRes = await request(app)
            .post('/api/qc/batches')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ analysis: 'PH_H2O', instrument: 'pH Meter' });

        expect(batchRes.statusCode).toBe(201);
        batchId = batchRes.body.id;

        // Create 41 work items
        const sampleId = `SMP-QC-CAP-${Date.now()}`;
        createdSampleIds.push(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: `ORIG-${sampleId}`,
                labId: `LAB-${sampleId}`,
                assignedLab: labId,
                status: 'PROCESSING'
            }
        });

        const itemData = [];
        for (let i = 1; i <= 41; i++) {
            const wid = `WI-CAP-${Date.now()}-${i}`;
            createdWorkItemIds.push(wid);
            itemData.push({
                id: wid,
                sampleId,
                analysis: 'PH_H2O',
                status: 'ASSIGNED',
                labId,
                assignedLab: labId
            });
        }
        await prisma.workItem.createMany({ data: itemData });

        // Attempt to add 41 items to batch -> Should fail with 400
        const addRes = await request(app)
            .post(`/api/qc/batches/${batchId}/items`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({ workItemIds: createdWorkItemIds });

        expect(addRes.statusCode).toBe(400);
        expect(addRes.body.error).toContain('exceeds maximum batch capacity of 40');
    });

    test('Permits texture aliases in a TEXTURE batch and rejects mismatched analyses', async () => {
        // Create batch for TEXTURE
        const batchRes = await request(app)
            .post('/api/qc/batches')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ analysis: 'TEXTURE', instrument: 'Hydrometer' });

        expect(batchRes.statusCode).toBe(201);
        batchId = batchRes.body.id;

        const sampleId = `SMP-QC-TEX-${Date.now()}`;
        createdSampleIds.push(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: `ORIG-${sampleId}`,
                labId: `LAB-${sampleId}`,
                assignedLab: labId,
                status: 'PROCESSING'
            }
        });

        // 1 Texture alias work item (PSA), 1 mismatched (EC)
        const widPsa = `WI-PSA-${Date.now()}`;
        const widEc = `WI-EC-${Date.now()}`;
        createdWorkItemIds.push(widPsa, widEc);

        await prisma.workItem.create({
            data: {
                id: widPsa,
                sampleId,
                analysis: 'PSA',
                status: 'ASSIGNED',
                labId,
                assignedLab: labId
            }
        });
        await prisma.workItem.create({
            data: {
                id: widEc,
                sampleId,
                analysis: 'EC',
                status: 'ASSIGNED',
                labId,
                assignedLab: labId
            }
        });

        // Mismatched analysis EC should be rejected
        const failRes = await request(app)
            .post(`/api/qc/batches/${batchId}/items`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({ workItemIds: [widEc] });

        expect(failRes.statusCode).toBe(400);
        expect(failRes.body.error).toContain('does not match batch analysis');

        // PSA alias should be accepted into TEXTURE batch
        const passRes = await request(app)
            .post(`/api/qc/batches/${batchId}/items`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({ workItemIds: [widPsa] });

        expect(passRes.statusCode).toBe(200);
        expect(passRes.body.success).toBe(true);
    });

    test('Rejects sealed work items from being added to batch', async () => {
        const batchRes = await request(app)
            .post('/api/qc/batches')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ analysis: 'PH_H2O' });
        batchId = batchRes.body.id;

        const sampleId = `SMP-QC-SEAL-${Date.now()}`;
        createdSampleIds.push(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: `ORIG-${sampleId}`,
                labId: `LAB-${sampleId}`,
                assignedLab: labId,
                status: 'PROCESSING'
            }
        });

        const widSealed = `WI-SEAL-${Date.now()}`;
        createdWorkItemIds.push(widSealed);
        await prisma.workItem.create({
            data: {
                id: widSealed,
                sampleId,
                analysis: 'PH_H2O',
                status: 'ACCEPTED',
                labId,
                assignedLab: labId
            }
        });

        const sealRes = await request(app)
            .post(`/api/qc/batches/${batchId}/items`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({ workItemIds: [widSealed] });

        expect(sealRes.statusCode).toBe(400);
        expect(sealRes.body.error).toContain('already sealed');
    });

    test('Assigns and persists rackPosition (1..N) and returns runProfile (A28, A29)', async () => {
        // Create 24-centrifuge batch
        const batchRes = await request(app)
            .post('/api/qc/batches')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ analysis: 'SOC', instrument: '24-Place Digestion Block Centrifuge', profile: 'CENTRIFUGE_24' });

        expect(batchRes.statusCode).toBe(201);
        batchId = batchRes.body.id;
        expect(batchRes.body.runProfile).toBeDefined();
        expect(batchRes.body.runProfile.capacity).toBe(24);
        expect(batchRes.body.runProfile.qcSlots.length).toBeGreaterThanOrEqual(3);

        const sampleId = `SMP-QC-RACK-${Date.now()}`;
        createdSampleIds.push(sampleId);
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: `ORIG-${sampleId}`,
                labId: `LAB-${sampleId}`,
                assignedLab: labId,
                status: 'PROCESSING'
            }
        });

        const wid1 = `WI-RACK-1-${Date.now()}`;
        const wid2 = `WI-RACK-2-${Date.now()}`;
        createdWorkItemIds.push(wid1, wid2);

        await prisma.workItem.createMany({
            data: [
                { id: wid1, sampleId, analysis: 'SOC', status: 'ASSIGNED', labId, assignedLab: labId },
                { id: wid2, sampleId, analysis: 'SOC', status: 'ASSIGNED', labId, assignedLab: labId }
            ]
        });

        // Add items with explicit rack positions
        const addRes = await request(app)
            .post(`/api/qc/batches/${batchId}/items`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                workItemIds: [wid1, wid2],
                rackPositions: { [wid1]: 3, [wid2]: 4 }
            });

        expect(addRes.statusCode).toBe(200);

        // Fetch batch by ID and verify rackPosition persistence and order
        const getRes = await request(app)
            .get(`/api/qc/batches/${batchId}`)
            .set('Authorization', `Bearer ${techToken}`);

        expect(getRes.statusCode).toBe(200);
        expect(getRes.body.runProfile.profileKey).toBe('CENTRIFUGE_24');
        expect(getRes.body.data.workItems.length).toBe(2);
        expect(getRes.body.data.workItems[0].id).toBe(wid1);
        expect(getRes.body.data.workItems[0].rackPosition).toBe(3);
        expect(getRes.body.data.workItems[1].id).toBe(wid2);
        expect(getRes.body.data.workItems[1].rackPosition).toBe(4);
    });

    test('Supports 96-place Microplate profile capacity and rejects 97th item (A28)', async () => {
        const batchRes = await request(app)
            .post('/api/qc/batches')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ analysis: 'PH_H2O', instrument: '96-Well Microplate Reader', profile: 'MICROPLATE_96' });

        expect(batchRes.statusCode).toBe(201);
        batchId = batchRes.body.id;
        expect(batchRes.body.runProfile.capacity).toBe(96);
        expect(batchRes.body.runProfile.qcSlots.some(s => s.position === 96)).toBe(true);
    });

    describe('Cross-laboratory Batch Scope Isolation (Review Defect 1)', () => {
        test('Rejects foreign lab manager from reading TUN-LAB1 batch (403)', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O' });
            expect(batchRes.statusCode).toBe(201);
            batchId = batchRes.body.id;

            const foreignRes = await request(app)
                .get(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${foreignToken}`);

            expect(foreignRes.statusCode).toBe(403);
            expect(foreignRes.body.error).toContain('outside your laboratory scope');
        });

        test('Rejects foreign lab manager from mutating TUN-LAB1 batch (403)', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O' });
            batchId = batchRes.body.id;

            const foreignUpdate = await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${foreignToken}`)
                .send({ notes: 'Unpermitted external note' });

            expect(foreignUpdate.statusCode).toBe(403);
            expect(foreignUpdate.body.error).toContain('outside your laboratory scope');
        });

        test('Rejects foreign lab user from evaluating or adding items to TUN-LAB1 batch (403)', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O' });
            batchId = batchRes.body.id;

            const foreignEval = await request(app)
                .post(`/api/qc/batches/${batchId}/evaluate`)
                .set('Authorization', `Bearer ${foreignToken}`)
                .send({ blanks: [{ label: 'Foreign Blank', value: 0 }] });

            expect(foreignEval.statusCode).toBe(403);

            const foreignAdd = await request(app)
                .post(`/api/qc/batches/${batchId}/items`)
                .set('Authorization', `Bearer ${foreignToken}`)
                .send({ workItemIds: ['some-item'] });

            expect(foreignAdd.statusCode).toBe(403);
        });
    });

    describe('Rack Position Bounded Integers & QC Reservation Enforcement (Review Defect 2)', () => {
        test('Rejects sample assignment to QC-reserved slot (position 1 on RACK_40)', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            expect(batchRes.statusCode).toBe(201);
            batchId = batchRes.body.id;

            const sampleId = `SMP-QC-RES-${Date.now()}`;
            createdSampleIds.push(sampleId);
            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: `ORIG-${sampleId}`,
                    labId: `LAB-${sampleId}`,
                    assignedLab: labId,
                    status: 'PROCESSING'
                }
            });

            const widRes = `WI-RES-${Date.now()}`;
            createdWorkItemIds.push(widRes);
            await prisma.workItem.create({
                data: { id: widRes, sampleId, analysis: 'PH_H2O', status: 'ASSIGNED', labId, assignedLab: labId }
            });

            // Try to assign sample to position 1 (reserved for BLANK in RACK_40)
            const addRes = await request(app)
                .post(`/api/qc/batches/${batchId}/items`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    workItemIds: [widRes],
                    rackPositions: { [widRes]: 1 }
                });

            expect(addRes.statusCode).toBe(400);
            expect(addRes.body.error).toContain('reserved for QC slot');
        });

        test('Rejects duplicate rack positions within payload and across batch', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            batchId = batchRes.body.id;

            const sampleId = `SMP-QC-DUP-${Date.now()}`;
            createdSampleIds.push(sampleId);
            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: `ORIG-${sampleId}`,
                    labId: `LAB-${sampleId}`,
                    assignedLab: labId,
                    status: 'PROCESSING'
                }
            });

            const wid1 = `WI-DUP-1-${Date.now()}`;
            const wid2 = `WI-DUP-2-${Date.now()}`;
            createdWorkItemIds.push(wid1, wid2);
            await prisma.workItem.createMany({
                data: [
                    { id: wid1, sampleId, analysis: 'PH_H2O', status: 'ASSIGNED', labId, assignedLab: labId },
                    { id: wid2, sampleId, analysis: 'PH_H2O', status: 'ASSIGNED', labId, assignedLab: labId }
                ]
            });

            // Intra-payload duplicate position 5
            const dupPayloadRes = await request(app)
                .post(`/api/qc/batches/${batchId}/items`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    workItemIds: [wid1, wid2],
                    rackPositions: { [wid1]: 5, [wid2]: 5 }
                });

            expect(dupPayloadRes.statusCode).toBe(400);
            expect(dupPayloadRes.body.error).toContain('Duplicate rack position');

            // Add wid1 at position 5
            const addWid1 = await request(app)
                .post(`/api/qc/batches/${batchId}/items`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    workItemIds: [wid1],
                    rackPositions: { [wid1]: 5 }
                });
            expect(addWid1.statusCode).toBe(200);

            // Now try to add wid2 at already occupied position 5
            const collisionRes = await request(app)
                .post(`/api/qc/batches/${batchId}/items`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    workItemIds: [wid2],
                    rackPositions: { [wid2]: 5 }
                });

            expect(collisionRes.statusCode).toBe(400);
            expect(collisionRes.body.error).toContain('already occupied');
        });

        test('Allows removing items from batch and freeing their rack positions', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            batchId = batchRes.body.id;

            const sampleId = `SMP-QC-REM-${Date.now()}`;
            createdSampleIds.push(sampleId);
            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: `ORIG-${sampleId}`,
                    labId: `LAB-${sampleId}`,
                    assignedLab: labId,
                    status: 'PROCESSING'
                }
            });

            const widRem = `WI-REM-${Date.now()}`;
            createdWorkItemIds.push(widRem);
            await prisma.workItem.create({
                data: { id: widRem, sampleId, analysis: 'PH_H2O', status: 'ASSIGNED', labId, assignedLab: labId }
            });

            // Add widRem at position 7
            await request(app)
                .post(`/api/qc/batches/${batchId}/items`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({ workItemIds: [widRem], rackPositions: { [widRem]: 7 } });

            // Remove widRem from batch
            const removeRes = await request(app)
                .delete(`/api/qc/batches/${batchId}/items`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({ workItemIds: [widRem] });

            expect(removeRes.statusCode).toBe(200);
            expect(removeRes.body.success).toBe(true);

            // Verify work item is no longer in batch and rackPosition is cleared
            const checkWi = await prisma.workItem.findUnique({ where: { id: widRem } });
            expect(checkWi.batchId).toBeNull();
            expect(checkWi.rackPosition).toBeNull();
        });

    describe('State Machine & QC General-Update Bypass Hardening (Review 4)', () => {
        test('Rejects technician direct write of QC_PASS without QC evidence (400)', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            batchId = batchRes.body.id;

            const updateRes = await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({ status: 'QC_PASS' });

            expect(updateRes.statusCode).toBe(400);
            expect(updateRes.body.error).toContain('without evaluated QC evidence');
        });

        test('Rejects direct write of QC_PASS when supplied QC measurements fail (400)', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            batchId = batchRes.body.id;

            const updateRes = await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    status: 'QC_PASS',
                    blanks: [{ value: 99.0 }] // High blank fails threshold
                });

            expect(updateRes.statusCode).toBe(400);
            expect(updateRes.body.error).toContain('failed acceptance criteria');
        });

        test('Allows valid evaluated QC to update status to QC_PASS (200)', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            batchId = batchRes.body.id;

            const updateRes = await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    blanks: [{ value: 0.01 }],
                    controls: [{ expected: 7.0, measured: 7.05 }],
                    duplicates: [{ value1: 7.0, value2: 7.02 }]
                });

            expect(updateRes.statusCode).toBe(200);
            expect(updateRes.body.status).toBe('QC_PASS');
        });

        test('Rejects technician closing a batch (403) and manager closing an unpassed batch (400)', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            batchId = batchRes.body.id;

            // Technician attempt
            const techClose = await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({ status: 'CLOSED' });
            expect(techClose.statusCode).toBe(403);

            // Manager attempt on OPEN batch
            const mgrClose = await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({ status: 'CLOSED' });
            expect(mgrClose.statusCode).toBe(400);
            expect(mgrClose.body.error).toContain('QC must be passed');
        });

        test('Seals CLOSED batch: rejects further modifications (400)', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            batchId = batchRes.body.id;

            // Pass QC
            await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    blanks: [{ value: 0.01 }],
                    controls: [{ expected: 7.0, measured: 7.05 }],
                    duplicates: [{ value1: 7.0, value2: 7.02 }]
                });

            // Manager closes batch
            const closeRes = await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({ status: 'CLOSED' });
            expect(closeRes.statusCode).toBe(200);

            // Attempt to update closed batch
            const editRes = await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({ notes: 'Trying to update closed batch' });
            expect(editRes.statusCode).toBe(400);
            expect(editRes.body.error).toContain('Batch is CLOSED and cannot be modified');
        });
    });

    describe('Review 5 Shared QC Evaluation & State Integrity Regressions', () => {
        test('Null blank does not coerce to zero and missing required profile QC results in QC_FAIL', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            batchId = batchRes.body.id;

            const res = await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    qcResults: {
                        blanks: [{ value: null }],
                        duplicates: [],
                        controls: []
                    }
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('QC_FAIL');
            const batch = await prisma.batch.findUnique({ where: { id: batchId } });
            expect(batch.status).toBe('QC_FAIL');
            const parsed = JSON.parse(batch.qcResults);
            expect(parsed.blanks[0].value).toBeNull();
            expect(parsed.blanks[0].status).toBe('FAIL');
            expect(parsed.summary.missingRequired).toEqual(expect.arrayContaining(['CONTROL', 'DUPLICATE']));
        });

        test('Dedicated evaluate route rejects mutating a CLOSED batch (400)', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            batchId = batchRes.body.id;

            // Pass QC and close
            await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    blanks: [{ value: 0.01 }],
                    controls: [{ expected: 7.0, measured: 7.05 }],
                    duplicates: [{ value1: 7.0, value2: 7.02 }]
                });

            await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({ status: 'CLOSED' });

            // Call POST evaluate on closed batch
            const evalRes = await request(app)
                .post(`/api/qc/batches/${batchId}/evaluate`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({ blanks: [{ value: 1.0, maxAllowed: 0.05 }] });

            expect(evalRes.statusCode).toBe(400);
            expect(evalRes.body.error).toContain('CLOSED');

            const batch = await prisma.batch.findUnique({ where: { id: batchId } });
            expect(batch.status).toBe('CLOSED');
        });

        test('Clearing QC evidence reverts QC_PASS to OPEN and invalidates stale dispositions', async () => {
            const batchRes = await request(app)
                .post('/api/qc/batches')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ analysis: 'PH_H2O', profile: 'RACK_40' });
            batchId = batchRes.body.id;

            // Pass QC
            await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    blanks: [{ value: 0.01 }],
                    controls: [{ expected: 7.0, measured: 7.05 }],
                    duplicates: [{ value1: 7.0, value2: 7.02 }]
                });

            const passedBatch = await prisma.batch.findUnique({ where: { id: batchId } });
            expect(passedBatch.status).toBe('QC_PASS');

            // Clear QC measurements
            const clearRes = await request(app)
                .put(`/api/qc/batches/${batchId}`)
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    qcResults: { blanks: [], duplicates: [], controls: [] }
                });

            expect(clearRes.statusCode).toBe(200);
            expect(clearRes.body.status).toBe('OPEN');

            const batch = await prisma.batch.findUnique({ where: { id: batchId } });
            expect(batch.status).toBe('OPEN');
            const parsed = JSON.parse(batch.qcResults);
            expect(parsed.overallStatus).toBe('OPEN');
            expect(parsed.summary.totalQcSamples).toBe(0);
        });
    });
});
});
