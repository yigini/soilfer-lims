// #185 scope pins 6015099533 / 6015163452. Values are resolved through policyService.
const FIELD_POLICIES = Object.freeze({
    maxBatchSize: 'qc.maxBatchSize', blankPerBatch: 'qc.blankPerBatch', blankLimitMode: 'qc.blankLimitMode', blankAbsLimit: 'qc.blankMaxAllowed',
    duplicateEvery: 'qc.duplicateEvery', duplicateRpdMax: 'qc.duplicateMaxRpd', duplicateMode: 'qc.duplicateMode',
    duplicateAbsMax: 'qc.duplicateAbsMax', duplicateAbsMaxBelow5LOQ: 'qc.duplicateAbsMaxBelow5LOQ',
    lrmPerBatch: 'qc.lrmPerBatch', lrmMode: 'qc.lrmLimitMode', lrmWindowPct: 'qc.lrmWindowPct',
    crmEveryNBatches: 'qc.crmEveryNBatches', crmMode: 'qc.crmMode', crmRecoveryMin: 'qc.controlMinRecovery',
    crmRecoveryMax: 'qc.controlMaxRecovery', crmAbsWindow: 'qc.crmAbsWindow', ccvEvery: 'qc.ccvEvery',
    ccvMin: 'qc.ccvMin', ccvMax: 'qc.ccvMax', curveMinPoints: 'qc.curveMinPoints', curveMinR: 'qc.curveMinR',
    repeatabilityLimit: 'qc.repeatabilityLimit', blankCorrection: 'qc.blankCorrection', failAction: 'qc.failAction'
});
const SHIPPED_ANALYSIS_DEFAULTS = Object.freeze(Object.fromEntries([
    ...['PH_H2O', 'GLOSOLAN_PH_H2O', 'PH_CACL2', 'GLOSOLAN_PH_CACL2', 'PH_KCL'].map(code => [code,
        { duplicateMode: 'ABS_DIFF', duplicateAbsMax: 0.2, blankPerBatch: 0, crmMode: 'ABS_WINDOW', crmAbsWindow: null }]),
    ...['SAND', 'SILT', 'CLAY', 'TEXTURE'].map(code => [code, { duplicateMode: 'ABS_DIFF', duplicateAbsMax: 3, crmEveryNBatches: 0 }]),
    ...['EXT_ZN', 'EXT_FE', 'EXT_CU', 'EXT_MN', 'EXT_B', 'EXT_MO', 'DTPA_EXT_CO'].map(code => [code, { duplicateRpdMax: 20 }])
]));
const DEFERRED_FIELDS = Object.freeze(['maxBatchSize', 'crmEveryNBatches', 'ccvEvery', 'ccvMin', 'ccvMax', 'curveMinPoints', 'curveMinR', 'repeatabilityLimit']);
module.exports = { FIELD_POLICIES, SHIPPED_ANALYSIS_DEFAULTS, DEFERRED_FIELDS };
