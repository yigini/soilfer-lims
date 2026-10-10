const { templateForRun, fail } = require('./instrumentImportTemplateService');
const { decodeInstrumentDelimitedSource } = require('./instrumentDelimitedSource');
const { matchInstrumentRow } = require('./instrumentImportRowMatch');
const { numericReportingUnit } = require('./resultReportingUnit');
const { readDraftContext } = require('./draftService');
const { getNumberFormat } = require('./numberFormatService');
const { parseNumber } = require('../../shared/numberParse');
const { prepareNativeObservationEntries } = require('./qcNativeCandidateService');
const { currentAnalyteEvidence } = require('./qcRunViewService');
const policy = require('./policyService');
const activations = require('./calculationActivationService');
const calculationTemplates = require('./calculationTemplateService');

async function analysisBinding(db, lab, analyte, mapping, active) {
    const analysis = await db.analysis.findUnique({ where: { code: mapping.analysisCode } });
    if (!active) {
        if (mapping.inputs) throw fail(409, 'IMPORT_TEMPLATE_BINDING_REQUIRED', 'Bind inputs to the laboratory activated template.');
        return { analysis, active: null, inputs: null };
    }
    if (!mapping.inputs) throw fail(400, 'IMPORT_TEMPLATE_MAPPING_INVALID', 'Save an input mapping for the activated template.');
    const activation = await activations.readBoundActivation(db, active.activationId);
    const row = await db.calcTemplate.findUnique({ where: { id: active.templateId } });
    if (!activation || activation.action !== 'ACTIVATE' || activation.labId !== lab.id ||
        activation.analysisCode !== mapping.analysisCode || activation.methodologyId !== analyte.methodologyId ||
        activation.templateId !== active.templateId || activation.templateVersion !== active.templateVersion ||
        !row || row.labId !== lab.id || row.analysisCode !== mapping.analysisCode || row.version !== active.templateVersion ||
        row.methodologyId !== null && row.methodologyId !== analyte.methodologyId)
        throw fail(409, 'IMPORT_TEMPLATE_BINDING_REQUIRED', 'The activated input definition is unavailable.');
    const definition = calculationTemplates.decode(row), names = mapping.inputs.map(input => input.variable);
    if (names.length !== definition.inputs.length || new Set(names).size !== names.length ||
        definition.inputs.some(input => !names.includes(input.key)))
        throw fail(409, 'IMPORT_TEMPLATE_BINDING_REQUIRED', 'Bind each activated input exactly once.');
    return { analysis, active, inputs: definition.inputs };
}
function unitCell(binding, cells) {
    return Object.hasOwn(binding, 'unitColumn') ? cells[binding.unitColumn] : binding.unit;
}
function parsedValue(raw, numberFormat, input = false) {
    const parsed = parseNumber(raw, numberFormat);
    if (!parsed.valid || input && parsed.qualifier)
        throw fail(400, input ? 'CALC_INPUT_INVALID' : parsed.code, 'Enter a valid raw measurement.');
    return parsed;
}
function measurements(binding, mapping, cells, numberFormat) {
    if (mapping.inputs) {
        const inputs = {}, evidence = [];
        for (const input of mapping.inputs) {
            const declared = binding.inputs.find(row => row.key === input.variable), rawUnit = unitCell(input, cells);
            if (rawUnit !== declared.unit) throw fail(409, 'IMPORT_UNIT_MISMATCH', 'Use the exact activated input unit.');
            const rawValue = cells[input.column]; parsedValue(rawValue, numberFormat, true);
            inputs[input.variable] = rawValue;
            evidence.push({ variable: input.variable, column: input.column, rawValue, rawUnit,
                unitColumn: input.unitColumn ?? null, declaredUnit: declared.unit, ...binding.active });
        }
        return { value: '', values: { calculation: { ...binding.active, inputs } },
            evidence: { mode: 'ACTIVATED_INPUTS', inputs: evidence, activation: binding.active } };
    }
    const rawValue = cells[mapping.valueColumn], rawUnit = unitCell(mapping, cells);
    const unit = numericReportingUnit({ analysis: binding.analysis }, { param: mapping.analysisCode, unit: rawUnit }, { instrumentImport: true });
    const rawDilution = mapping.dilutionColumn === undefined ? null : cells[mapping.dilutionColumn];
    if (rawDilution != null && rawDilution.trim()) {
        const dilution = parseNumber(rawDilution, numberFormat);
        if (!dilution.valid || dilution.qualifier || dilution.value !== 1)
            throw fail(409, 'IMPORT_DILUTION_UNSUPPORTED', 'Direct imports accept absent dilution or one.');
    }
    parsedValue(rawValue, numberFormat);
    return { value: rawValue, values: null, evidence: { mode: 'DIRECT_VALUE', valueColumn: mapping.valueColumn,
        rawValue, rawUnit, unitColumn: mapping.unitColumn ?? null, rawDilution,
        dilutionColumn: mapping.dilutionColumn ?? null, reportingUnit: unit.evidence } };
}

// This owner reads actual run, template, activation, catalogue, draft and QC
// evidence. It constructs candidate plans without persisting or calculating.
async function previewInstrumentImport(db, actor, { batchId, templateId, sourceName, bytes }) {
    const { batch, template, lab, instrument } = await templateForRun(db, actor, batchId, templateId);
    if (typeof sourceName !== 'string' || !sourceName.trim() || !/\.(csv|txt)$/i.test(sourceName))
        throw fail(400, 'IMPORT_FILE_TYPE_UNSUPPORTED', 'Select a CSV or TXT source file.');
    const delimiter = { COMMA: ',', SEMICOLON: ';', TAB: '\t' }[template.mapping.delimiter];
    const decoded = decodeInstrumentDelimitedSource(bytes, delimiter);
    const sampleIds = [...new Set(batch.positions.map(row => row.sampleId).filter(Boolean))];
    const samples = await db.sample.findMany({ where: { id: { in: sampleIds } }, select: { id: true, labSampleCode: true, originalId: true } });
    const bindings = new Map(), formats = new Map(), activationContexts = {};
    for (const mapping of template.mapping.analytes) {
        const analyte = batch.analytes.find(row => row.analysisCode === mapping.analysisCode);
        const active = await policy.calcTemplate(lab.id, { analysisCode: mapping.analysisCode, methodologyId: analyte.methodologyId }, { db });
        activationContexts[mapping.analysisCode] = active;
        try { bindings.set(mapping.analysisCode, await analysisBinding(db, lab, analyte, mapping, active)); }
        catch (error) { bindings.set(mapping.analysisCode, { error }); }
        formats.set(mapping.analysisCode, await getNumberFormat(lab.id, { db, analysisCode: mapping.analysisCode, methodologyId: analyte.methodologyId }));
    }
    const header = template.mapping.hasHeader ? decoded.rows[0] : null;
    const sourceRows = template.mapping.hasHeader ? decoded.rows.slice(1) : decoded.rows;
    const rows = [], destinations = new Map();
    for (const source of sourceRows) {
        const match = matchInstrumentRow(batch, samples, template.mapping, source.cells);
        const row = { ...source, match, status: match.kind === 'UNKNOWN' ? 'SKIPPED_UNMATCHED' : 'MATCHED', errors: [], plans: [] };
        rows.push(row);
        if (match.kind === 'UNKNOWN') continue;
        if (match.kind === 'AMBIGUOUS') { row.errors.push({ code: 'IMPORT_MATCH_AMBIGUOUS', sourceCode: match.code }); continue; }
        if (source.error || header?.error || header && source.cells.length !== header.cells.length) {
            row.errors.push({ code: 'IMPORT_ROW_INVALID', sourceCode: source.error || header?.error || 'COLUMN_COUNT_MISMATCH' }); continue;
        }
        for (const mapping of template.mapping.analytes) {
            try {
                if (match.kind === 'QC' && mapping.inputs)
                    throw fail(400, 'IMPORT_TEMPLATE_MAPPING_INVALID', 'Calculated-analysis QC entry belongs to its QC workflow.');
                const binding = bindings.get(mapping.analysisCode);
                if (binding.error) throw binding.error;
                const raw = measurements(binding, mapping, source.cells, formats.get(mapping.analysisCode));
                let plan;
                if (match.kind === 'SAMPLE') {
                    const workItemId = match.workItemIdsByAnalysis[mapping.analysisCode];
                    if (!workItemId) throw fail(409, 'IMPORT_LINE_NOT_IN_RUN', 'The position has no line for this analysis.');
                    const item = await readDraftContext(db, actor, { workItemId, instrumentId: instrument.id }, { importing: true });
                    if (item.batchId !== batch.id || item.sampleId !== match.sampleId || item.analysis !== mapping.analysisCode)
                        throw fail(409, 'IMPORT_LINE_NOT_IN_RUN', 'The line differs from the selected native position.');
                    plan = { kind: 'DRAFT', analysisCode: mapping.analysisCode, input: { workItemId, sampleId: item.sampleId,
                        analysis: item.analysis, value: raw.value, values: raw.values, instrumentId: instrument.id,
                        methodologyId: item.methodologyId, baseVersion: item.version }, evidence: raw.evidence };
                } else {
                    const analyte = batch.analytes.find(item => item.analysisCode === mapping.analysisCode);
                    if (!['IN_RUN', 'QC_PENDING'].includes(analyte.status) || currentAnalyteEvidence(batch, mapping.analysisCode).evaluation)
                        throw fail(409, 'QC_IMPORT_ANALYTE_EVALUATED', 'Evaluated QC cannot receive imported observations.');
                    const measurement = { positionId: match.positionId, value: raw.value };
                    prepareNativeObservationEntries(batch, mapping.analysisCode, [measurement], { performedBy: actor.username });
                    plan = { kind: 'QC', analysisCode: mapping.analysisCode, measurement, evidence: raw.evidence };
                }
                row.plans.push(plan);
                const destination = plan.kind === 'DRAFT' ? plan.input.workItemId : `${match.positionId}:${mapping.analysisCode}`;
                if (!destinations.has(destination)) destinations.set(destination, []);
                destinations.get(destination).push(row);
            } catch (error) {
                row.errors.push({ analysisCode: mapping.analysisCode, code: error.code || 'IMPORT_LINE_NOT_ENTERABLE',
                    message: error.message, statusCode: error.statusCode || 409 });
            }
        }
    }
    for (const repeated of destinations.values()) if (repeated.length > 1)
        for (const row of repeated) row.errors.push({ code: 'IMPORT_MATCH_AMBIGUOUS', sourceCode: 'IMPORT_TARGET_DUPLICATE' });
    const refusals = rows.flatMap(row => row.errors.map(error => ({ rowNumber: row.rowNumber, ...error })));
    if (!rows.some(row => row.match.kind !== 'UNKNOWN')) refusals.push({ rowNumber: null, code: 'IMPORT_NO_MATCHED_ROWS' });
    return { batchId: batch.id, labId: lab.id, instrumentId: instrument.id, templateId: template.id, templateVersion: template.version,
        mapping: template.mapping, sourceName, sourceSha256: decoded.sourceSha256, header, rows,
        activations: activationContexts,
        refusals, canCommit: refusals.length === 0 };
}
module.exports = { previewInstrumentImport };
