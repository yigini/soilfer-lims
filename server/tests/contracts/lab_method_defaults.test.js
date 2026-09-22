const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const { samplesDb } = require('../../db');
const prisma = require('../../prisma');
const { generateWorkItemsForSample } = require('../../controllers/workItemController');

describe('WP-20: Per-Lab Methodology Defaults & Isolation', () => {
    let superAdminToken, labAMgrToken;
    const labAId = 'LAB-METHOD-A';
    const labBId = 'LAB-METHOD-B';

    let defaultMethodId;

    beforeAll(async () => {
        superAdminToken = await getAuthToken('SUPER_ADMIN', null, ['*'], ['*']);
        labAMgrToken = await getAuthToken('LAB_MANAGER', labAId, ['GTM'], ['*']);

        // Ensure Analysis SOC exists in DB
        await prisma.analysis.upsert({
            where: { code: 'SOC' },
            update: { name: 'Soil Organic Carbon', units: 'g/kg' },
            create: { code: 'SOC', name: 'Soil Organic Carbon', units: 'g/kg' }
        });

        // Dumas Combustion (isDefault = false)
        await prisma.methodology.upsert({
            where: { id: 'ISO_10694_DRY_COMB' },
            update: { name: 'Dumas High-Temp Combustion', analysisCode: 'SOC', isDefault: false },
            create: { id: 'ISO_10694_DRY_COMB', name: 'Dumas High-Temp Combustion', analysisCode: 'SOC', isDefault: false }
        });

        const defaultMethod = await prisma.methodology.findFirst({
            where: { analysisCode: 'SOC', isDefault: true }
        });
        defaultMethodId = defaultMethod?.id;
        // This scenario requires one shared default. A copied developer catalogue may
        // contain duplicates; ambiguity is covered separately by catalogue governance.
        await prisma.methodology.updateMany({ where: { analysisCode: 'SOC', labId: null, id: { not: defaultMethodId } }, data: { isDefault: false } });
    });

    test('1. Changing Lab A default to Dumas updates Lab A defaults API without affecting Lab B', async () => {
        // Set Lab A default for SOC to Dumas
        const putRes = await request(app)
            .put(`/api/config/lab-defaults/${labAId}`)
            .set('Authorization', `Bearer ${labAMgrToken}`)
            .send({
                defaults: [
                    { analysisCode: 'SOC', methodologyId: 'ISO_10694_DRY_COMB' }
                ]
            });

        expect(putRes.status).toBe(200);
        expect(putRes.body.success).toBe(true);

        // Fetch Lab A defaults
        const getResA = await request(app)
            .get(`/api/config/lab-defaults/${labAId}`)
            .set('Authorization', `Bearer ${labAMgrToken}`);

        expect(getResA.status).toBe(200);
        const socA = getResA.body.find(a => a.analysisCode === 'SOC');
        expect(socA.effectiveMethodologyId).toBe('ISO_10694_DRY_COMB');
        expect(socA.isOverridden).toBe(true);

        // Fetch Lab B defaults (should be untouched, falling back to global default Walkley-Black)
        const getResB = await request(app)
            .get(`/api/config/lab-defaults/${labBId}`)
            .set('Authorization', `Bearer ${superAdminToken}`);

        expect(getResB.status).toBe(200);
        const socB = getResB.body.find(a => a.analysisCode === 'SOC');
        expect(socB.effectiveMethodologyId).toBe(defaultMethodId);
        expect(socB.isOverridden).toBe(false);
    });

    test('2. New work items in Lab A receive Dumas while Lab B receives Walkley-Black', async () => {
        // Sample for Lab A
        const sampleA = samplesDb.create({
            id: `SMP-METH-A-${Date.now()}`,
            labId: 'LAB-A-001',
            assignedLab: labAId,
            status: 'ACCEPTED',
            requiredAnalyses: ['SOC']
        });

        // Sample for Lab B
        const sampleB = samplesDb.create({
            id: `SMP-METH-B-${Date.now()}`,
            labId: 'LAB-B-001',
            assignedLab: labBId,
            status: 'ACCEPTED',
            requiredAnalyses: ['SOC']
        });

        // Generate work items for both samples
        const wiListA = await generateWorkItemsForSample(sampleA);
        const wiListB = await generateWorkItemsForSample(sampleB);

        const socWiA = wiListA.find(w => w.analysis === 'SOC');
        const socWiB = wiListB.find(w => w.analysis === 'SOC');

        expect(socWiA).toBeDefined();
        expect(socWiB).toBeDefined();

        // Lab A got Dumas combustion override
        expect(socWiA.methodologyId).toBe('ISO_10694_DRY_COMB');

        // Lab B got Walkley-Black global recommendation
        expect(socWiB.methodologyId).toBe(defaultMethodId);
    });

    test('3. Cross-lab access: Lab A manager cannot view or modify Lab B defaults (403)', async () => {
        // GET Lab B defaults as Lab A manager -> 403
        const getRes = await request(app)
            .get(`/api/config/lab-defaults/${labBId}`)
            .set('Authorization', `Bearer ${labAMgrToken}`);
        expect(getRes.status).toBe(403);
        expect(getRes.body.error).toMatch(/Cannot view another laboratory/i);

        // PUT Lab B defaults as Lab A manager -> 403
        const putRes = await request(app)
            .put(`/api/config/lab-defaults/${labBId}`)
            .set('Authorization', `Bearer ${labAMgrToken}`)
            .send({
                defaults: [{ analysisCode: 'SOC', methodologyId: 'ISO_10694_DRY_COMB' }]
            });
        expect(putRes.status).toBe(403);
        expect(putRes.body.error).toMatch(/Cannot modify another laboratory/i);
    });

    test('4. Unauthorized role without MANAGE_ANALYSES cannot modify defaults (403)', async () => {
        const techToken = await getAuthToken('LAB_TECHNICIAN', labAId, ['GTM'], ['ENTER_RESULTS']);
        const putRes = await request(app)
            .put(`/api/config/lab-defaults/${labAId}`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                defaults: [{ analysisCode: 'SOC', methodologyId: 'ISO_10694_DRY_COMB' }]
            });
        expect(putRes.status).toBe(403);
    });

    test('5. Supplying an unavailable or mismatched methodology is rejected (400)', async () => {
        // Non-existent methodology ID
        const putRes = await request(app)
            .put(`/api/config/lab-defaults/${labAId}`)
            .set('Authorization', `Bearer ${labAMgrToken}`)
            .send({
                defaults: [{ analysisCode: 'SOC', methodologyId: 'NON_EXISTENT_METHOD_XYZ' }]
            });
        expect(putRes.status).toBe(400);
        expect(putRes.body.error).toBeDefined();
    });

    test('6. Fresh lab with no overrides exhibits honest empty state without cross-lab leakage', async () => {
        const freshLabId = 'LAB-FRESH-' + Date.now();
        const res = await request(app)
            .get(`/api/config/lab-defaults/${freshLabId}`)
            .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const socItem = res.body.find(i => i.analysisCode === 'SOC');
        expect(socItem).toBeDefined();
        // Crucial: Must NOT inherit Lab A's Dumas override
        expect(socItem.isOverridden).toBe(false);
        expect(socItem.chosenMethodologyId).toBeNull();
        expect(socItem.effectiveMethodologyId).toBe(defaultMethodId);
    });
});
