const policyService = require('./policyService');
const { valid } = require('../config/policyRegistry');
const { publicationYear } = require('./reportNumberService');

function conflict(code, message) { return Object.assign(new Error(message), { statusCode: 409, code }); }
function formatNumber(template, { labCode, year, sequence, projectCode }) {
    if (!valid('consignment.numberFormat', template)) throw conflict('CONSIGNMENT_NUMBER_FORMAT_INVALID', 'The consignment number format is invalid.');
    if (template.includes('{PROJECT}') && !projectCode) throw conflict('CONSIGNMENT_PROJECT_REQUIRED', 'The consignment number policy requires a project.');
    return template.replaceAll('{LAB}', labCode).replaceAll('{YYYY}', String(year)).replaceAll('{YY}', String(year).slice(-2))
        .replaceAll('{PROJECT}', projectCode || '').replace(/\{SEQ(?::(\d+))?\}/g, (_, width) => String(sequence).padStart(Number(width || 0), '0'));
}
async function allocateConsignmentNumber(tx, { labReference, projectCode, issuedAt = new Date() }) {
    if (!tx || typeof tx.$transaction === 'function') throw conflict('CONSIGNMENT_TRANSACTION_REQUIRED', 'Consignment numbers must be allocated inside the intake transaction.');
    const lab = await policyService.resolveLab(labReference, tx);
    if (!lab?.isActive) throw conflict('CONSIGNMENT_LAB_REQUIRED', 'An active registered receiving laboratory is required.');
    const snapshot = await policyService.snapshot(lab.id, { db: tx });
    const format = await policyService.get(lab.id, 'consignment.numberFormat', { db: tx, snapshot });
    const reset = await policyService.get(lab.id, 'consignment.sequenceReset', { db: tx, snapshot });
    const year = publicationYear(issuedAt, lab.timezone), sequenceYear = reset === 'NEVER' ? 0 : year;
    formatNumber(format, { labCode: lab.code, year, sequence: 1, projectCode });
    await tx.$executeRaw`INSERT INTO "LabSequence" ("labId", "scope", "year", "next") VALUES (${lab.id}, 'CONSIGNMENT', ${sequenceYear}, 1) ON CONFLICT ("labId", "scope", "year") DO NOTHING`;
    for (;;) {
        const [counter] = await tx.$queryRaw`UPDATE "LabSequence" SET "next" = "next" + 1 WHERE "labId" = ${lab.id} AND "scope" = 'CONSIGNMENT' AND "year" = ${sequenceYear} RETURNING "next"`;
        const sequence = Number(counter.next) - 1;
        if (!Number.isSafeInteger(sequence) || sequence < 1) throw conflict('CONSIGNMENT_SEQUENCE_EXHAUSTED', 'The consignment number sequence is exhausted.');
        const code = formatNumber(format, { labCode: lab.code, year, sequence, projectCode });
        if (!await tx.consignment.findUnique({ where: { code }, select: { id: true } })) return code;
    }
}
module.exports = { formatNumber, allocateConsignmentNumber };
