export function operationalEvidence(item) {
    if (!['DRYING', 'PREPARATION'].includes(item?.analysis)) return null;
    try {
        const evidence = typeof item.result === 'string' ? JSON.parse(item.result) : item.result;
        if (evidence?.revision && Array.isArray(evidence.steps) && Array.isArray(evidence.checks) && evidence.steps.length === evidence.checks.length) return evidence;
    } catch { /* Older operational records may contain only a completion marker. */ }
    return null;
}

export function workItemEvidenceText(item) {
    if (['DRYING', 'PREPARATION'].includes(item?.analysis)) {
        const evidence = operationalEvidence(item);
        if (evidence) return `${evidence.checks.filter(c => c === true).length}/${evidence.steps.length} checks confirmed`;
        return item?.result ? 'Legacy operational record' : 'Not recorded';
    }
    const result = item?.result;
    return result === null || result === undefined || result === '' ? 'Not recorded' : typeof result === 'object' ? String(result.value ?? '') : String(result);
}
