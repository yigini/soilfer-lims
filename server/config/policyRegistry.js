// Policy values live here or in declarative deployment profiles, never in consumers.
const PRESETS = ['ISO17025_STRICT', 'BASIC', 'ADVISORY'];
const DEFAULT_RUN_PROFILES = {
    MICROPLATE_96: { profileKey: 'MICROPLATE_96', name: '96-Well Microplate', capacity: 96, qcSlots: [
        { position: 1, type: 'BLANK', label: 'Reagent Blank' }, { position: 2, type: 'CONTROL', label: 'Standard Soil CRM' },
        { position: 48, type: 'DUPLICATE', label: 'Mid-plate Duplicate' }, { position: 96, type: 'DUPLICATE', label: 'End-plate Duplicate' }] },
    CENTRIFUGE_24: { profileKey: 'CENTRIFUGE_24', name: '24-Place Tube Rack / Digestion Block', capacity: 24, qcSlots: [
        { position: 1, type: 'BLANK', label: 'Method Blank' }, { position: 2, type: 'CONTROL', label: 'Reference Soil CRM' },
        { position: 12, type: 'DUPLICATE', label: 'Mid-run Duplicate' }] },
    RACK_40: { profileKey: 'RACK_40', name: '40-Place Sedimentation / Carousel Rack', capacity: 40, qcSlots: [
        { position: 1, type: 'BLANK', label: 'Reagent / Hydrometer Blank' }, { position: 2, type: 'CONTROL', label: 'Standard Soil CRM' },
        { position: 20, type: 'DUPLICATE', label: 'Mid-rack Duplicate' }, { position: 40, type: 'DUPLICATE', label: 'End-rack Duplicate' }] }
};
const registry = {};
function key(name, type, strict, basic = strict, advisory = strict, options = {}) {
    registry[name] = { key: name, type, scope: 'LAB+METHOD', unit: null,
        description: `policies.keys.${name.replaceAll('.', '_')}`, ...options,
        presets: { ISO17025_STRICT: strict, BASIC: basic, ADVISORY: advisory } };
}
const integer = { min: 0 };
key('qc.mode', 'enum', 'REQUIRED_BLOCKING', 'REQUIRED_WARN', 'ADVISORY', { allowedValues: ['REQUIRED_BLOCKING', 'REQUIRED_WARN', 'ADVISORY', 'OFF'] });
key('qc.requireBatchQc', 'enum', 'AUTO', undefined, undefined, { allowedValues: ['AUTO', 'REQUIRED', 'NOT_REQUIRED'],
    help: 'policies.help.qc_requireBatchQc' });
key('qc.maxBatchSize', 'integer', 20, 40, null, { min: 1, nullable: true, unit: 'samples' });
key('qc.blankPerBatch', 'integer', 1, 1, 0, integer);
key('qc.duplicateEvery', 'integer', 10, 20, 0, { ...integer, unit: 'samples' });
key('qc.lrmPerBatch', 'integer', 1, 0, 0, integer);
key('qc.crmEveryNBatches', 'integer', 10, 0, 0, { ...integer, unit: 'batches' });
key('qc.ccvEvery', 'integer', 10, 20, 0, { ...integer, unit: 'samples' });
key('qc.calibrationVerification', 'boolean', false);
key('qc.reviewedTranscriptionCorrectionEnabled', 'boolean', false, false, false,
    { scope: 'LAB', description: 'qcReviewedCorrection.policyDescription' });
key('qc.calibrationFailAction', 'calibrationFailAction', { ICV: 'FAIL_BATCH', CCV: 'REPEAT_BRACKET', CCB: 'REPEAT_BRACKET' }, undefined, undefined, {
    allowedActions: { ICV: ['FAIL_BATCH', 'WARN'], CCV: ['FAIL_BATCH', 'REPEAT_BRACKET', 'WARN'], CCB: ['FAIL_BATCH', 'REPEAT_BRACKET', 'WARN'] },
    help: 'policies.help.qc_calibrationFailAction' });
key('qc.lrmLimitMode', 'enum', 'CONTROL_CHART', 'FIXED_WINDOW', 'FIXED_WINDOW', { allowedValues: ['CONTROL_CHART', 'FIXED_WINDOW'] });
key('qc.westgardRules', 'westgard', { reject: ['1-3s', '2-2s', 'R-4s'], warn: ['1-2s'] }, { reject: ['1-3s'], warn: [] }, { reject: [], warn: [] },
    { allowedValues: ['1-2s', '1-3s', '2-2s', 'R-4s', '4-1s', '10x'] });
key('qc.runProfiles', 'runProfiles', DEFAULT_RUN_PROFILES, DEFAULT_RUN_PROFILES, DEFAULT_RUN_PROFILES, { scope: 'LAB' });
key('qc.blankMaxAllowed', 'number', 0.05, 0.05, 0.05, { min: 0, unit: 'method unit' });
key('qc.controlMinRecovery', 'number', 90, 90, 90, { min: 0, unit: '%' });
key('qc.controlMaxRecovery', 'number', 110, 110, 110, { min: 0, unit: '%' });
key('qc.duplicateNearLoqMultiplier', 'number', 5, 5, 5, { min: 0, unit: 'LOQ multiplier' });
key('qc.duplicateMaxRpd', 'number', 10, 10, 10, { min: 0, unit: '%' });
key('qc.duplicateMode', 'enum', 'RPD', undefined, undefined, { allowedValues: ['RPD', 'ABS_DIFF'] });
key('qc.duplicateAbsMax', 'number', null, null, null, { min: 0, nullable: true, unit: 'method unit' });
key('qc.duplicateAbsMaxBelow5LOQ', 'number', null, null, null, { min: 0, nullable: true, unit: 'method unit' });
key('qc.blankLimitMode', 'enum', 'ABSOLUTE', undefined, undefined, { allowedValues: ['ABSOLUTE', 'LT_LOQ', 'LT_HALF_LOQ'] });
key('qc.crmMode', 'enum', 'RECOVERY', undefined, undefined, { allowedValues: ['RECOVERY', 'ABS_WINDOW', 'EN_SCORE'], unsupportedValues: ['EN_SCORE'] });
key('qc.crmAbsWindow', 'number', null, null, null, { min: 0, nullable: true, unit: 'method unit' });
key('qc.lrmWindowPct', 'number', null, null, null, { min: 0, nullable: true, unit: '%' });
key('qc.ccvMin', 'number', 90, undefined, undefined, { min: 0, unit: '%' });
key('qc.ccvMax', 'number', 110, undefined, undefined, { min: 0, unit: '%' });
key('qc.curveMinPoints', 'integer', 5, undefined, undefined, { min: 1 });
key('qc.curveMinR', 'number', 0.995, undefined, undefined, { min: 0, max: 1 });
key('qc.repeatabilityLimit', 'number', null, null, null, { min: 0, nullable: true, unit: 'method unit' });
key('qc.blankCorrection', 'enum', 'NONE', undefined, undefined, { allowedValues: ['NONE', 'SUBTRACT_MEAN_BLANK'], unsupportedValues: ['SUBTRACT_MEAN_BLANK'] });
key('qc.failAction', 'qcFailAction', { BLANK: 'FAIL_BATCH', DUPLICATE: 'FAIL_BATCH', LRM: 'FAIL_BATCH', CRM: 'FAIL_BATCH' });
key('results.reportedValueRule', 'enum', 'MEAN_IF_WITHIN_R', 'MEAN_IF_WITHIN_R', 'LATEST_VALID', { allowedValues: ['MEAN_IF_WITHIN_R', 'LATEST_VALID'] });
key('results.betweenLodLoq', 'enum', 'REPORT_LT_LOQ', 'REPORT_LT_LOQ', 'REPORT_VALUE_FLAGGED', { allowedValues: ['REPORT_LT_LOQ', 'REPORT_VALUE_FLAGGED'] });
key('results.phMin', 'number', 2, 2, 2, { min: 0, unit: 'pH' });
key('results.phMax', 'number', 14, 14, 14, { min: 0, unit: 'pH' });
key('repeats.maxAttemptsBeforeNcr', 'integer', 3, 5, 0, integer);
key('repeats.technicianSelfRepeatBeforeSubmit', 'boolean', true);
key('review.secondPersonRequired', 'boolean', true, true, false);
key('gate.verificationRequired', 'boolean', false, false, false, { scope: 'LAB', analysisOverrides: ['DRYING', 'PREPARATION'] });
key('report.amendmentRequiresSecondPerson', 'boolean', true, true, false);
key('report.numberFormat', 'reportFormat', 'RPT-{LAB}-{YYYY}-{SEQ:5}', undefined, undefined, { scope: 'LAB' });
key('sample.codeFormat', 'sampleFormat', '{LAB}-{YY}-{SEQ:6}{CHK}', undefined, undefined, { scope: 'LAB' });
key('sample.sequenceReset', 'enum', 'YEARLY', 'YEARLY', 'YEARLY', { scope: 'LAB', allowedValues: ['YEARLY', 'NEVER'] });
key('consignment.numberFormat', 'consignmentFormat', 'CSG-{LAB}-{YYYY}-{SEQ:5}', undefined, undefined, { scope: 'LAB' });
key('consignment.sequenceReset', 'enum', 'YEARLY', 'YEARLY', 'YEARLY', { scope: 'LAB', allowedValues: ['YEARLY', 'NEVER'] });
key('sample.retentionDaysAfterReport', 'integer', 90, 60, 30, { ...integer, scope: 'LAB', unit: 'days' });
key('bench.idleLockMinutes', 'integer', 5, 15, 0, { ...integer, scope: 'LAB', unit: 'minutes' });
key('bench.pinAtRecord', 'boolean', true, false, false, { scope: 'LAB' });
key('numbers.decimalSeparator', 'enum', '.', '.', '.', { scope: 'LAB', allowedValues: ['.', ','] });
key('numbers.thousandsSeparator', 'enum', null, null, null, { scope: 'LAB', nullable: true, allowedValues: [',', '.', ' ', "'"] });
key('intake.defaultAnalysisMassG', 'number', 10, 10, 10, { min: 0, unit: 'g' });
key('intake.retentionMassG', 'number', 100, 100, 100, { scope: 'LAB', min: 0, unit: 'g' });
key('referenceMaterials.expiryWarningDays', 'integer', 30, 30, 30, { ...integer, scope: 'LAB', unit: 'days' });
key('equipment.requireEquipment', 'enum', 'AUTO', 'AUTO', 'AUTO', { allowedValues: ['AUTO', 'REQUIRED', 'NOT_REQUIRED'] });
key('equipment.unconfiguredReadiness', 'equipmentReadinessMap', { CRITICAL: 'BLOCK', IMPORTANT: 'WARN', NON_CRITICAL: 'ALLOW' },
    undefined, undefined, { scope: 'LAB' });
key('pt.zScoreLimits', 'ptZScoreLimits', { questionable: 2, unsatisfactory: 3 }, undefined, undefined,
    { scope: 'LAB', analysisOverridesAll: true });

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function definition(name) {
    if (!Object.prototype.hasOwnProperty.call(registry, name)) throw Object.assign(new Error('Unknown policy key.'), { statusCode: 400, code: 'POLICY_KEY_INVALID' });
    return registry[name];
}
function strict(name) { return clone(definition(name).presets.ISO17025_STRICT); }
function valid(name, value) {
    const d = definition(name);
    if (value === null) return d.nullable === true;
    switch (d.type) {
    case 'enum': return d.allowedValues.includes(value) && !d.unsupportedValues?.includes(value);
    case 'boolean': return typeof value === 'boolean';
    case 'integer': return Number.isSafeInteger(value) && value >= (d.min ?? 0);
    case 'number': return typeof value === 'number' && Number.isFinite(value) && value >= (d.min ?? 0) && (d.max === undefined || value <= d.max);
    case 'qcFailAction': return !!value && typeof value === 'object' && !Array.isArray(value) &&
        Object.keys(value).length === 4 && ['BLANK', 'DUPLICATE', 'LRM', 'CRM'].every(type => ['FAIL_BATCH', 'WARN'].includes(value[type]));
    case 'calibrationFailAction': return !!value && typeof value === 'object' && !Array.isArray(value) &&
        Object.keys(value).length === Object.keys(d.allowedActions).length &&
        Object.entries(d.allowedActions).every(([kind, actions]) => actions.includes(value[kind]));
    case 'equipmentReadinessMap': return !!value && typeof value === 'object' && !Array.isArray(value) &&
        Object.keys(value).length === 3 && ['CRITICAL', 'IMPORTANT', 'NON_CRITICAL'].every(type => ['BLOCK', 'WARN', 'ALLOW'].includes(value[type]));
    case 'ptZScoreLimits': return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 &&
        Number.isFinite(value.questionable) && Number.isFinite(value.unsatisfactory) &&
        value.questionable > 0 && value.questionable < value.unsatisfactory;
    case 'westgard': {
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['reject', 'warn'].includes(k))) return false;
        if (!['reject', 'warn'].every(k => Array.isArray(value[k]) && value[k].every(v => d.allowedValues.includes(v)))) return false;
        const all = [...value.reject, ...value.warn];
        return new Set(all).size === all.length;
    }
    case 'runProfiles':
        return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0 && Object.entries(value).every(([code, p]) =>
            /^[A-Za-z0-9_-]+$/.test(code) && p && typeof p.name === 'string' && p.name.trim() && Number.isSafeInteger(p.capacity) && p.capacity >= 1 &&
            Array.isArray(p.qcSlots) && p.qcSlots.length > 0 && new Set(p.qcSlots.map(s => s?.position)).size === p.qcSlots.length && p.qcSlots.every(s =>
                s && typeof s === 'object' && !Array.isArray(s) && Number.isSafeInteger(s.position) && s.position >= 1 && s.position <= p.capacity && ['BLANK', 'DUPLICATE', 'CONTROL'].includes(s.type) && typeof s.label === 'string'));
    case 'reportFormat': case 'sampleFormat': case 'consignmentFormat': {
        if (typeof value !== 'string' || !value.trim() || value.length > 200 || !/\{SEQ(?::\d+)?\}/.test(value)) return false;
        const tokens = d.type === 'reportFormat' ? ['LAB', 'YYYY'] : d.type === 'consignmentFormat' ? ['LAB', 'YY', 'YYYY', 'PROJECT'] : ['LAB', 'YY', 'YYYY', 'CHK', 'PROJECT'];
        const rest = value.replace(/\{SEQ(?::(\d+))?\}/g, (token, width) => !width || Number(width) <= 32 ? '' : token)
            .replace(/\{([^{}]+)\}/g, (token, name) => tokens.includes(name) ? '' : token);
        return !/[{}]/.test(rest);
    }
    default: return false;
    }
}
module.exports = { registry, PRESETS, DEFAULT_RUN_PROFILES, clone, definition, strict, valid };
