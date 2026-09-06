const prisma = require('../prisma');

const MATRICES = ['SOIL', 'PLANT', 'WATER', 'AMENDMENT', 'FERTILIZER', 'LIMING'];
const GATE_CODES = new Set(['DRYING', 'PREPARATION', 'ARCHIVING', 'DISPOSAL']);

function parseJson(value, fallback = null) {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return fallback; }
}

function validationError(validation) {
    if (validation == null) return null;
    const rules = parseJson(validation, false);
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return 'Validation must be a JSON object.';
    for (const key of ['min', 'max', 'decimalPlaces']) {
        if (rules[key] != null && (typeof rules[key] !== 'number' || !Number.isFinite(rules[key]))) {
            return `${key} must be a finite number or left blank.`;
        }
    }
    if (rules.min != null && rules.max != null && rules.min > rules.max) return 'Minimum cannot exceed maximum.';
    if (rules.decimalPlaces != null && (!Number.isInteger(rules.decimalPlaces) || rules.decimalPlaces < 0 || rules.decimalPlaces > 10)) {
        return 'Display decimals must be an integer between 0 and 10.';
    }
    return null;
}

function configurationIssues(analysis) {
    const issues = [];
    if (!analysis.name?.trim() || analysis.name === analysis.code || /^https?:/i.test(analysis.name)) issues.push('A descriptive parameter name is required.');
    if (/^SPEC_PARAM_\d+$/i.test(analysis.code)) issues.push('Placeholder parameter: define a real measurand and method before ordering.');
    if (analysis.name === `${analysis.code} Determination`) issues.push('Imported definition has not been curated: verify the parameter name, measurement unit and applicable method.');
    if (['pH', 'PH_H2O', 'PH_KCL', 'PH_CACL2', 'WATER_PH', 'hydraulicConductivity', 'availableWaterHoldingCapacity', 'textureSum'].includes(analysis.code) && analysis.units === 'mg/kg') issues.push('The configured mass-concentration unit does not describe this quantity. Correct the definition before new orders.');
    if (GATE_CODES.has(analysis.code)) issues.push('Operational work is created through the preparation workflow, not ordered as an analysis.');
    const invalid = validationError(analysis.validation);
    if (invalid) issues.push(invalid);
    return issues;
}

function describeAnalysis(analysis) {
    const issues = configurationIssues(analysis);
    const scientificWarnings = [];
    if (/Total/i.test(analysis.name || '') && /Aqua Regia/i.test(analysis.name || '')) scientificWarnings.push('Check total vs acid-extractable content against the selected digestion method; these are not interchangeable measurands.');
    if (['TEXTURE', 'pSA', 'PSA', 'textureSum'].includes(analysis.code)) scientificWarnings.push('Record sand, silt and clay together on the same basis; calculate the texture class from the validated fractions.');
    if (analysis.code === 'AGG_STABILITY' && analysis.units === '%') scientificWarnings.push('Mean weight diameter and percentage aggregate stability are different outputs. Verify the method and reporting unit.');
    return { ...analysis, validation: parseJson(analysis.validation), configurationIssues: issues, scientificWarnings,
        orderable: analysis.status === 'active' && issues.length === 0 };
}

function validateAnalysisInput(body, existing = null) {
    const data = {};
    for (const key of ['name', 'description', 'categoryId', 'units', 'status', 'matrix', 'executionOrder', 'prerequisites', 'validation']) {
        if (body[key] !== undefined) data[key] = body[key];
    }
    if (!existing) {
        if (typeof body.code !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(body.code)) return { error: 'Use a stable internal code containing letters, numbers, underscores or hyphens.' };
        data.code = body.code;
        data.status = data.status ?? 'inactive';
        data.matrix = data.matrix ?? 'SOIL';
        data.executionOrder = data.executionOrder ?? 100;
    }
    if ('name' in data) {
        if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 240) return { error: 'A parameter name of 1–240 characters is required.' };
        data.name = data.name.trim();
    } else if (!existing) return { error: 'A parameter name is required.' };
    for (const key of ['description', 'units', 'categoryId']) {
        if (key in data) {
            if (data[key] != null && typeof data[key] !== 'string') return { error: `${key} must be text.` };
            data[key] = data[key]?.trim() || null;
        }
    }
    if ('status' in data && !['active', 'inactive'].includes(data.status)) return { error: 'Status must be active or inactive.' };
    if ('matrix' in data && !MATRICES.includes(data.matrix)) return { error: 'Choose a supported sample matrix.' };
    if ('executionOrder' in data && (!Number.isInteger(data.executionOrder) || data.executionOrder < 0)) return { error: 'Execution order must be a non-negative integer.' };
    if ('validation' in data) {
        const error = validationError(data.validation);
        if (error) return { error };
        data.validation = data.validation == null ? null : JSON.stringify(parseJson(data.validation));
    }
    if ('prerequisites' in data) {
        const deps = parseJson(data.prerequisites, []);
        if (!Array.isArray(deps) || deps.some(code => typeof code !== 'string' || !code.trim()) || (typeof data.prerequisites === 'string' && parseJson(data.prerequisites, false) === false)) return { error: 'Prerequisites must be a list of parameter codes.' };
        data.prerequisites = JSON.stringify([...new Set(deps)]);
    }
    const merged = { ...existing, ...data };
    if (merged.status === 'active') {
        const issues = configurationIssues(merged);
        if (issues.length) return { error: issues.join(' ') };
    }
    return { data };
}

// Only new selections are checked: retirement must not erase existing orders or history.
async function validateSelection(codes, { labId = null, existing = [], db = prisma } = {}) {
    if (!Array.isArray(codes) || codes.some(c => typeof c !== 'string' || !c.trim())) return { valid: false, error: 'Select parameters from the analysis catalogue.', issues: [] };
    if (new Set(codes).size !== codes.length) return { valid: false, error: 'The same parameter cannot be ordered twice.', issues: [] };
    const additions = codes.filter(c => !existing.includes(c));
    const records = await db.analysis.findMany({ where: { code: { in: additions } } });
    const defaults = await require('./methodResolution').resolveDefaultSelections(additions, labId, db);
    const byCode = new Map(records.map(a => [a.code, a]));
    const issues = additions.flatMap(code => {
        const a = byCode.get(code);
        if (!a || (a.labId && a.labId !== labId)) return [{ code, reason: 'Parameter is unavailable to this laboratory.' }];
        const reasons = configurationIssues(a);
        if (defaults.get(code)?.error) reasons.push(defaults.get(code).error);
        if (a.status && a.status !== 'active') reasons.unshift('Parameter is inactive for new orders.');
        return reasons.map(reason => ({ code, name: a.name, reason }));
    });
    return { valid: issues.length === 0, issues, error: issues.length ? issues.map(i => `${i.name || 'Unavailable parameter'}: ${i.reason}`).join(' ') : null };
}

// JSON references are checked as well as relational ones; completed work still counts.
async function analysisUsage(code, db = prisma) {
    const [workItems, results, orderLines, methodologies, defaults, equipment, groups, analyses, samples, externalMappings] = await Promise.all([
        db.workItem.count({ where: { analysis: code } }), db.result.count({ where: { param: code } }),
        db.orderLine.count({ where: { analysis: code } }), db.methodology.count({ where: { analysisCode: code } }),
        db.labMethodDefault.count({ where: { analysisCode: code } }), db.equipmentMethodEligibility.count({ where: { analysisCode: code } }),
        db.analysisGroup.findMany({ select: { analyses: true } }), db.analysis.findMany({ select: { prerequisites: true } }),
        db.sample.findMany({ where: { requiredAnalyses: { contains: code } }, select: { requiredAnalyses: true } }),
        db.externalMapping.count({ where: { entityType: 'ANALYSIS', entityKey: code } })
    ]);
    const includes = (value) => { const list = parseJson(value, []); return Array.isArray(list) && list.includes(code); };
    return { workItems, results, orderLines, methodologies, labDefaults: defaults, equipment, externalMappings,
        packages: groups.filter(g => includes(g.analyses)).length,
        dependencies: analyses.filter(a => includes(a.prerequisites)).length,
        sampleOrders: samples.filter(s => includes(s.requiredAnalyses)).length };
}

module.exports = { MATRICES, GATE_CODES, parseJson, validationError, configurationIssues, describeAnalysis, validateAnalysisInput, validateSelection, analysisUsage };
