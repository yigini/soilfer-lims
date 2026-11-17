const parameterNames = require('../data/analysisDisplayNames.json');
const appVersion = require('../package.json').version;
const { iso } = require('./reportContentEvidence');
const locales = ['en', 'es', 'es-419', 'fr', 'pt'];
const scalar = value => value && typeof value === 'object' ? scalar(value.label ?? value.name ?? value.value) : value == null ? '' : String(value);

// Called only while creating a NEW immutable report. Rendering never calls
// this function, consults current profiles, or upgrades a historical snapshot.
function freezeCertificatePresentation(content, { approvalPassEvidence = [] } = {}) {
    const locale = locales.includes(content.meta?.locale) ? content.meta.locale : 'en';
    const dictionary = require(`../locales/${locale}.json`), labels = dictionary.resultReports;
    const groups = content.resultGroups || [], items = groups.flatMap(group => group.items || []);
    const names = new Map(items.map(item => [item.param,
        item.name && item.name !== item.param ? item.name : parameterNames[item.param] || labels.unnamedParameter]));
    const methods = [], missing = [];
    for (const item of items) {
        const rows = item.executedMethods?.length ? item.executedMethods : [{ method: item.method, methodVersion: item.methodVersion, standard: item.standard }];
        const known = row => typeof row.method === 'string' && row.method.trim() && row.methodVersion != null;
        if (rows.some(row => !known(row))) missing.push({ param: item.param, name: names.get(item.param) });
        item.certificateMethodText = [...new Set(rows.map(row => known(row) ? row.method : labels.methodNotRecorded))].join('; ');
        for (const row of rows) methods.push({ ...row, param: item.param, paramName: names.get(item.param),
            method: known(row) ? row.method : labels.methodNotRecorded });
    }
    const uniqueMissing = [...new Map(missing.map(row => [row.param, row])).values()];
    const sentence = (key, codes) => labels[key].replace('{{parameters}}', [...new Set(codes.map(code => names.get(code) || parameterNames[code] || labels.unnamedParameter))].join(', '));
    const qc = content.evidence?.qc, sentences = [];
    if (qc?.withinLimits) sentences.push(labels.qcWithinLimits);
    else if (qc?.deviations?.length) {
        const buckets = new Map();
        for (const row of qc.deviations) {
            const key = row.qcStatus === 'NO_BATCH' ? 'qcNoBatchFor'
                : row.qcStatus === 'NOT_REQUIRED' ? 'qcNotRequiredFor'
                    : ['EVIDENCE_INCOMPLETE', 'NOT_RECORDED'].includes(row.qcStatus) ? 'qcIncompleteFor'
                        : ['FAIL', 'QC_FAIL', 'REJECT', 'REPEAT', 'REPEAT_ORDERED'].includes(row.qcStatus) ? 'qcFailedFor'
                            : ['WARN', 'QC_WARN', 'PROCEED_WITH_WARNING'].includes(row.qcStatus) ? 'qcWarningsFor' : 'qcExceptionFor';
            buckets.set(key, [...(buckets.get(key) || []), row.analysisCode]);
        }
        for (const [key, codes] of buckets) sentences.push(sentence(key, codes));
    } else sentences.push(labels.qcNotRecorded);
    if (qc?.reviewedCorrections?.length) sentences.push(sentence('qcCorrectionFor', qc.reviewedCorrections.map(row => row.analysisCode)));
    if (qc?.calibrationBracketRepeats?.length) sentences.push(sentence('qcOutsideRepeatFor', qc.calibrationBracketRepeats.map(row => row.analysisCode)));
    const signed = content.signedBy || {}, issuer = content.publication?.issuer || {};
    const recordedName = person => {
        const name = scalar(person.name).trim();
        return name && name !== scalar(person.username).trim() ? name : null;
    };
    const fullName = person => recordedName(person) || labels.nameNotRecorded;
    const approvalPasses = (content.sample?.episodes || []).map(episode => {
        const date = iso(episode.approvedAt);
        const retained = approvalPassEvidence.find(row => row.episodeNumber === episode.episodeNumber &&
            row.username === episode.approvedBy && iso(row.date) === date);
        const matchingSignature = episode.approvedBy === signed.username && date && date === iso(signed.date);
        const name = fullName(retained || (matchingSignature ? signed : {}));
        return { episodeNumber: episode.episodeNumber, label: scalar(episode.label), name, date,
            text: date ? labels.approvalPassRecorded.replace('{{name}}', name).replace('{{date}}', date.slice(0, 10)) : labels.approvalPassPending };
    });
    const nameWarnings = [
        ...(!recordedName(signed) ? [{ code: 'REPORT_SIGNATORY_NAME_NOT_RECORDED', severity: 'WARNING', signature: 'approver', message: labels.signatoryNameMissingWarning }] : []),
        ...(!recordedName(issuer) ? [{ code: 'REPORT_ISSUER_NAME_NOT_RECORDED', severity: 'WARNING', signature: 'issuer', message: labels.issuerNameMissingWarning }] : [])
    ];
    const location = { ...(content.locationData || {}) };
    const fm = content.fieldMetadata || {}, rd = content.receptionData || {};
    const entered = {
        country: [fm.country, rd.country], district: [fm.district, rd.district], village: [fm.village, rd.village],
        region: [fm.region, fm.province, rd.region, rd.province],
        locationDescription: [fm.locationDescription, fm.location_description, rd.locationDescription]
    };
    for (const [key, candidates] of Object.entries(entered)) {
        const label = candidates.map(scalar).find(text => text !== '');
        if (label != null) location[key] = label;
    }
    content.presentation = {
        version: 1, locale, appVersion, methodNotRecorded: labels.methodNotRecorded,
        measurementsHeading: 'Analytical Measurements', resultFlagsLabel: labels.certificateResultFlags,
        approvalPassesTitle: labels.approvalPassesTitle, approvalPasses,
        methods: [...new Map(methods.map(row => [JSON.stringify(row), row])).values()],
        warnings: [...(uniqueMissing.length ? [{ code: 'REPORT_METHOD_NOT_RECORDED', severity: 'WARNING', parameters: uniqueMissing,
            message: sentence('methodsMissingWarning', uniqueMissing.map(row => row.param)) }] : []), ...nameWarnings],
        qcStatement: sentences.join(' '), basisStatement: content.basisStatement || labels.certificateDefaultBasis,
        approvalName: fullName(signed), approvalRole: dictionary.roles[signed.title] || labels.notRecorded,
        issuerName: fullName(issuer), issuerRole: dictionary.roles[issuer.role] || labels.notRecorded,
        location, locationLabel: labels.certificateLocation,
        locationText: [location.district, location.village, location.region, location.country].filter(Boolean).map(scalar).join(', ') || labels.notRecorded,
        groupNames: groups.map(group => group.items?.length && group.items.every(item => ['SAND', 'SILT', 'CLAY'].includes(item.param))
            ? labels.certificateParticleSize : group.categoryName)
    };
    return content.presentation;
}
module.exports = { freezeCertificatePresentation };
