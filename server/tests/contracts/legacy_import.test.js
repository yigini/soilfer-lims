const prisma = require('../../prisma');
const importController = require('../../controllers/importController');

describe('WP-32: Legacy Data Import Harmonisation Mandate', () => {
    const testLabId = 'LAB-IMPORT-TEST';
    const testAnalysisCode = 'PH';
    let createdSampleIds = [];

    beforeAll(async () => {
        // Ensure test lab exists
        await prisma.lab.upsert({
            where: { id: testLabId },
            create: { id: testLabId, code: 'IMP-TEST', name: 'Import Test Lab', country: 'Global' },
            update: {}
        });
    });

    afterAll(async () => {
        if (createdSampleIds.length > 0) {
            await prisma.result.deleteMany({ where: { sampleId: { in: createdSampleIds } } });
            await prisma.sample.deleteMany({ where: { id: { in: createdSampleIds } } });
        }
        await prisma.lab.delete({ where: { id: testLabId } }).catch(() => {});
    });

    test('1. A CSV cannot be imported without every column mapped to an analysis, a method, and a controlled unit', async () => {
        // Missing method and unit for column 'pH_water'
        const req = {
            body: {
                sampleIdColumn: 'Sample_ID',
                labId: testLabId,
                columnMappings: [
                    { column: 'pH_water', analysisCode: 'PH', methodologyId: '', unitCode: '' }
                ],
                rows: [{ Sample_ID: 'LEG-101', pH_water: '7.2' }]
            },
            user: { username: 'data_officer', role: 'SUPER_ADMIN' }
        };
        let responseCode = null;
        let responseData = null;
        const res = {
            status: (code) => { responseCode = code; return res; },
            json: (data) => { responseData = data; }
        };

        await importController.executeImport(req, res);
        expect(responseCode).toBe(400);
        expect(responseData.error).toContain('A CSV cannot be imported without every column mapped to an analysis, a method and a controlled unit');
    });

    test('2. Rejects import if analysis, methodology, or unit does not exist in catalogue', async () => {
        const req = {
            body: {
                sampleIdColumn: 'Sample_ID',
                labId: testLabId,
                columnMappings: [
                    {
                        column: 'Bogus_Param',
                        analysisCode: 'NON_EXISTENT_ANALYSIS',
                        methodologyId: 'METHOD_XYZ',
                        unitCode: 'pH_units'
                    }
                ],
                rows: [{ Sample_ID: 'LEG-102', Bogus_Param: '42' }]
            },
            user: { username: 'data_officer', role: 'SUPER_ADMIN' }
        };
        let responseCode = null;
        let responseData = null;
        const res = {
            status: (code) => { responseCode = code; return res; },
            json: (data) => { responseData = data; }
        };

        await importController.executeImport(req, res);
        expect(responseCode).toBe(400);
        expect(responseData.error).toContain('does not exist in catalogue');
    });

    test('3. Successfully imports historical results with provenance IMPORTED when fully mapped', async () => {
        // Fetch a valid analysis, methodology, and unit from catalogue
        const analysis = await prisma.analysis.findFirst();
        expect(analysis).not.toBeNull();

        let method = await prisma.methodology.findFirst({ where: { analysisCode: analysis.code } });
        if (!method) {
            method = await prisma.methodReference.findFirst();
        }
        const unit = await prisma.unit.findFirst();
        expect(unit).not.toBeNull();

        const methodId = method ? method.id : 'GLOSOLAN-SOP-01';
        const sampleCode = `LEG-HIST-${Date.now()}`;
        createdSampleIds.push(sampleCode);

        const req = {
            body: {
                sampleIdColumn: 'Sample_ID',
                labId: testLabId,
                columnMappings: [
                    {
                        column: 'pH_water',
                        analysisCode: analysis.code,
                        methodologyId: methodId,
                        unitCode: unit.code
                    }
                ],
                rows: [
                    { Sample_ID: sampleCode, pH_water: '6.75' }
                ]
            },
            user: { username: 'data_officer', role: 'SUPER_ADMIN' }
        };

        let responseCode = null;
        let responseData = null;
        const res = {
            status: (code) => { responseCode = code; return res; },
            json: (data) => { responseData = data; }
        };

        await importController.executeImport(req, res);
        expect(responseData).not.toBeNull();
        expect(responseData.success).toBe(true);
        expect(responseData.importedResults).toBe(1);

        // Verify database result record carries provenance: IMPORTED
        const importedResult = await prisma.result.findFirst({
            where: { sampleId: sampleCode, param: analysis.code }
        });
        expect(importedResult).not.toBeNull();
        expect(importedResult.provenance).toBe('IMPORTED');
        expect(importedResult.value).toBe('6.75');
        expect(importedResult.numericValue).toBe(6.75);
        expect(importedResult.unit).toBe(unit.code);
    });
});
