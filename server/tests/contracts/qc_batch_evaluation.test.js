const request = require('supertest');
const app = require('../../app');
const { generateToken } = require('../setup');
const prisma = require('../../prisma');

describe('QC Batch 40-Sample Capacity & Scope Contracts (Mandatory Correction 3)', () => {
    let techToken;
    let labId = 'TUN-LAB1';

    beforeAll(async () => {
        techToken = generateToken({
            id: 'user-tech-tun-1',
            username: 'tech_tun_1',
            role: 'LAB_TECHNICIAN',
            labId: 'TUN-LAB1'
        });
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
});
