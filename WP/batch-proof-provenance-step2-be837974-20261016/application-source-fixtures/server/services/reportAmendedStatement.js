const { definition, valid } = require('../config/policyRegistry');

// Publication freezes the rendered string in report content. Rendering has no
// database access and never resolves a later laboratory policy or live result.
function renderReportAmendedStatement({ policyValue, locale, replacedNumber, replacedRevision, reason }) {
    const key = 'report.amendedStatement', rule = definition(key);
    if (!valid(key, policyValue)) throw Object.assign(new Error('The laboratory amendment statement is invalid.'),
        { statusCode: 400, code: 'POLICY_VALUE_INVALID' });
    if (typeof replacedNumber !== 'string' || !replacedNumber.trim() ||
        typeof reason !== 'string' || !reason.trim() || replacedRevision === undefined)
        throw Object.assign(new Error('Retained predecessor and amendment evidence are required.'),
            { statusCode: 409, code: 'REPORT_AMENDMENT_EVIDENCE_REQUIRED' });
    const chosen = rule.allowedLocales.includes(locale) ? locale : 'en';
    const template = (policyValue === null ? rule.localizedDefaults : policyValue)[chosen];
    const replacements = { replacedNumber, replacedRevision, reason };
    return template.replace(/\{(replacedNumber|replacedRevision|reason)\}/g, (_token, name) => String(replacements[name]));
}

module.exports = { renderReportAmendedStatement };
