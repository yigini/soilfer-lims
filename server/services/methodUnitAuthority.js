// #283 (YY: one unit per analysis): the analysis's controlled unit is the only
// reporting-unit authority. A method's QUDT override never relabels a value; one
// that disagrees with the analysis is ignored and disclosed, with no conversion.
function analysisQudtUnit(analysis, method) {
    const qudtUnit = analysis?.qudtUnit || null, override = method?.qudtUnit || null;
    return { qudtUnit, unitDiagnostic: override && override !== qudtUnit ? 'METHOD_UNIT_OVERRIDE_IGNORED' : null };
}
module.exports = { analysisQudtUnit };
