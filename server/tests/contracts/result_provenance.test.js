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
});
