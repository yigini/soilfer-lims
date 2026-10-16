const { runAnalyteCode } = require('./analysisCodesService');

// Run order includes QC positions. A CCB checks the bracket ending at its
// immediately preceding verification boundary, even when that CCV passed.
function calibrationBrackets(batch, analysisCode, positions, checks) {
    const ordered = [...positions].sort((a, b) => a.position - b.position);
    const checked = id => checks.find(row => row.positionId === id);
    return checks.filter(row => ['CCV', 'CCB'].includes(row.kind) && ['FAIL', 'INVALID'].includes(row.status)).map(failed => {
        const position = ordered.find(row => row.id === failed.positionId);
        const boundary = failed.kind === 'CCB' ? ordered.filter(row => ['ICV', 'CCV'].includes(row.kind) && row.position < position.position).at(-1) : position;
        if (!boundary) throw Error('A calibration blank has no verification boundary');
        const prior = ordered.filter(row => row.kind === 'CCV' && row.position < boundary.position && checked(row.id)?.status === 'PASS').at(-1) ||
            ordered.find(row => row.kind === 'ICV' && row.position < boundary.position && checked(row.id)?.status === 'PASS');
        const samples = ordered.filter(row => row.kind === 'SAMPLE' && row.position > (prior?.position || 0) && row.position < boundary.position);
        const ids = new Set(samples.map(row => row.id));
        const affected = ordered.filter(row => ids.has(row.id) || row.kind === 'DUPLICATE' && ids.has(row.duplicateOfPositionId));
        const workItemIds = samples.flatMap(row => (row.workItems || []).filter(link => runAnalyteCode(batch, link.analysisCode) === analysisCode).map(link => link.workItemId));
        return { failedPositionId: failed.positionId, kind: failed.kind, openingPositionId: prior?.id || null,
            affectedPositionIds: affected.map(row => row.id), affectedWorkItemIds: [...new Set(workItemIds)], failAction: failed.failAction };
    });
}

function repeatBracketScope(analyte, evidence) {
    const details = typeof evidence.evaluation?.details === 'string' ? JSON.parse(evidence.evaluation.details) : evidence.evaluation?.details;
    const checks = [...(details?.evaluation?.blanks || []), ...(details?.evaluation?.controls || []), ...(details?.evaluation?.duplicates || [])];
    const failing = checks.filter(row => ['FAIL', 'INVALID'].includes(row.status) && row.failAction !== 'WARN');
    if (analyte.provenance !== 'NATIVE' || details?.calibrationFailActionSource !== 'SNAPSHOT' || !failing.length ||
        failing.some(row => !['CCV', 'CCB'].includes(row.kind) || row.failAction !== 'REPEAT_BRACKET') ||
        !Array.isArray(details.calibrationBrackets) || failing.some(row => !details.calibrationBrackets.some(bracket =>
            bracket.failedPositionId === row.positionId && Array.isArray(bracket.affectedPositionIds) &&
            bracket.affectedPositionIds.length > 0 && Array.isArray(bracket.affectedWorkItemIds) && bracket.affectedWorkItemIds.length > 0))) {
        throw Object.assign(new Error('Only failed continuing calibration brackets may be repeated independently.'),
            { statusCode: 409, code: 'QC_BRACKET_REPEAT_NOT_ALLOWED' });
    }
    const brackets = details.calibrationBrackets.filter(row => failing.some(check => check.positionId === row.failedPositionId));
    return { evaluationId: evidence.evaluation.id, failedPositionIds: brackets.map(row => row.failedPositionId),
        affectedPositionIds: [...new Set(brackets.flatMap(row => row.affectedPositionIds))],
        affectedWorkItemIds: [...new Set(brackets.flatMap(row => row.affectedWorkItemIds))], brackets };
}

module.exports = { calibrationBrackets, repeatBracketScope };
