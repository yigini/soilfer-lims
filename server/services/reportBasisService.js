'use strict';
// #205 pin 6099330444: an oven-dry report converts only uncensored air-dry
// results whose analysis the lab has explicitly marked convertible, using the
// frozen gravimetric moisture correction factor of the reported SOIL_MOISTURE.
const { TransitionError } = require('./workflowStateRules');

const REPORT_BASES = Object.freeze(['AS_RECORDED', 'OVEN_DRY']);

function normalizeBasis(value) {
    if (value === undefined || value === null || value === '') return 'AS_RECORDED';
    if (!REPORT_BASES.includes(value)) throw new TransitionError('Unknown report basis.', 400, 'REPORT_BASIS_INVALID', { allowed: REPORT_BASES });
    return value;
}

function parseObject(value) {
    try { const parsed = typeof value === 'string' ? JSON.parse(value) : value; return parsed && typeof parsed === 'object' ? parsed : null; }
    catch { return null; }
}

/** The air-dry ÷ oven-dry factor frozen with every reported SOIL_MOISTURE source result. */
async function moistureFactor(db, sourceResults) {
    const sources = sourceResults.filter(result => result.param === 'SOIL_MOISTURE');
    const refuse = reason => new TransitionError('An oven-dry report needs the reported gravimetric soil moisture result.', 409,
        'MOISTURE_FACTOR_REQUIRED', { reason });
    if (!sources.length) throw refuse('NO_REPORTED_SOIL_MOISTURE');
    const factors = [];
    for (const source of sources) {
        const calculation = await db.resultCalculation.findUnique({ where: { resultId: source.id }, include: { template: true } });
        const factor = parseObject(calculation?.intermediate)?.moistureCorrectionFactor;
        if (!calculation || calculation.template?.formulaModule !== 'GRAVIMETRIC_MOISTURE') throw refuse('NOT_GRAVIMETRIC');
        if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 1 || factor > 3) throw refuse('FACTOR_INVALID');
        factors.push(factor);
    }
    // The factor is 1 + w/100, so the mean factor matches the mean water content.
    const factor = factors.reduce((sum, value) => sum + value, 0) / factors.length;
    return { factor: Math.round(factor * 1e6) / 1e6, waterContentPct: Math.round((factor - 1) * 1e6) / 1e4,
        sourceResultIds: sources.map(source => source.id) };
}

function decimalsOf(text, fallback) {
    const match = /^-?\d+(?:\.(\d+))?$/.exec(String(text).trim());
    if (!match) return null;
    return match[1] ? match[1].length : Number.isInteger(fallback) ? fallback : 0;
}

/** Converts eligible items in place and returns how many changed. */
async function applyOvenDryBasis(db, labId, items, moisture) {
    const policyService = require('./policyService');
    let converted = 0;
    for (const item of items) {
        if (item.basis !== 'AIR_DRY' || item.censoring !== 'NONE' || item.reportedMode === 'NOT_REPORTABLE' || item.param === 'SOIL_MOISTURE') continue;
        const decimals = decimalsOf(item.value, item.decimalPlaces);
        if (decimals === null) continue;
        const enabled = labId && await policyService.get(labId, 'report.ovenDryConvertible',
            { db, analysisCode: item.param, methodologyId: item.methodologyId || null });
        if (enabled !== true) continue;
        const airDryValue = item.value;
        item.value = (Number(airDryValue) * moisture.factor).toFixed(decimals);
        item.basis = 'OVEN_DRY';
        item.basisConversion = { from: 'AIR_DRY', factor: moisture.factor, airDryValue, sourceResultIds: moisture.sourceResultIds };
        if (item.uncertainty?.state === 'EXPANDED') item.uncertainty = { ...item.uncertainty, value: item.uncertainty.mode === 'EXPANDED_ABSOLUTE'
            ? item.uncertainty.value * moisture.factor : Math.abs(Number(item.value)) * item.uncertainty.relativePct / 100 };
        converted++;
    }
    return converted;
}

/** The printed basis line: the factor, the water content it came from, and the converted analyses. */
function basisStatement(moisture, locale = 'en') {
    const canonical = ['en', 'es', 'es-419', 'fr', 'pt'].includes(locale) ? locale : 'en';
    const labels = require(`../locales/${canonical}.json`).resultReports.reportBasis;
    return `${labels.ovenDry}: ${labels.factor} ${moisture.factor} (${labels.waterContent} ${moisture.waterContentPct} %) · ${moisture.convertedParams.join(', ')}`;
}

module.exports = { REPORT_BASES, normalizeBasis, moistureFactor, applyOvenDryBasis, basisStatement };
