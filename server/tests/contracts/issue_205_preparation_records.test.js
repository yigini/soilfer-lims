const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { createHash, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const PDFDocument = require('pdfkit');
const prisma = require('../../prisma');
const operations = require('../../services/operationalConfirmationService');
const preparation = require('../../services/preparationRecordService');
const reportBasis = require('../../services/reportBasisService');
const policyService = require('../../services/policyService');
const { registry } = require('../../config/policyRegistry');
const { freezeReportEvidence, describeReportEvidence } = require('../../services/reportTruthfulnessService');
const { generateReportPdfBuffer } = require('../../services/pdfGenerator');
const { installPreparationRecords, assertPreparationRecordStartupReady, parseArguments } = require('../../scripts/install_preparation_records');
const { createSampleFixture, createWorkItemFixture, cleanupWorkflowFixtures } = require('../helpers/workflowFixtures');
const { dryingRecord } = require('../helpers/preparationRecords');

const LAB = 'LAB-T205';
const technician = { username: 'tech_205', role: 'LAB_TECHNICIAN', labId: LAB };
const sampleIds = [];

async function gateFixture({ status = 'ACCEPTED', analysis = 'DRYING', itemStatus = 'NOT_ASSIGNED', dryingStatus = 'PENDING' } = {}) {
    const sampleId = `SMP-205-${randomUUID()}`;
    sampleIds.push(sampleId);
    await createSampleFixture(prisma, { data: { id: sampleId, originalId: `ORIG-${sampleId}`, status, labId: LAB, assignedLab: LAB,
        dryingStatus, preparationStatus: 'PENDING', requiredAnalyses: JSON.stringify(['PH']) } });
    const item = await createWorkItemFixture(prisma, { data: { id: `WI-205-${randomUUID()}`, sampleId, analysis,
        category: 'Operational Gates', status: itemStatus, labId: LAB } });
    return { sampleId, item };
}
const confirm = (item, records, extra = {}) => operations.confirmOperation({ actor: technician, workItemId: item.id,
    checklist: [true, true, true], records, ...extra });

beforeAll(async () => {
    await require('../setup').ensureTestLab(LAB, 'T205');
    await prisma.user.upsert({ where: { username: technician.username }, update: {}, create: { id: technician.username, username: technician.username,
        password: 'not-a-login', email: 'tech_205@example.test', role: technician.role, labId: LAB } });
    await prisma.operationalGate.deleteMany({ where: { labId: LAB } });
});
afterAll(async () => {
    await prisma.operationalGate.deleteMany({ where: { labId: LAB } });
    const items = await prisma.workItem.findMany({ where: { sampleId: { in: sampleIds } }, select: { id: true } });
    await cleanupWorkflowFixtures(prisma, 'workItem', items.map(row => row.id));
    await cleanupWorkflowFixtures(prisma, 'sample', sampleIds);
});

describe('#205 structured drying and preparation records', () => {
    test('DRYING refuses a confirmation without its structured record and writes nothing', async () => {
        const { item } = await gateFixture();
        await expect(confirm(item, undefined)).rejects.toMatchObject({ statusCode: 422, code: 'PREPARATION_RECORD_REQUIRED',
            details: { gate: 'DRYING', required: ['DRYING'], missing: ['DRYING'] } });
        expect((await prisma.workItem.findUnique({ where: { id: item.id } })).status).toBe('NOT_ASSIGNED');
        expect(await prisma.preparationRecord.count({ where: { workItemId: item.id } })).toBe(0);
    });

    test.each([
        ['temperature', dryingRecord({ temperatureC: undefined }), 'temperatureC'],
        ['method', dryingRecord({ method: 'SUNLAMP' }), 'method'],
        ['end before start', dryingRecord({ endedAt: new Date(Date.now() - 72 * 3600000).toISOString() }), 'endedAt'],
        ['future end', dryingRecord({ endedAt: new Date(Date.now() + 3600000).toISOString() }), 'endedAt'],
        ['missing start', dryingRecord({ startedAt: undefined }), 'startedAt']
    ])('DRYING refuses a record with an invalid %s', async (_label, record, field) => {
        const { item } = await gateFixture();
        await expect(confirm(item, [record])).rejects.toMatchObject({ statusCode: 422, code: 'PREPARATION_RECORD_INVALID', details: expect.objectContaining({ field }) });
        expect(await prisma.preparationRecord.count({ where: { workItemId: item.id } })).toBe(0);
    });

    test('a confirmed DRYING record is tied to the receipt, reports its duration and is append-only', async () => {
        const { sampleId, item } = await gateFixture();
        const outcome = await confirm(item, [dryingRecord()]);
        const receipt = JSON.parse(outcome.workItem.result);
        const [row] = await prisma.preparationRecord.findMany({ where: { workItemId: item.id } });
        expect(row).toMatchObject({ sampleId, receiptId: receipt.receiptId, gateCode: 'DRYING', method: 'OVEN_40', temperatureC: 40,
            performedBy: technician.username, version: 1 });
        expect(receipt.preparationRecords).toEqual([expect.objectContaining({ id: row.id, durationMinutes: 48 * 60 })]);
        expect(receipt.requiredSteps).toEqual(['DRYING']);
        const db = new Database(process.env.DATABASE_PATH);
        try {
            expect(() => db.prepare('UPDATE "PreparationRecord" SET temperatureC=105 WHERE id=?').run(row.id)).toThrow(/PREPARATION_RECORD_IMMUTABLE/);
            expect(() => db.prepare('DELETE FROM "PreparationRecord" WHERE id=?').run(row.id)).toThrow(/PREPARATION_RECORD_IMMUTABLE/);
        } finally { db.close(); }
        await expect(prisma.preparationRecord.delete({ where: { id: row.id } })).rejects.toBeTruthy();
        await expect(confirm(item, [dryingRecord()])).rejects.toMatchObject({ statusCode: 409, code: 'OPERATIONAL_CONFIRMATION_REFUSED' });
        expect(await prisma.preparationRecord.count({ where: { workItemId: item.id } })).toBe(1);
        expect(await preparation.forReceipts(prisma, [receipt.receiptId])).toEqual([expect.objectContaining({ receiptId: receipt.receiptId, id: row.id })]);
    });

    test('the database guards refuse an invalid record written around the service', async () => {
        const { sampleId, item } = await gateFixture();
        const db = new Database(process.env.DATABASE_PATH);
        const insert = db.prepare('INSERT INTO "PreparationRecord"(id,sampleId,workItemId,receiptId,gateCode,method,temperatureC,sieveMm,massBeforeG,' +
            'coarseFractionG,coarseFractionPct,startedAt,endedAt,performedBy,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        const row = (gateCode, fields = {}) => [randomUUID(), sampleId, item.id, `REC-${randomUUID()}`, gateCode, fields.method ?? null, fields.temperatureC ?? null,
            fields.sieveMm ?? null, fields.massBeforeG ?? null, fields.coarseFractionG ?? null, fields.coarseFractionPct ?? null,
            Date.now() - 7200000, Date.now() - 3600000, fields.performedBy ?? 'direct', Date.now()];
        try {
            for (const values of [row('DRYING', { method: 'AIR' }), row('MILLING'), row('GRINDING', { method: 'AIR' }), row('SPLITTING', { performedBy: ' ' }),
                row('SIEVING', { sieveMm: 2, massBeforeG: 100, coarseFractionG: 150, coarseFractionPct: 150 })])
                expect(() => insert.run(...values)).toThrow(/PREPARATION_RECORD_INVALID/);
        } finally { db.close(); }
        expect(await prisma.preparationRecord.count({ where: { workItemId: item.id } })).toBe(0);
    });

    test('a sample that is received but not accepted cannot start preparation', async () => {
        const { item } = await gateFixture({ status: 'RECEIVED' });
        await expect(confirm(item, [dryingRecord()])).rejects.toMatchObject({ statusCode: 409, code: 'SAMPLE_NOT_ACCEPTED' });
    });

    test('a stale version is refused before any record is written', async () => {
        const { item } = await gateFixture();
        await expect(confirm(item, [dryingRecord()], { expected: { version: item.version + 5 } })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
        expect(await prisma.preparationRecord.count({ where: { workItemId: item.id } })).toBe(0);
    });

    test('PREPARATION requires the active lab steps, computes the coarse fraction and refuses extra steps or foreign equipment', async () => {
        await prisma.operationalGate.createMany({ data: [
            { code: 'SIEVING', name: 'Sieve 2 mm', sortOrder: 1, labId: LAB, isActive: true },
            { code: 'GRINDING', name: 'Grind', sortOrder: 2, labId: LAB, isActive: false }
        ] });
        try {
            expect(await preparation.requiredSteps(prisma, LAB, 'PREPARATION')).toEqual(['SIEVING']);
            const { sampleId, item: drying } = await gateFixture();
            await confirm(drying, [dryingRecord()]);
            const item = await createWorkItemFixture(prisma, { data: { id: `WI-205-${randomUUID()}`, sampleId, analysis: 'PREPARATION',
                category: 'Operational Gates', status: 'NOT_ASSIGNED', labId: LAB } });
            const window = { startedAt: new Date(Date.now() - 2 * 3600000).toISOString(), endedAt: new Date(Date.now() - 3600000).toISOString() };
            const sieving = { gateCode: 'SIEVING', sieveMm: 2, massBeforeG: 350, coarseFractionG: 12.5, ...window };
            await expect(confirm(item, [])).rejects.toMatchObject({ code: 'PREPARATION_RECORD_REQUIRED', details: { missing: ['SIEVING'] } });
            await expect(confirm(item, [sieving, { gateCode: 'GRINDING', grindMm: 0.5, ...window }]))
                .rejects.toMatchObject({ code: 'PREPARATION_RECORD_INVALID', details: expect.objectContaining({ extra: ['GRINDING'] }) });
            await expect(confirm(item, [{ ...sieving, equipmentId: 'not-an-asset' }])).rejects.toMatchObject({ code: 'PREPARATION_EQUIPMENT_INVALID' });
            await expect(confirm(item, [{ ...sieving, temperatureC: 40 }])).rejects.toMatchObject({ code: 'PREPARATION_RECORD_INVALID' });
            const outcome = await confirm(item, [sieving]);
            expect(JSON.parse(outcome.workItem.result).preparationRecords).toEqual([expect.objectContaining({ gateCode: 'SIEVING', coarseFractionPct: 3.5714 })]);
        } finally {
            await prisma.operationalGate.deleteMany({ where: { labId: LAB } });
        }
    });
});

describe('#205 report evidence and oven-dry basis', () => {
    const receiptId = 'REC-OPS-205-report';
    const gateItem = { id: 'wi-dry', analysis: 'DRYING', status: 'COMPLETED', result: JSON.stringify({ receiptId, checks: [true, true, true],
        steps: ['Identity verified', 'Spread on tray', 'Dried to constant mass'], recordedBy: 'tech_205' }) };
    const record = { receiptId, id: 'rec-1', gateCode: 'DRYING', method: 'OVEN_40', temperatureC: 40, startedAt: '2026-10-01T08:00:00.000Z',
        endedAt: '2026-10-03T09:30:00.000Z', durationMinutes: 49 * 60 + 30, massBeforeG: 400, massAfterG: 362.5, performedBy: 'tech_205',
        equipment: { name: 'Drying oven 2', internalAssetTag: 'OV-02' } };

    test.each(['en', 'es', 'es-419', 'fr', 'pt'])('the report prints each structured record under its gate in %s', locale => {
        const labels = require(`../../locales/${locale}.json`).resultReports;
        const evidence = freezeReportEvidence([], [gateItem], [], { preparationRecords: [record, { ...record, receiptId: 'other' }] });
        expect(evidence.preparation[0].records).toHaveLength(1);
        const text = describeReportEvidence(evidence, locale).preparationStatement;
        for (const fragment of [labels.preparationRecordText.methods.OVEN_40, '40 °C', `${labels.preparationRecordText.duration}: 49 h 30 min`,
            '2026-10-01 08:00', 'Drying oven 2 (OV-02)', `${labels.preparationRecordText.massAfter}: 362.5 g`, 'tech_205']) expect(text).toContain(fragment);
        expect(describeReportEvidence(freezeReportEvidence([], [gateItem], []), locale).preparationStatement).not.toContain('°C');
    });

    test('the oven-dry policy is registered, off by default and translated', () => {
        expect(registry['report.ovenDryConvertible']).toMatchObject({ type: 'boolean' });
        for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
            expect(require(`../../locales/${locale}.json`).policies.keys.report_ovenDryConvertible).toEqual(expect.any(String));
            expect(require(`../../../client/src/translations/${locale}.json`).policies.keys.report_ovenDryConvertible).toEqual(expect.any(String));
        }
    });

    const calculation = (factor, formulaModule = 'GRAVIMETRIC_MOISTURE') => ({ resultCalculation: { findUnique: async () =>
        ({ intermediate: JSON.stringify({ moistureCorrectionFactor: factor }), template: { formulaModule } }) } });

    test.each([
        [[], calculation(1.05), 'NO_REPORTED_SOIL_MOISTURE'],
        [[{ id: 'm1', param: 'SOIL_MOISTURE' }], calculation(1.05, 'GENERIC'), 'NOT_GRAVIMETRIC'],
        [[{ id: 'm1', param: 'SOIL_MOISTURE' }], calculation(4), 'FACTOR_INVALID']
    ])('an oven-dry report refuses without a usable frozen moisture factor (%#)', async (sources, db, reason) => {
        await expect(reportBasis.moistureFactor(db, sources)).rejects.toMatchObject({ statusCode: 409, code: 'MOISTURE_FACTOR_REQUIRED', details: { reason } });
    });

    test('only uncensored air-dry values the lab marked convertible are converted, keeping their decimals', async () => {
        expect(() => reportBasis.normalizeBasis('FIELD_MOIST')).toThrow(expect.objectContaining({ code: 'REPORT_BASIS_INVALID' }));
        expect(reportBasis.normalizeBasis(undefined)).toBe('AS_RECORDED');
        const moisture = await reportBasis.moistureFactor(calculation(1.05), [{ id: 'm1', param: 'SOIL_MOISTURE' }]);
        expect(moisture).toEqual({ factor: 1.05, waterContentPct: 5, sourceResultIds: ['m1'] });
        jest.spyOn(policyService, 'get').mockImplementation(async (_lab, key, scope) => key === 'report.ovenDryConvertible' && scope.analysisCode !== 'PH');
        try {
            const items = [
                { param: 'SOC', value: '12.40', basis: 'AIR_DRY', censoring: 'NONE', decimalPlaces: 2, uncertainty: { state: 'EXPANDED', mode: 'EXPANDED_ABSOLUTE', value: 0.4 } },
                { param: 'PH', value: '6.40', basis: 'AIR_DRY', censoring: 'NONE' },
                { param: 'P', value: '< 0.5', basis: 'AIR_DRY', censoring: 'LT' },
                { param: 'SOIL_MOISTURE', value: '5.0', basis: 'AIR_DRY', censoring: 'NONE' },
                { param: 'N', value: '1.20', basis: 'OVEN_DRY', censoring: 'NONE' }
            ];
            expect(await reportBasis.applyOvenDryBasis({}, LAB, items, moisture)).toBe(1);
            expect(items[0]).toMatchObject({ value: '13.02', basis: 'OVEN_DRY', basisConversion: { from: 'AIR_DRY', factor: 1.05, airDryValue: '12.40', sourceResultIds: ['m1'] } });
            expect(items[0].uncertainty.value).toBeCloseTo(0.42);
            expect(items.slice(1).map(item => item.value)).toEqual(['6.40', '< 0.5', '5.0', '1.20']);
            expect(await reportBasis.applyOvenDryBasis({}, null, [{ param: 'SOC', value: '1.00', basis: 'AIR_DRY', censoring: 'NONE' }], moisture)).toBe(0);
        } finally {
            policyService.get.mockRestore();
        }
    });

    test('the PDF prints the moisture correction factor and the preparation records', async () => {
        const calls = [], original = PDFDocument.prototype.text;
        const spy = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (value, x, y, options) {
            calls.push(String(value)); return original.call(this, value, x, y, options);
        });
        try {
            const evidence = freezeReportEvidence([], [gateItem], [], { preparationRecords: [record] });
            const moistureCorrection = { factor: 1.05, waterContentPct: 5, sourceResultIds: ['m1'], convertedParams: ['SOC'] };
            const pdf = await generateReportPdfBuffer({ meta: { locale: 'en' }, sample: { id: 'SMP-205-PDF' }, lab: { name: 'Owned laboratory' },
                evidence, reportBasis: 'OVEN_DRY', moistureCorrection, basisStatement: reportBasis.basisStatement(moistureCorrection, 'en'),
                resultGroups: [{ categoryName: 'Carbon', items: [{ param: 'SOC', name: 'Soil organic carbon', value: '13.02', unit: 'g/kg', basis: 'OVEN_DRY' }] }] });
            expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
            const printed = calls.join('\n');
            expect(printed).toContain('Reported on an oven-dry basis: moisture correction factor 1.05 (gravimetric water content 5 %) · SOC');
            expect(printed).toContain('Drying oven 2 (OV-02)');
        } finally {
            spy.mockRestore();
        }
    });
});

describe('#205 preparation record installer', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-205-install-'));
    afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));
    const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

    // Starts from the installed test template and removes only #205 objects.
    async function database(shape) {
        const file = path.join(directory, randomUUID() + '.db'), source = new Database(process.env.DATABASE_PATH, { readonly: true });
        try { await source.backup(file); } finally { source.close(); }
        const db = new Database(file);
        try {
            db.exec('DROP TRIGGER IF EXISTS "PreparationRecord_no_delete"');
            db.exec('DELETE FROM "PreparationRecord"');
            if (shape !== 'COMPLETE') {
                db.prepare('DELETE FROM _schema_migrations WHERE id=?').run('205_preparation_records');
                for (const name of ['PreparationRecord_validate_insert', 'PreparationRecord_no_update']) db.exec(`DROP TRIGGER IF EXISTS "${name}"`);
            }
            if (shape === 'PRE') db.exec('DROP TABLE "PreparationRecord"');
        } finally { db.close(); }
        if (shape === 'COMPLETE') {
            const restore = new Database(file);
            try { restore.exec(`CREATE TRIGGER "PreparationRecord_no_delete" BEFORE DELETE ON "PreparationRecord"
BEGIN
  SELECT RAISE(ABORT, 'PREPARATION_RECORD_IMMUTABLE');
END;`); } finally { restore.close(); }
        }
        return file;
    }

    test.each(['PRE', 'FRESH'])('%s databases dry-run without writes, then apply additively with a verified receipt', async shape => {
        const file = await database(shape), before = digest(file);
        const dry = installPreparationRecords({ dbPath: file });
        expect(dry).toMatchObject({ classification: shape === 'PRE' ? 'PRE_205' : 'FRESH_PRISMA_205', mode: 'DRY_RUN', totalChanges: 0 });
        expect(digest(file)).toBe(before);
        expect(() => assertPreparationRecordStartupReady(file)).toThrow(expect.objectContaining({ code: 'PREPARATION_RECORD_STARTUP_REQUIRED' }));
        const applied = installPreparationRecords({ dbPath: file, apply: true });
        expect(applied).toMatchObject({ classification: 'COMPLETE_205', previousClassification: dry.classification, mode: 'APPLIED', backfilledCount: 0,
            receipt: { originalRowsPreserved: true, backfilledCount: 0 } });
        const settled = digest(file);
        expect(installPreparationRecords({ dbPath: file, apply: true })).toMatchObject({ classification: 'COMPLETE_205', mode: 'NO_OP', totalChanges: 0 });
        expect(digest(file)).toBe(settled);
        expect(assertPreparationRecordStartupReady(file).classification).toBe('COMPLETE_205');
    });

    test('unmarked rows, a partial install and an altered table refuse with zero writes', async () => {
        const populated = await database('FRESH');
        let db = new Database(populated);
        try {
            const sample = db.prepare('SELECT id FROM "Sample" LIMIT 1').get(), item = db.prepare('SELECT id FROM "WorkItem" LIMIT 1').get();
            expect(sample && item).toBeTruthy();
            db.prepare('INSERT INTO "PreparationRecord"(id,sampleId,workItemId,receiptId,gateCode,startedAt,endedAt,performedBy,createdAt) VALUES(?,?,?,?,?,?,?,?,?)')
                .run('unreviewed', sample.id, item.id, 'REC-x', 'SPLITTING', Date.now() - 2, Date.now() - 1, 'someone', Date.now());
        } finally { db.close(); }
        let before = digest(populated);
        expect(() => installPreparationRecords({ dbPath: populated, apply: true })).toThrow(expect.objectContaining({ code: 'PREPARATION_RECORD_SCHEMA_MISMATCH',
            differences: ['Unmarked preparation records must not be adopted'] }));
        expect(digest(populated)).toBe(before);

        const partial = await database('COMPLETE');
        db = new Database(partial);
        try { db.exec('DROP TRIGGER "PreparationRecord_no_update"'); } finally { db.close(); }
        before = digest(partial);
        expect(() => installPreparationRecords({ dbPath: partial, apply: true })).toThrow(expect.objectContaining({ code: 'PREPARATION_RECORD_SCHEMA_MISMATCH',
            differences: ['Preparation record installation is partial or unmarked'] }));
        expect(digest(partial)).toBe(before);

        const altered = await database('PRE');
        db = new Database(altered);
        try { db.exec('CREATE TABLE "PreparationRecord"(id TEXT PRIMARY KEY)'); } finally { db.close(); }
        before = digest(altered);
        expect(() => installPreparationRecords({ dbPath: altered, apply: true })).toThrow(expect.objectContaining({ code: 'PREPARATION_RECORD_SCHEMA_MISMATCH' }));
        expect(digest(altered)).toBe(before);
    });

    test('arguments need an explicit database and one mode', () => {
        expect(parseArguments(['--db', 'lab.db'])).toEqual({ apply: false, dbPath: 'lab.db' });
        expect(parseArguments(['--db', 'lab.db', '--apply'])).toEqual({ apply: true, dbPath: 'lab.db' });
        for (const args of [[], ['--apply'], ['--db', 'a.db', '--apply', '--dry-run'], ['--db', 'a.db', '--db', 'b.db'], ['--force', '--db', 'a.db']])
            expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'PREPARATION_RECORD_ARGUMENT_INVALID' }));
        expect(() => installPreparationRecords({})).toThrow(expect.objectContaining({ code: 'PREPARATION_RECORD_DATABASE_REQUIRED' }));
    });
});
