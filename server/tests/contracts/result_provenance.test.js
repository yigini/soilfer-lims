const prisma = require('../../prisma');
const resultsController = require('../../controllers/resultsController');
const { assembleReport } = require('../../services/reportAssembly');

describe('WP-31: Result Provenance Tracking', () => {
    let testSampleId;
    let createdResultIds = [];

    beforeAll(async () => {
        testSampleId = `SMP-PROV-${Date.now()}`;
        await prisma.sample.create({
            data: {
                id: testSampleId,
                originalId: `ORIG-${testSampleId}`,
                status: 'PROCESSING',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                labId: 'LAB-DEFAULT',
                assignedLab: 'LAB-DEFAULT'
            }
        });
    });

    afterAll(async () => {
        if (createdResultIds.length > 0) {
            await prisma.result.deleteMany({ where: { id: { in: createdResultIds } } });
        }
        await prisma.result.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.sample.deleteMany({ where: { id: testSampleId } });
    });

    test('1. Direct prisma create defaults Result.provenance to MEASURED', async () => {
        const r = await prisma.result.create({
            data: {
                id: `RES-DEF-${Date.now()}`,
                sampleId: testSampleId,
                param: 'PH',
                value: '6.80',
                numericValue: 6.80,
                unit: 'pH_units'
            }
        });
        createdResultIds.push(r.id);

        const fetched = await prisma.result.findUnique({ where: { id: r.id } });
        expect(fetched.provenance).toBe('MEASURED');
    });

    test('2. resultsController.saveResults preserves specified provenance or defaults to MEASURED', async () => {
        const req = {
            params: { sampleId: testSampleId },
            body: {
                measurements: [
                    { param: 'EC', value: '1.25', unit: 'dS/m', validation: { valid: true } },
                    { param: 'CLAY_PRED', value: '28.5', unit: '%', provenance: 'PREDICTED', validation: { valid: true } }
                ]
            },
            user: { username: 'test_analyst' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await resultsController.saveResults(req, res);
        expect(res.json).toHaveBeenCalled();

        const ecRes = await prisma.result.findFirst({ where: { sampleId: testSampleId, param: 'EC', isCurrent: true } });
        expect(ecRes).not.toBeNull();
        expect(ecRes.provenance).toBe('MEASURED');
        createdResultIds.push(ecRes.id);

        const clayRes = await prisma.result.findFirst({ where: { sampleId: testSampleId, param: 'CLAY_PRED', isCurrent: true } });
        expect(clayRes).not.toBeNull();
        expect(clayRes.provenance).toBe('PREDICTED');
        createdResultIds.push(clayRes.id);
    });

    test('3. assembleReport includes provenance for each result item', async () => {
        // Also add a DERIVED result
        const derivedRes = await prisma.result.create({
            data: {
                id: `RES-DER-${Date.now()}`,
                sampleId: testSampleId,
                param: 'TEXTURE',
                value: 'Clay Loam',
                provenance: 'DERIVED',
                isCurrent: true
            }
        });
        createdResultIds.push(derivedRes.id);

        const { content } = await assembleReport(testSampleId, { username: 'admin' });
        expect(content).toBeDefined();
        expect(content.resultGroups).toBeDefined();

        const allItems = content.resultGroups.flatMap(g => g.items || []);
        const ecItem = allItems.find(i => i.param === 'EC');
        const clayItem = allItems.find(i => i.param === 'CLAY_PRED');
        const texItem = allItems.find(i => i.param === 'TEXTURE');

        expect(ecItem?.provenance).toBe('MEASURED');
        expect(clayItem?.provenance).toBe('PREDICTED');
        expect(texItem?.provenance).toBe('DERIVED');
    });

    test('4. WP-40: saveResults accepts chosen basis and stores censoring correctly', async () => {
        const req = {
            params: { sampleId: testSampleId },
            body: {
                measurements: [
                    { param: 'SOC', value: '<0.01', unit: 'g/kg', basis: 'OVEN_DRY', validation: { valid: true } }
                ]
            },
            user: { username: 'test_analyst' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await resultsController.saveResults(req, res);
        expect(res.json).toHaveBeenCalled();

        const socRes = await prisma.result.findFirst({ where: { sampleId: testSampleId, param: 'SOC', isCurrent: true } });
        expect(socRes).not.toBeNull();
        expect(socRes.basis).toBe('OVEN_DRY');
        expect(socRes.censoring).toBe('BELOW_LOQ');
        createdResultIds.push(socRes.id);
    });

    test('5. WP-40: saveResults supports multiple replicates without overwriting previous determination', async () => {
        const reqR1 = {
            params: { sampleId: testSampleId },
            body: {
                measurements: [
                    { param: 'TOTAL_N', value: '1.20', unit: 'g/kg', replicateNo: 1, validation: { valid: true } }
                ]
            },
            user: { username: 'test_analyst' }
        };
        const reqR2 = {
            params: { sampleId: testSampleId },
            body: {
                measurements: [
                    { param: 'TOTAL_N', value: '1.24', unit: 'g/kg', replicateNo: 2, validation: { valid: true } }
                ]
            },
            user: { username: 'test_analyst' }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await resultsController.saveResults(reqR1, res);
        await resultsController.saveResults(reqR2, res);

        const activeResults = await prisma.result.findMany({
            where: { sampleId: testSampleId, param: 'TOTAL_N', isCurrent: true },
            orderBy: { replicateNo: 'asc' }
        });

        expect(activeResults.length).toBe(2);
        expect(activeResults[0].replicateNo).toBe(1);
        expect(activeResults[0].value).toBe('1.20');
        expect(activeResults[1].replicateNo).toBe(2);
        expect(activeResults[1].value).toBe('1.24');
        activeResults.forEach(r => createdResultIds.push(r.id));
    });

    test('6. WP-40: assembleReport embeds basis, replicateNo, and censoring on result items', async () => {
        const { content } = await assembleReport(testSampleId, { username: 'admin' });
        const allItems = content.resultGroups.flatMap(g => g.items || []);
        
        const socItem = allItems.find(i => i.param === 'SOC');
        expect(socItem).toBeDefined();
        expect(socItem.basis).toBe('OVEN_DRY');
        expect(socItem.censoring).toBe('BELOW_LOQ');

        const nItems = allItems.filter(i => i.param === 'TOTAL_N');
        expect(nItems.length).toBeGreaterThanOrEqual(1);
    });
});

