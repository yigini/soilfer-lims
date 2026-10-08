const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { createStoredProfileRunFixture } = require('../helpers/storedProfileRunFixture');
const { writeCompatibilityMeasurements } = require('../../services/qcCompatibilityRunService');
const { QC_RUN_INCLUDE } = require('../../services/qcRunViewService');
const { MODE } = require('../../services/qcReviewedCorrectionService');
const owned = [];

async function failedFixture(native, { author = 'analyst', enabled = true, duplicate = false } = {}) {
    const criteria = { blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: duplicate ? 1 : 0, crmEveryNBatches: 0 };
    const f = await qcGateFixture({ criteria });
    owned.push(f);
    for (const name of ['analyst', 'reviewer', 'other']) {
        const user = await f.db.user.create({ data: { id: randomUUID(), username: `${name}-${randomUUID()}`, email: `${randomUUID()}@example.test`,
            password: 'fixture', role: name === 'other' ? 'LAB_TECHNICIAN' : 'LAB_MANAGER', labId: f.labId } });
        f[name] = { id: user.id, username: user.username, role: user.role, labId: f.labId };
    }
    if (enabled) await f.setPolicy([{ key: 'qc.reviewedTranscriptionCorrectionEnabled', value: true }]);
    if (!native) await require('../../services/qcRuleService').change(f.actor, { labId: f.labId, analysisCode: f.analysisCode,
        criteria, expectedVersion: 0,
        reason: 'Analysis-wide criteria for unresolved compatibility method' }, { db: f.db });
    const authorActor = author === 'system' ? f.actor : f[author];
    if (native) {
        f.run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.analyst, f.input)).id, f.analyst);
        f.blank = f.run.positions.find(row => row.kind === 'BLANK');
        const measurements = [{ positionId: f.blank.id, value: 9.123456789 }];
        if (duplicate) for (const position of f.run.positions.filter(row => ['SAMPLE', 'DUPLICATE'].includes(row.kind))) measurements.push({ positionId: position.id, rawInput: '2.1234' });
        f.run = await writeNativeMeasurements(f.db, f.run.id, authorActor, { measurements });
    } else {
        f.run = await createStoredProfileRunFixture(f.db, { actor: f.analyst, input: { analysis: f.analysisCode, profile: 'RACK_40' } });
        f.run = (await writeCompatibilityMeasurements(f.db, f.run.id, authorActor, { blanks: [{ value: 9.123456789 }],
            ...(duplicate && { duplicates: [{ rawInput: { value1: '2.1234', value2: '2.1234' } }, { rawInput: { value1: '2.1234', value2: '2.1234' } }] }) })).batch;
        f.blank = f.run.positions.find(row => row.kind === 'BLANK');
    }
    expect(f.run.analytes[0].status).toBe('QC_FAIL');
    f.inputCorrection = { mode: MODE, analysisCode: f.analysisCode, reason: 'Transposed digits in worksheet entry',
        sourceReference: 'Recorded worksheet W-17, line 4', corrections: [{ positionId: f.blank.id, replicateNo: 1, rawInput: '0.0123456789' }] };
    f.read = () => f.db.batch.findUnique({ where: { id: f.run.id }, include: QC_RUN_INCLUDE });
    f.allEvidence = async () => JSON.parse(JSON.stringify(await Promise.all([f.snapshot(), f.db.qcMeasurement.findMany({ orderBy: { id: 'asc' } }),
        f.db.qcEvaluation.findMany({ orderBy: { id: 'asc' } }), f.db.batch.findMany({ orderBy: { id: 'asc' } }),
        f.db.batchAnalyte.findMany({ orderBy: { id: 'asc' } }), f.db.batchPosition.findMany({ orderBy: { id: 'asc' } })])));
    f.submit = async (actor, input = f.inputCorrection, route = 'corrections') => {
        let response;
        await withQcRunHttp(f.db, actor, async (app, token) => { response = await request(app)
            .post(`/api/qc/batches/${f.run.id}/${route}`).set('Authorization', `Bearer ${token}`).send(input); });
        return response;
    };
    return f;
}
afterAll(async () => { for (const f of owned) await f.close(); });

test.each([true, false])('default-off, missing evidence and unrelated field submissions refuse with zero writes (native=%s)', async native => {
    const f = await failedFixture(native, { enabled: false });
    let before = await f.allEvidence();
    expect((await f.submit(f.reviewer)).body.code).toBe('QC_REVIEWED_POLICY_DISABLED');
    expect(await f.allEvidence()).toEqual(before);
    await f.setPolicy([{ key: 'qc.reviewedTranscriptionCorrectionEnabled', value: true }]); before = await f.allEvidence();
    for (const [patch, code] of [[{ reason: '' }, 'QC_CORRECTION_REASON_REQUIRED'], [{ sourceReference: ' ' }, 'QC_REVIEWED_SOURCE_REQUIRED'],
        [{ status: 'QC_PASS' }, 'QC_REVIEWED_FIELDS_INVALID'], [{ references: [] }, 'QC_REVIEWED_FIELDS_INVALID'],
        [{ instrumentId: 'another' }, 'QC_REVIEWED_FIELDS_INVALID'], [{ reviewer: f.analyst.username }, 'QC_REVIEWED_FIELDS_INVALID'],
        [{ corrections: [{ ...f.inputCorrection.corrections[0], enteredBy: f.reviewer.username }] }, 'QC_REVIEWED_FIELDS_INVALID']]) {
        const response = await f.submit(f.reviewer, { ...f.inputCorrection, ...patch });
        expect(response.status).toBeGreaterThanOrEqual(400); expect(response.body.code).toBe(code);
        expect(await f.allEvidence()).toEqual(before);
    }
    expect((await f.submit(f.other)).body.code).toBe('QC_REVIEWED_PERMISSION_REQUIRED');
    expect(await f.allEvidence()).toEqual(before);
    expect((await f.submit(f.analyst)).body.code).toBe('QC_REVIEWED_SECOND_PERSON_REQUIRED');
    expect(await f.allEvidence()).toEqual(before);
});

test.each([true, false])('stored observation authors cannot approve their own correction (native=%s)', async native => {
    const f = await failedFixture(native, { author: 'reviewer' }), before = await f.allEvidence();
    expect((await f.submit(f.reviewer)).body.code).toBe('QC_REVIEWED_SECOND_PERSON_REQUIRED');
    expect(await f.allEvidence()).toEqual(before);
});
test.each([true, false])('system observation authors remain locked (native=%s)', async native => {
    const f = await failedFixture(native, { author: 'system' }), before = await f.allEvidence();
    expect((await f.submit(f.reviewer)).body.code).toBe('QC_REVIEWED_AUTHOR_UNKNOWN');
    expect(await f.allEvidence()).toEqual(before);
});

test.each([true, false])('reviewed correction appends exact evidence and replays recorded limits after current limits change (native=%s)', async native => {
    const f = await failedFixture(native), original = await f.read(), failed = original.evaluations[0], reading = original.measurements[0];
    await f.setPolicy([{ key: 'qc.blankMaxAllowed', value: 0.001 }]);
    const response = await f.submit(f.reviewer);
    expect(response.status).toBe(200); expect(response.body.batch.analytes[0].status).toBe('QC_PASS');
    const after = await f.read(), replacement = after.measurements.find(row => row.id !== reading.id);
    expect(after.evaluations).toHaveLength(2); expect(after.evaluations[0]).toEqual(failed);
    expect(after.measurements.find(row => row.id === reading.id)).toEqual({ ...reading, supersededById: replacement.id });
    expect(replacement).toMatchObject({ value: 0.0123456789, rawInput: '0.0123456789', enteredBy: f.reviewer.username, correctionReason: f.inputCorrection.reason });
    expect(after.evaluations[1]).toMatchObject({ supersedesId: failed.id, verdict: 'PASS' });
    const details = JSON.parse(after.evaluations[1].details), event = after.events.find(row => row.type === 'QC_TRANSCRIPTION_CORRECTED');
    expect(details.criteriaSource.type).toBe(native ? 'FROZEN_NATIVE_CRITERIA' : 'RECORDED_COMPATIBILITY_EVALUATION');
    expect(details.evaluation.blanks[0].maxAllowed).toBe(0.05);
    expect(JSON.parse(event.payload)).toMatchObject({ reviewer: { id: f.reviewer.id, username: f.reviewer.username },
        observationAuthors: [{ id: f.analyst.id, username: f.analyst.username }], sourceReference: f.inputCorrection.sourceReference,
        previousEvaluationId: failed.id, previousVerdict: 'FAIL', evaluationId: after.evaluations[1].id,
        replacements: [{ original: { id: reading.id, value: 9.123456789 }, replacement: { id: replacement.id, value: 0.0123456789 } }] });
    if (native) expect(JSON.parse(event.payload).runAnalyst).toMatchObject({ id: f.analyst.id });
    else expect(JSON.parse(event.payload).runAnalyst).toBeNull();
    expect(after.dispositions).toHaveLength(0);
    const before = await f.allEvidence();
    expect((await f.submit(f.reviewer)).body.code).toBe('QC_REVIEWED_STATE_LOCKED');
    expect(await f.allEvidence()).toEqual(before);
});

test.each([true, false])('a reviewed replacement that still fails retains the failed state and both evaluations (native=%s)', async native => {
    const f = await failedFixture(native), original = await f.read();
    const response = await f.submit(f.reviewer, { ...f.inputCorrection, corrections: [{ positionId: f.blank.id, value: 1.123456789 }] });
    expect(response.status).toBe(200); expect(response.body.batch.analytes[0].status).toBe('QC_FAIL');
    const after = await f.read(); expect(after.evaluations.map(row => row.verdict)).toEqual(['FAIL', 'FAIL']);
    expect(after.evaluations[0]).toEqual(original.evaluations[0]); expect(after.dispositions).toHaveLength(0);
});

test.each([true, false])('new observations use current input format while unchanged stored numbers remain exact (native=%s)', async native => {
    const f = await failedFixture(native, { duplicate: true }), original = await f.read();
    await f.setPolicy([{ key: 'numbers.decimalSeparator', value: ',' }, { key: 'numbers.thousandsSeparator', value: '.' }]);
    const response = await f.submit(f.reviewer, { ...f.inputCorrection, corrections: [{ positionId: f.blank.id, rawInput: '0,0123456789' }] });
    expect(response.status).toBe(200); expect(response.body.batch.analytes[0].status).toBe('QC_PASS');
    const after = await f.read();
    for (const old of original.measurements.filter(row => row.positionId !== f.blank.id)) expect(after.measurements.find(row => row.id === old.id)).toEqual(old);
    expect(after.measurements.find(row => row.positionId === f.blank.id && !row.supersededById)).toMatchObject({ rawInput: '0,0123456789', value: 0.0123456789 });
    for (const row of JSON.parse(after.evaluations[1].details).evaluation.duplicates) expect(row).toMatchObject({ value1: 2.1234, value2: 2.1234, status: 'PASS' });
});

test.each(['ACCEPT_WITH_DEVIATION', 'REJECT', 'REPEAT_BATCH'])('disposition %s stays locked to reviewed transcription correction', async decision => {
    const f = await failedFixture(true);
    await require('../../services/qcDispositionStateService').dispositionBatch(f.run.id, decision, 'Recorded disposition decision', f.reviewer, f.db, { analysisCode: f.analysisCode });
    const before = await f.allEvidence();
    expect((await f.submit(f.reviewer)).body.code).toBe('QC_REVIEWED_STATE_LOCKED');
    expect(await f.allEvidence()).toEqual(before);
});

test('closed accepted QC stays locked and lab scope cannot be supplied by the caller', async () => {
    const f = await failedFixture(true); expect((await f.submit(f.reviewer)).status).toBe(200);
    await require('../../services/qcRunMutationService').mutateQcRun(f.db, f.run.id, f.reviewer, { analysisCode: f.analysisCode, status: 'CLOSED' });
    const before = await f.allEvidence();
    expect((await f.submit(f.reviewer)).body.code).toBe('QC_BATCH_LOCKED'); expect(await f.allEvidence()).toEqual(before);
    const lab = await f.db.lab.create({ data: { id: randomUUID(), code: randomUUID(), name: 'Other lab', country: 'TEST' } });
    const user = await f.db.user.create({ data: { id: randomUUID(), username: randomUUID(), email: `${randomUUID()}@example.test`, password: 'fixture', role: 'LAB_MANAGER', labId: lab.id } });
    const scopedBefore = await f.allEvidence();
    const response = await f.submit({ ...user, labId: lab.id }); expect(response.status).toBe(403);
    expect(await f.allEvidence()).toEqual(scopedBefore);
});

test('all preset defaults keep reviewed corrections off and missing recorded criteria refuse', async () => {
    const key = require('../../config/policyRegistry').registry['qc.reviewedTranscriptionCorrectionEnabled'];
    expect(key.scope).toBe('LAB'); expect(Object.values(key.presets)).toEqual([false, false, false]);
    const f = await failedFixture(false), batch = await f.read();
    const evidence = require('../../services/qcRunViewService').currentAnalyteEvidence(batch, f.analysisCode);
    const { compatibilityCriteria } = require('../../services/qcReviewedCorrectionService');
    for (const transform of [stored => { delete stored.qcRule.requirements; }, stored => { delete stored.policyValues['qc.mode']; },
        stored => { delete stored.qcRule.resolved.failAction; }, stored => { delete stored.blanks[0].maxAllowed; }]) {
        const original = JSON.parse(evidence.evaluation.details); transform(original.evaluation);
        const before = await f.allEvidence();
        expect(() => compatibilityCriteria({ previousEvaluation: { ...evidence.evaluation, details: JSON.stringify(original) } }, evidence, { decimal: '.', thousands: null }))
            .toThrow(expect.objectContaining({ statusCode: 409, code: 'QC_REVIEWED_CRITERIA_UNAVAILABLE' }));
        expect(await f.allEvidence()).toEqual(before);
    }
});

test('later generated report and PDF disclose the original failed evaluation and reviewed replacement in every locale', async () => {
    const f = await failedFixture(true); expect((await f.submit(f.reviewer)).status).toBe(200);
    const item = await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } }); await f.result(item);
    for (const status of ['COMPLETED', 'SUBMITTED', 'ACCEPTED']) await require('../../services/workItemStateService').transitionWorkItem(item.id, status, f.actor, 'Reviewed report fixture', {}, f.db);
    const PDFDocument = require('pdfkit'), text = jest.spyOn(PDFDocument.prototype, 'text');
    try {
        for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const { content: report } = await require('../../services/reportAssembly').assembleReport(item.sampleId, { ...f.reviewer, language: locale }, { db: f.db });
            expect(report.evidence.qc.withinLimits).toBe(true);
            expect(report.evidence.qc.reviewedCorrections).toHaveLength(1);
            const correction = report.evidence.qc.reviewedCorrections[0];
            expect(correction.originalEvaluation.verdict).toBe('FAIL'); expect(correction.replacementEvaluation.verdict).toBe('PASS');
            for (const value of [f.reviewer.username, f.inputCorrection.reason, f.inputCorrection.sourceReference, '9.123456789', '0.0123456789', correction.previousEvaluationId]) expect(report.qcStatement).toContain(value);
            expect(report.qcStatement).toContain(require(`../../locales/${locale}.json`).qcReviewedCorrection.disclosure);
            text.mockClear();
            const pdf = await require('../../services/pdfGenerator').generateReportPdfBuffer(report, { status: 'DRAFT' });
            expect(pdf.subarray(0, 5).toString()).toBe('%PDF-'); expect(text.mock.calls.map(([value]) => String(value))).toContain(report.qcStatement);
        }
    } finally { text.mockRestore(); }
});

test.each(['requirements', 'qcMode', 'failAction', 'blankLimit'])('the actual route refuses incomplete recorded %s with zero writes', async field => {
    const f = await failedFixture(false), beforeIncompleteRecord = await f.read(), previous = beforeIncompleteRecord.evaluations[0];
    const details = JSON.parse(previous.details);
    if (field === 'requirements') delete details.evaluation.qcRule.requirements;
    if (field === 'qcMode') delete details.evaluation.policyValues['qc.mode'];
    if (field === 'failAction') delete details.evaluation.qcRule.resolved.failAction;
    if (field === 'blankLimit') delete details.evaluation.blanks[0].maxAllowed;
    // Intentional incomplete retained-record fixture on this independently
    // owned database. Append it through Prisma; never rewrite the real failed
    // evaluation, alter guards, or change historical fixture authorities.
    await f.db.qcEvaluation.create({ data: { ...previous, id: randomUUID(), version: previous.version + 1,
        supersedesId: previous.id, details: JSON.stringify(details) } });
    const before = await f.allEvidence(), response = await f.submit(f.reviewer);
    expect(response.status).toBe(409); expect(response.body.code).toBe('QC_REVIEWED_CRITERIA_UNAVAILABLE');
    expect(await f.allEvidence()).toEqual(before);
    expect((await f.read()).evaluations[0]).toEqual(previous);
});

test('compatibility replay retains required counts when the current run profile changes', async () => {
    const f = await failedFixture(false), original = await f.read();
    const profiles = structuredClone(require('../../config/policyRegistry').strict('qc.runProfiles'));
    profiles.RACK_40.qcSlots.push({ position: 3, type: 'BLANK', label: 'New profile blank' });
    await f.setPolicy([{ key: 'qc.runProfiles', value: profiles }]);
    const response = await f.submit(f.reviewer); expect(response.status).toBe(200); expect(response.body.batch.analytes[0].status).toBe('QC_PASS');
    const after = await f.read(), evaluation = JSON.parse(after.evaluations[1].details).evaluation;
    expect(evaluation.qcRule.requirements.BLANK.required).toBe(1); expect(evaluation.qcRule.requirements.BLANK.found).toBe(1);
    expect(after.evaluations[0]).toEqual(original.evaluations[0]);
});

test('real legacy-imported NULL authors and historical snapshots stay locked without inventing authors or criteria', async () => {
    const fs = require('node:fs'), path = require('node:path'), Database = require('better-sqlite3');
    const { PrismaClient } = require('../../prisma_client'), { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const labId = randomUUID(), batchId = randomUUID(), analysis = `LEGACY-${randomUUID()}`, username = `legacy-reviewer-${randomUUID()}`, userId = randomUUID();
    const failed = value => ({ blanks: [{ value, status: 'FAIL', maxAllowed: 0.05 }], controls: [], duplicates: [], overallStatus: 'QC_FAIL', summary: {} });
    const historical = require('../helpers/legacyWorkflowDatabase').beforeGuards({ actor: 'system:fixture', schemaVariant: 'PRE_1_3_SAMPLE_CODES',
        relatedRows: { Lab: [{ id: labId, code: labId, name: 'Retained QC author fixture', country: 'TEST', updatedAt: Date.now() }],
            User: [{ id: userId, username, email: `${randomUUID()}@example.test`, password: 'fixture', role: 'SUPER_ADMIN', updatedAt: Date.now() }] },
        batches: [{ id: batchId, labId, analysis, status: 'QC_FAIL', createdBy: username, workItemIds: '[]',
            qcResults: JSON.stringify(failed(9.123456789)), history: JSON.stringify([{ action: 'QC_EVIDENCE_SNAPSHOT', seq: 1,
                snapshot: { qcResults: failed(8.123456789), qcItems: [], status: 'QC_FAIL', disposition: null, workItemIds: [] } }]) }] });
    const connection = new Database(historical.file, { fileMustExist: true });
    try { connection.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)'); }
    finally { connection.close(); }
    for (const [script, installer] of [['install_reference_materials', 'installReferenceMaterials'], ['install_qc_rules', 'installQcRules'], ['install_qc_runs', 'installQcRuns']]) {
        const install = require(`../../scripts/${script}`)[installer], dry = install({ dbPath: historical.file });
        install({ dbPath: historical.file, apply: true, ...(script === 'install_qc_runs' && { planSha256: dry.backfillFingerprint }) });
    }
    require('../../scripts/install_qc_gate_scope').installQcGateScope({ dbPath: historical.file, apply: true });
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${historical.file}` }) });
    owned.push({ close: async () => {
        await db.$disconnect();
        if (path.dirname(historical.file) !== path.resolve(__dirname, '../.tmp') || !path.basename(historical.file).startsWith('audit_legacy_')) throw Error('Only the owned retained fixture may be removed.');
        for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(historical.file + suffix)) fs.unlinkSync(historical.file + suffix);
    } });
    const actor = { id: userId, username, role: 'SUPER_ADMIN', labId };
    await require('../../services/policyService').change(actor, labId, { reason: 'Explicit retained author guard fixture',
        changes: [{ key: 'qc.reviewedTranscriptionCorrectionEnabled', value: true }] }, { db });
    const batch = await db.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE });
    const snapshot = async () => JSON.parse(JSON.stringify(await Promise.all([db.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE }), db.auditLog.findMany()])));
    expect(batch.measurements.every(row => row.enteredBy === null)).toBe(true);
    for (const [position, code] of [[batch.positions.find(row => row.historicalSnapshotSeq == null), 'QC_REVIEWED_AUTHOR_UNKNOWN'],
        [batch.positions.find(row => row.historicalSnapshotSeq === 1), 'QC_MEASUREMENT_NOT_FOUND']]) {
        expect(position).toBeDefined(); const before = await snapshot();
        await withQcRunHttp(db, actor, async (app, token) => {
            const response = await request(app).post(`/api/qc/batches/${batchId}/corrections`).set('Authorization', `Bearer ${token}`)
                .send({ mode: MODE, analysisCode: analysis, reason: 'Source value needs correction', sourceReference: 'Retained worksheet line 4', corrections: [{ positionId: position.id, value: 0.01 }] });
            expect(response.status).toBeGreaterThanOrEqual(400); expect(response.body.code).toBe(code);
        });
        expect(await snapshot()).toEqual(before);
    }
});
