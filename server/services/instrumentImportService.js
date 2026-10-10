const { createHmac, createHash, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { inTransaction, actorName } = require('./workflowStateRules');
const { fail } = require('./instrumentImportTemplateService');
const { previewInstrumentImport } = require('./instrumentImportPreviewService');
const { commitImportedDraft } = require('./instrumentImportDraftService');
const { commitQcMeasurements } = require('./instrumentImportQcService');
const processPreviewKey = randomBytes(32);
const key = () => process.env.JWT_SECRET || processPreviewKey;
function context(preview, actor) {
    return { version: 1, actor: actorName(actor), batchId: preview.batchId, labId: preview.labId,
        instrumentId: preview.instrumentId, templateId: preview.templateId, templateVersion: preview.templateVersion,
        sourceName: preview.sourceName, sourceSha256: preview.sourceSha256, activations: preview.activations,
        numberPolicy: preview.numberPolicy, sheetName: preview.sheetName ?? null, requestedSheetName: preview.requestedSheetName ?? null };
}
function seal(value) {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    return payload + '.' + createHmac('sha256', key()).update(payload).digest('base64url');
}
function readSeal(token) {
    const invalid = () => { throw fail(400, 'IMPORT_PREVIEW_INVALID', 'Preview this exact file and mapping before committing.'); };
    if (typeof token !== 'string' || token.length > 262144) invalid();
    const parts = token.split('.'); if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) invalid();
    const expected = createHmac('sha256', key()).update(parts[0]).digest(), supplied = Buffer.from(parts[1], 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) invalid();
    try { const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); if (value?.version !== 1) invalid(); return value; }
    catch { invalid(); }
}
async function preview(db, actor, input) {
    const result = await inTransaction(db, tx => previewInstrumentImport(tx, actor, input));
    return { ...result, previewToken: seal(context(result, actor)) };
}
async function commit(db, actor, input) {
    const prior = readSeal(input?.previewToken);
    if (!Buffer.isBuffer(input.bytes) || prior.actor !== actorName(actor) || prior.batchId !== input.batchId ||
        prior.templateId !== input.templateId || prior.sourceName !== input.sourceName ||
        prior.sourceSha256 !== createHash('sha256').update(input.bytes).digest('hex'))
        throw fail(400, 'IMPORT_PREVIEW_INVALID', 'Commit the exact source and mapping that you previewed.');
    return inTransaction(db, async tx => {
        const current = await previewInstrumentImport(tx, actor, input);
        if (JSON.stringify(prior.activations) !== JSON.stringify(current.activations))
            throw fail(409, 'IMPORT_TEMPLATE_ACTIVATION_CHANGED', 'The activated calculation changed; preview again.');
        if (JSON.stringify(prior) !== JSON.stringify(context(current, actor)))
            throw fail(400, 'IMPORT_PREVIEW_INVALID', 'The scoped preview context differs.');
        if (!current.canCommit) {
            const first = current.refusals[0], error = fail(first.statusCode || 409, first.code, 'Review every refused row before importing.');
            error.details = { refusedRows: current.refusals }; throw error;
        }
        const receipt = await tx.instrumentImportReceipt.create({ data: { id: randomUUID(), labId: current.labId,
            instrumentId: current.instrumentId, templateId: current.templateId, templateVersion: current.templateVersion,
            sourceName: current.sourceName, sourceSha256: current.sourceSha256,
            mappingSnapshot: JSON.stringify(current), importedBy: actorName(actor) } });
        let draftCount = 0, qcCount = 0;
        const qcByAnalysis = new Map();
        for (const row of current.rows) for (const plan of row.plans) {
            if (plan.kind === 'DRAFT') {
                try { await commitImportedDraft(tx, actor, plan.input, receipt.id); draftCount++; }
                catch (error) { error.details = { refusedRows: [{ rowNumber: row.rowNumber,
                    analysisCode: plan.analysisCode, code: error.code || 'IMPORT_LINE_NOT_ENTERABLE' }] }; throw error; }
            } else {
                if (!qcByAnalysis.has(plan.analysisCode)) qcByAnalysis.set(plan.analysisCode, []);
                qcByAnalysis.get(plan.analysisCode).push(plan.measurement);
            }
        }
        for (const [analysisCode, measurements] of qcByAnalysis) {
            await commitQcMeasurements(tx, actor, { batchId: current.batchId, analysisCode,
                measurements, importReceiptId: receipt.id }); qcCount += measurements.length;
        }
        await tx.auditLog.create({ data: { id: randomUUID(), entity: 'INSTRUMENT_IMPORT', entityId: receipt.id,
            labId: current.labId, action: 'INSTRUMENT_IMPORT_COMMITTED', performedBy: actorName(actor),
            details: JSON.stringify({ batchId: current.batchId, sourceSha256: current.sourceSha256, draftCount, qcCount,
                skippedRows: current.rows.filter(row => row.status === 'SKIPPED_UNMATCHED').map(row => row.rowNumber) }) } });
        return { receiptId: receipt.id, draftCount, qcCount, rows: current.rows.map(row => ({ rowNumber: row.rowNumber,
            status: row.status, sourceId: row.match.sourceId, positionId: row.match.positionId })) };
    });
}
module.exports = { preview, commit };
