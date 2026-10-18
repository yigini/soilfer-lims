const PDFDocument = require('pdfkit');
const JsBarcode = require('jsbarcode');
const { hasPermission } = require('../config/roles');
const { readQcRun } = require('./qcRunViewService');
const policyService = require('./policyService');
const { activeTemplate } = require('./calibrationCurveService');
const { issuedCode } = require('./sampleCodeService');
const scopeGuard = require('../utils/scopeGuard');

const fail = (statusCode, code) => Object.assign(new Error(code), { statusCode, code });
const parse = text => {
    try { return typeof text === 'string' ? JSON.parse(text) : text || {}; }
    catch { throw fail(409, 'WORKSHEET_CONTEXT_INVALID'); }
};
function labelsFor(locale) {
    const selected = ['en', 'es', 'es-419', 'fr', 'pt'].includes(locale) ? locale : 'en';
    return require(`../locales/${selected}.json`).workbenchWorksheet;
}
function code128(code) {
    if (!code || !/^[\x20-\x7e]+$/.test(code) || code.length > 128) return null;
    try {
        const result = {};
        JsBarcode(result, code, { format: 'CODE128', width: 1, height: 32, displayValue: false, margin: 10 });
        const bits = result.encodings.map(row => row.data).join('');
        // Same 0.19 mm minimum module and quiet zones as the issued-label UI.
        return (bits.length + 20) * (0.19 * 72 / 25.4) <= 178 ? { bits, modules: bits.length + 20 } : null;
    } catch { return null; }
}
async function displayCode(sample, db) {
    try { return await issuedCode(sample, db); }
    catch (error) { if (error.statusCode === 409) return null; throw error; }
}

// #203 pin6245399746: a blank working sheet is a read projection. Do not call
// any builder, importer, label-print command, calculation writer or audit path.
async function worksheetModel(db, batchId, actor, analysisCode, { now = new Date() } = {}) {
    if (!hasPermission(actor, 'ENTER_RESULTS')) throw fail(403, 'WORKSHEET_PERMISSION_DENIED');
    const batch = await readQcRun(db, batchId, actor);
    const analytes = batch.analytes || [];
    if (analysisCode == null && analytes.length !== 1) throw fail(422, 'WORKSHEET_ANALYTE_REQUIRED');
    if (analysisCode != null && (typeof analysisCode !== 'string' || !analysisCode.trim())) throw fail(422, 'WORKSHEET_ANALYTE_NOT_IN_RUN');
    const analyte = analytes.find(row => row.analysisCode === (analysisCode ?? analytes[0]?.analysisCode));
    if (!analyte) throw fail(422, 'WORKSHEET_ANALYTE_NOT_IN_RUN');
    const lab = await policyService.resolveLab(batch.labId, db);
    if (!lab) throw fail(409, 'WORKSHEET_CONTEXT_INVALID');
    const criteria = parse(analyte.criteriaSnapshot);
    // Started run method identity is frozen; never relabel it with a live edit.
    const method = batch.startedAt ? criteria.methodRevision || null
        : analyte.methodologyId ? await db.methodology.findUnique({ where: { id: analyte.methodologyId } }) : null;
    const template = await activeTemplate(db, { lab, analyte });
    const analysis = await db.analysis.findUnique({ where: { code: analyte.analysisCode } });
    const columns = template ? template.template.inputs.map(input => ({ key: input.key, label: input.label, unit: input.unit }))
        : [{ key: 'observation', label: null, unit: criteria.analysisUnit ?? (!batch.startedAt ? analysis?.units : null) ?? null }];
    const rows = [];
    for (const position of [...(analyte.positions || [])].sort((a, b) => a.position - b.position)) {
        if (position.kind === 'SAMPLE') {
            const sample = position.sampleId && await db.sample.findUnique({ where: { id: position.sampleId } });
            if (!sample) throw fail(409, 'WORKSHEET_MEMBERSHIP_INVALID');
            const assigned = await policyService.resolveLab(sample.assignedLab || sample.labId, db);
            if (assigned?.id !== lab.id) throw fail(409, 'WORKSHEET_MEMBERSHIP_INVALID');
            const actorLab = await policyService.resolveLab(actor.labId, db);
            scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { ...sample,
                assignedLab: assigned.id }, { labField: 'assignedLab', altLabField: null });
            const code = await displayCode(sample, db);
            rows.push({ position: position.position, kind: 'SAMPLE', code, barcode: code128(code), lot: null });
        } else {
            const reference = (position.references || []).find(row => row.analysisCode === analyte.analysisCode &&
                !row.supersededById && row.serviceStatus !== 'NOT_SERVED');
            let lot = null;
            if (reference) {
                const snapshot = parse(reference.referenceSnapshot);
                lot = snapshot.lotNumber || snapshot.lotCode || null;
                if (!lot) {
                    const material = await db.referenceMaterial.findUnique({ where: { id: reference.referenceMaterialId },
                        select: { labId: true, lotNumber: true } });
                    if (material) {
                        if ((await policyService.resolveLab(material.labId, db))?.id !== lab.id) throw fail(409, 'WORKSHEET_MEMBERSHIP_INVALID');
                        lot = material.lotNumber;
                    }
                }
            }
            // A QC position is not a sample-label identity and cannot be scanned
            // by the sample-only worksheet scanner. Never print its UUID.
            const parent = position.duplicateOfPositionId && (analyte.positions || []).find(row => row.id === position.duplicateOfPositionId);
            rows.push({ position: position.position, kind: position.kind, lot, parentPosition: parent?.position ?? null, code: null, barcode: null });
        }
    }
    if (!rows.length) throw fail(409, 'WORKSHEET_POSITIONS_REQUIRED');
    return { runId: batch.id, lab: lab.name || lab.code, analysisCode: analyte.analysisCode,
        analysisName: analysis?.name || analyte.analysisCode, method,
        instrument: batch.instrument || null, analyst: batch.analystUsername || null,
        startedAt: batch.startedAt || null, generatedAt: now.toISOString(),
        template: template ? { name: template.template.name || template.template.templateKey, version: template.templateVersion } : null,
        columns, rows };
}

function renderWorksheet(model, locale = 'en') {
    const text = labelsFor(locale);
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margins: { top: 18, left: 18, right: 18, bottom: 18 },
            bufferPages: true, info: { Title: `${text.title} - ${model.runId}`, Author: model.lab } });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        try {
            const left = 18, width = doc.page.width - 36, positionWidth = 28, identityWidth = 186;
            const rawWidth = (width - positionWidth - identityWidth) / model.columns.length;
            const footerTop = doc.page.height - 61;
            let y, pageNumber = 0;
            const line = value => {
                doc.font('Helvetica').fontSize(8.5).fillColor('#172b35');
                const height = doc.heightOfString(value, { width });
                doc.text(value, left, y, { width }); y += height + 2;
            };
            const header = () => {
                pageNumber++;
                y = 18;
                doc.font('Helvetica-Bold').fontSize(15).fillColor('#172b35').text(text.title, left, y, { width }); y += 21;
                line(`${text.run}: ${model.runId} | ${text.lab}: ${model.lab}`);
                line(`${text.analyte}: ${model.analysisCode} - ${model.analysisName} | ${text.method}: ${model.method ? `${model.method.name} / ${model.method.standard || ''} / v${model.method.version ?? text.unknown}` : text.unknown}`);
                line(`${text.instrument}: ${model.instrument || text.unknown} | ${text.analyst}: ${model.analyst || text.unknown} | ${text.started}: ${model.startedAt ? new Date(model.startedAt).toISOString() : text.notStarted}`);
                line(`${text.templateAtPrint}: ${model.template ? `${model.template.name} v${model.template.version}` : text.noTemplate}`);
                doc.font('Helvetica').fontSize(7).fillColor('#374151');
                const noticeHeight = doc.heightOfString(text.blankNotice, { width });
                doc.text(text.blankNotice, left, y, { width }); y += noticeHeight + 5;
                const headings = [text.position, text.identity, ...model.columns.map(column => `${column.label || text.rawObservation}${column.unit ? ` (${column.unit})` : ''}`)];
                const widths = [positionWidth, identityWidth, ...model.columns.map(() => rawWidth)];
                doc.font('Helvetica-Bold').fontSize(7);
                const headingHeight = Math.max(24, ...headings.map((value, index) => doc.heightOfString(value, { width: widths[index] - 6 }) + 6));
                if (y + headingHeight + 24 > footerTop) throw fail(422, 'WORKSHEET_LAYOUT_TOO_LARGE');
                doc.rect(left, y, width, headingHeight).fill('#e5ece9');
                let x = left;
                headings.forEach((value, index) => { doc.fillColor('#172b35').text(value, x + 3, y + 3, { width: widths[index] - 6 }); x += widths[index]; });
                y += headingHeight;
            };
            const footer = () => {
                const top = doc.page.height - 43;
                doc.strokeColor('#374151').lineWidth(0.6).moveTo(left, top).lineTo(left + 210, top).moveTo(left + 290, top).lineTo(left + width, top).stroke();
                doc.font('Helvetica').fontSize(8).fillColor('#172b35').text(text.analystSignature, left, top + 3, { width: 210 });
                doc.text(text.reviewerSignature, left + 290, top + 3, { width: width - 290 });
                doc.fontSize(6.5).text(`${model.generatedAt} | ${text.page} ${pageNumber}`, left, top + 17, { width });
            };
            header();
            for (const row of model.rows) {
                const qcLabel = `${text.kinds[row.kind] || row.kind}${row.parentPosition ? ` | ${text.duplicateOf} ${row.parentPosition}` : ''}${row.lot ? ` | ${text.lot}: ${row.lot}` : ''}`;
                doc.font('Helvetica-Bold').fontSize(11);
                const height = row.kind === 'SAMPLE' ? 24 : Math.max(24, doc.heightOfString(qcLabel, { width: identityWidth - 8 }) + 6);
                if (y + height > footerTop) { footer(); doc.addPage(); header(); }
                if (y + height > footerTop) throw fail(422, 'WORKSHEET_LAYOUT_TOO_LARGE');
                doc.lineWidth(0.4).strokeColor('#8c989e').rect(left, y, width, height).stroke();
                let x = left + positionWidth;
                doc.moveTo(x, y).lineTo(x, y + height).stroke();
                x += identityWidth; doc.moveTo(x, y).lineTo(x, y + height).stroke();
                for (let index = 1; index < model.columns.length; index++) doc.moveTo(x + index * rawWidth, y).lineTo(x + index * rawWidth, y + height).stroke();
                doc.font('Helvetica-Bold').fontSize(12).fillColor('#172b35').text(String(row.position), left + 3, y + 5, { width: positionWidth - 6 });
                const identityX = left + positionWidth;
                if (row.kind === 'SAMPLE' && row.barcode) {
                    const moduleWidth = 0.19 * 72 / 25.4;
                    const start = identityX + (identityWidth - row.barcode.modules * moduleWidth) / 2 + 10 * moduleWidth;
                    doc.fillColor('#000000');
                    for (let bit = 0; bit < row.barcode.bits.length; bit++) if (row.barcode.bits[bit] === '1') doc.rect(start + bit * moduleWidth, y + 1, moduleWidth, 14.5).fill();
                    doc.font('Helvetica').fontSize(6.5).text(row.code, identityX + 3, y + 16, { width: identityWidth - 6, align: 'center' });
                } else if (row.kind === 'SAMPLE') {
                    doc.font('Helvetica-Bold').fontSize(9).fillColor('#172b35').text(text.codeNeedsReview, identityX + 4, y + 6, { width: identityWidth - 8 });
                } else {
                    doc.font('Helvetica-Bold').fontSize(11).fillColor('#172b35').text(qcLabel, identityX + 4, y + 3, { width: identityWidth - 8 });
                }
                // Raw-data cells deliberately remain empty, including QC rows.
                y += height;
            }
            footer();
            doc.end();
        } catch (error) { doc.destroy(); reject(error); }
    });
}
module.exports = { worksheetModel, renderWorksheet, labelsFor, displayCode };
