const policyService = require('./policyService');
const { valid } = require('../config/policyRegistry');
const { publicationYear } = require('./reportNumberService');

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function conflict(code, message) { return Object.assign(new Error(message), { statusCode: 409, code }); }
function checksumPayload(code) {
    // Separators are presentation only. Reject unsupported characters rather
    // than silently dropping part of an identity from the checksum.
    const payload = String(code).toUpperCase().replace(/[-_ .]/g, '');
    if (!payload || /[^0-9A-Z]/.test(payload)) throw conflict('SAMPLE_CODE_CHARACTERS_INVALID', 'Sample codes must use letters, digits or supported separators.');
    return payload;
}
function checkCharacter(code) {
    // ISO 7064 MOD 37,36, alphabet 0-9,A-Z; the completed checksum is 1.
    let state = 18;
    for (const character of checksumPayload(code)) state = ((state || 36) * 2 % 37 + ALPHABET.indexOf(character)) % 36;
    return ALPHABET[(1 - (state || 36) * 2 % 37 + 36) % 36];
}
function verifyCheckCharacter(code) {
    if (typeof code !== 'string' || code.length < 2 || !ALPHABET.includes(code.at(-1))) return false;
    try { return checkCharacter(code.slice(0, -1)) === code.at(-1); } catch { return false; }
}
function formatCode(template, { labCode, year, sequence, projectCode }) {
    if (!valid('sample.codeFormat', template)) throw conflict('SAMPLE_CODE_FORMAT_INVALID', 'The sample code format is invalid.');
    if (template.includes('{PROJECT}') && !projectCode) throw conflict('SAMPLE_CODE_PROJECT_REQUIRED', 'The sample code policy requires a project.');
    const body = template.replaceAll('{LAB}', labCode).replaceAll('{YYYY}', String(year))
        .replaceAll('{YY}', String(year).slice(-2)).replaceAll('{PROJECT}', projectCode || '')
        .replace(/\{SEQ(?::(\d+))?\}/g, (_, width) => String(sequence).padStart(Number(width || 0), '0'));
    // Compute over the entire code with the check token removed, including
    // tokens after it; formats need not put CHK last.
    return body.includes('{CHK}') ? body.replaceAll('{CHK}', checkCharacter(body.replaceAll('{CHK}', ''))) : body;
}
async function codePolicy(labReference, projectCode, db) {
    const lab = await policyService.resolveLab(labReference, db);
    if (!lab?.isActive) throw conflict('SAMPLE_CODE_LAB_REQUIRED', 'An active registered laboratory is required for sample numbering.');
    const snapshot = await policyService.snapshot(lab.id, { db });
    const format = await policyService.get(lab.id, 'sample.codeFormat', { db, snapshot });
    const reset = await policyService.get(lab.id, 'sample.sequenceReset', { db, snapshot });
    // Validate before a counter write, and preflight before desk draft creation.
    formatCode(format, { labCode: lab.code, year: 2000, sequence: 1, projectCode });
    return { lab, format, reset };
}
async function allocateSampleCode(tx, { labReference, projectCode, issuedAt = new Date() }) {
    if (!tx || typeof tx.$transaction === 'function') throw conflict('SAMPLE_CODE_TRANSACTION_REQUIRED', 'Sample numbers must be allocated inside the intake transaction.');
    const { lab, format, reset } = await codePolicy(labReference, projectCode, tx);
    const year = publicationYear(issuedAt, lab.timezone), sequenceYear = reset === 'NEVER' ? 0 : year;
    await tx.$executeRaw`INSERT INTO "LabSequence" ("labId", "scope", "year", "next") VALUES (${lab.id}, 'SAMPLE', ${sequenceYear}, 1) ON CONFLICT ("labId", "scope", "year") DO NOTHING`;
    for (;;) {
        const [counter] = await tx.$queryRaw`UPDATE "LabSequence" SET "next" = "next" + 1 WHERE "labId" = ${lab.id} AND "scope" = 'SAMPLE' AND "year" = ${sequenceYear} RETURNING "next"`;
        const sequence = Number(counter.next) - 1;
        if (!Number.isSafeInteger(sequence) || sequence < 1) throw conflict('SAMPLE_CODE_SEQUENCE_EXHAUSTED', 'The sample code sequence is exhausted.');
        const code = formatCode(format, { labCode: lab.code, year, sequence, projectCode });
        // Reserve historical aliases too. No max scan, timestamp fallback or
        // collision repair; any failed intake rolls its counter writes back.
        if (!await tx.sample.findFirst({ where: { OR: [{ labSampleCode: code }, { labId: code }, { originalId: code }, { id: code }] }, select: { id: true } })) return code;
    }
}
async function issuedCode(sample, db) {
    if (sample.labSampleCode) return sample.labSampleCode;
    if (!sample.labId?.trim()) return null;
    const labs = await db.lab.findMany({ select: { id: true, code: true } });
    const references = labs.flatMap(lab => [lab.id, lab.code]);
    if (references.includes(sample.labId)) return null;
    if (references.some(reference => reference.trim().toUpperCase() === sample.labId.trim().toUpperCase())) {
        throw conflict('AMBIGUOUS_LAB_OR_CODE', 'The historical laboratory/sample code needs review.');
    }
    return sample.labId;
}
module.exports = { checkCharacter, verifyCheckCharacter, formatCode, codePolicy, allocateSampleCode, issuedCode };
