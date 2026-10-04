function conflict(code, message) {
    return Object.assign(new Error(message), { statusCode: 409, code });
}

function publicationYear(publishedAt, timezone) {
    const date = new Date(publishedAt);
    if (!Number.isFinite(date.getTime())) throw conflict('REPORT_DATE_INVALID', 'A publication date is required.');
    try {
        return Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: timezone || 'UTC' }).format(date));
    } catch {
        return date.getUTCFullYear();
    }
}

function formatNumber(template, labCode, year, sequence) {
    if (typeof template !== 'string' || !template.trim() || !/\{SEQ(?::\d+)?\}/.test(template)) {
        throw conflict('REPORT_NUMBER_FORMAT_INVALID', 'The report number policy requires a sequence token.');
    }
    const number = template.replaceAll('{LAB}', labCode).replaceAll('{YYYY}', String(year))
        .replace(/\{SEQ(?::(\d+))?\}/g, (_, width) => {
            const padding = width ? Number(width) : 0;
            if (padding > 32) throw conflict('REPORT_NUMBER_FORMAT_INVALID', 'Report number padding is too long.');
            return String(sequence).padStart(padding, '0');
        });
    if (/[{}]/.test(number)) throw conflict('REPORT_NUMBER_FORMAT_INVALID', 'The report number policy has an unknown token.');
    return number;
}

function storedNumber(report) {
    if (report.reportNumberBase) return report.reportNumberBase;
    let content;
    try { content = typeof report.content === 'string' ? JSON.parse(report.content) : report.content; }
    catch { throw conflict('REPORT_CONTENT_INVALID', 'Historical report content needs review before revision.'); }
    return typeof content?.reportNumber === 'string' && content.reportNumber.trim() ? content.reportNumber : null;
}

async function assertBaseOwner(tx, base, sampleId) {
    const owner = await tx.report.findFirst({ where: { reportNumberBase: base, sampleId: { not: sampleId } }, select: { id: true } });
    if (owner) throw conflict('REPORT_NUMBER_CONFLICT', 'The report number belongs to another sample.');
    // Legacy rows deliberately remain nullable. Their frozen identities also
    // reserve the base and must not be taken over by a newly numbered sample.
    const legacy = await tx.report.findMany({ where: { reportNumberBase: null, sampleId: { not: sampleId },
        status: { in: ['PUBLISHED', 'SUPERSEDED'] }, publishedAt: { not: null } }, select: { content: true, reportNumberBase: true } });
    if (legacy.some(row => storedNumber(row) === base)) throw conflict('REPORT_NUMBER_CONFLICT', 'A historical report number belongs to another sample.');
}

async function allocateReportIdentity(tx, { sampleId, lab, publishedAt, resolveFormat }) {
    if (!lab?.id || !lab.code) throw conflict('REPORT_LAB_REQUIRED', 'A registered laboratory is required for report numbering.');
    const lineage = await tx.report.findMany({ where: { sampleId, status: { in: ['PUBLISHED', 'SUPERSEDED'] }, publishedAt: { not: null } }, orderBy: { version: 'desc' } });
    const previous = lineage[0] || null;
    const base = previous ? storedNumber(previous) : null;
    if (base) {
        await assertBaseOwner(tx, base, sampleId);
        const revisions = lineage.filter(row => storedNumber(row) === base).map(row => row.revision ?? 0);
        return { reportNumberBase: base, revision: Math.max(...revisions) + 1, replacesReportId: previous.id,
            replacesReportNumber: previous.reportNumberBase ? displayNumber(previous.reportNumberBase, previous.revision) : storedNumber(previous) };
    }
    const year = publicationYear(publishedAt, lab.timezone);
    // The increment is the publication transaction's first write. A failed
    // publication rolls it back: only committed reports have issued numbers.
    const counter = await tx.reportSequence.upsert({ where: { labId_year: { labId: lab.id, year } },
        create: { labId: lab.id, year, lastValue: 1 }, update: { lastValue: { increment: 1 } } });
    const reportNumberBase = formatNumber(await resolveFormat(), lab.code, year, counter.lastValue);
    await assertBaseOwner(tx, reportNumberBase, sampleId);
    return { reportNumberBase, revision: previous ? (previous.revision ?? 0) + 1 : 0, replacesReportId: previous?.id || null,
        replacesReportNumber: previous ? storedNumber(previous) : null };
}

function displayNumber(base, revision) {
    return revision > 0 ? `${base} rev ${revision}` : base;
}

module.exports = { publicationYear, formatNumber, storedNumber, allocateReportIdentity, displayNumber };
