const { cleanupWorkflowFixtures } = require("../helpers/workflowFixtures");
const prisma = require('../../prisma');
const importController = require('../../controllers/importController');
const { createSample } = require('../../services/sampleStateService');

describe('WP-32: Legacy Data Import Harmonisation Mandate', () => {
    const testLabId = 'LAB-IMPORT-TEST';
    const otherLabId = 'LAB-IMPORT-OTHER';
    const testAnalysisCode = 'PH';
    let createdSampleIds = [];

    beforeAll(async () => {
        // Ensure test lab exists
        await prisma.lab.upsert({
            where: { id: testLabId },
            create: { id: testLabId, code: 'IMP-TEST', name: 'Import Test Lab', country: 'Global' },
            update: {}
        });
        await prisma.lab.upsert({ where: { id: otherLabId },
            create: { id: otherLabId, code: 'IMP-OTHER', name: 'Other import laboratory', country: 'Global' }, update: {} });
    });

    afterAll(async () => {
        if (createdSampleIds.length > 0) {
            await prisma.result.deleteMany({ where: { sampleId: { in: createdSampleIds } } });
            await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: { in: createdSampleIds } } }), select: { id: true } })).map(row => row.id), { single: false });
        }
        await prisma.lab.delete({ where: { id: testLabId } }).catch(() => {});
        await prisma.lab.delete({ where: { id: otherLabId } }).catch(() => {});
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
        const sample = await prisma.sample.findUnique({ where: { id: sampleCode } });
        expect(sample).toMatchObject({ status: 'APPROVED', approvedAt: null, approvedBy: null });
        expect(JSON.parse(sample.receptionData)).toMatchObject({ isLegacy: true, importedBy: 'data_officer' });
        const creation = await prisma.auditLog.findMany({ where: { entity: 'SAMPLE', entityId: sampleCode, action: 'SAMPLE_CREATED' } });
        expect(creation).toHaveLength(1);
        expect(creation[0].performedBy).toBe('system:legacy-import');
        expect(JSON.parse(creation[0].details)).toMatchObject({ context: 'legacy-import', importingUser: 'data_officer' });
    });

    async function importRows(rows, user = { username: 'import_reception', role: 'SAMPLE_RECEPTION', labId: testLabId }) {
        const analysis = await prisma.analysis.findFirst();
        const method = await prisma.methodology.findFirst({ where: { analysisCode: analysis.code } }) || await prisma.methodReference.findFirst();
        const unit = await prisma.unit.findFirst();
        let status = 200, body;
        const res = { status(code) { status = code; return this; }, json(value) { body = value; } };
        await importController.executeImport({ user, body: { sampleIdColumn: 'Sample_ID', labId: testLabId,
            columnMappings: [{ column: 'value', analysisCode: analysis.code, methodologyId: method.id, unitCode: unit.code }], rows } }, res);
        return { status, body };
    }

    test('4. importing into an existing sample preserves its status and approval identity', async () => {
        const sampleCode = `LEG-EXISTING-${Date.now()}`;
        createdSampleIds.push(sampleCode);
        const original = await createSample({ id: sampleCode, originalId: sampleCode, assignedLab: testLabId,
            status: 'EXPECTED', receptionData: JSON.stringify({ observed: 'unchanged' }) }, 'system:fixture', { context: 'fixture' });
        const response = await importRows([{ Sample_ID: sampleCode, value: '4.2' }]);
        expect(response).toMatchObject({ status: 200, body: { success: true, importedSamples: 0, importedResults: 1 } });
        expect(await prisma.sample.findUnique({ where: { id: sampleCode } })).toEqual(original);
        expect(await prisma.auditLog.count({ where: { entityId: sampleCode, action: 'SAMPLE_CREATED' } })).toBe(1);
    });

    test('5. a cross-lab existing sample refuses and rolls back the whole import', async () => {
        const foreign = `LEG-FOREIGN-${Date.now()}`, first = `LEG-ROLLBACK-${Date.now()}`;
        createdSampleIds.push(foreign, first);
        await createSample({ id: foreign, originalId: foreign, assignedLab: otherLabId, status: 'EXPECTED' },
            'system:fixture', { context: 'fixture' });
        const before = await Promise.all([prisma.sample.count(), prisma.result.count(), prisma.auditLog.count()]);
        const response = await importRows([{ Sample_ID: first, value: '3.1' }, { Sample_ID: foreign, value: '5.2' }]);
        expect(response.status).toBe(403);
        expect(await Promise.all([prisma.sample.count(), prisma.result.count(), prisma.auditLog.count()])).toEqual(before);
        expect(await prisma.sample.findUnique({ where: { id: first } })).toBeNull();
        expect(await prisma.result.count({ where: { sampleId: foreign } })).toBe(0);
    });
});
