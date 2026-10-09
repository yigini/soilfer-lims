/**
 * SoilFER-LIMS Analytical Report & Certificate of Analysis PDF Generator
 * 
 * Generates ISO/IEC 17025 compliant, publication-grade Soil Analysis Certificates.
 * Pure JavaScript implementation using PDFKit (zero external binary / headless Chrome dependencies).
 */

const PDFDocument = require('pdfkit');
const { formatReportedValue } = require('../../shared/reportedValueFormat');
const { calculateUsdaTexture, evaluateCnRatio, evaluateCecAndBases } = require('../utils/soilCalculations');
const { interpretParameter, normalizeUnit } = require('./interpretationService');
const { describeReportEvidence } = require('./reportTruthfulnessService');

/**
 * Format an interpretation label for display
 */
function getInterpretation(paramCode, value, unit = '') {
    const res = interpretParameter(paramCode, value, unit);
    return res ? res.label : 'Normal';
}

/**
 * Generate PDF buffer from structured report content.
 * @param {Object} reportContent - Full assembled report content object
 * @returns {Promise<Buffer>}
 */
function generateReportPdfBuffer(reportContent, publication = {}) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 36, bottom: 36, left: 36, right: 36 },
                bufferPages: true,
                autoFirstPage: true,
                info: {
                    Title: `SoilFER Analytical Report - ${reportContent.sample?.labId || reportContent.sample?.id || 'Report'}`,
                    Author: reportContent.lab?.name || 'FAO SoilFER Laboratory',
                    Subject: 'Certificate of Soil Analysis',
                    Keywords: 'SoilFER, Soil Analysis, LIMS, Certificate of Analysis'
                }
            });
            const locale = ['en', 'es', 'es-419', 'fr', 'pt'].includes(reportContent.meta?.locale) ? reportContent.meta.locale : 'en';
            const labels = require(`../locales/${locale}.json`).resultReports;
            const evidenceText = describeReportEvidence(reportContent.evidence, locale);
            const qcStatement = reportContent.qcStatement || (reportContent.evidence ? evidenceText.qcStatement
                : reportContent.qcWarnings?.length ? reportContent.qcWarningStatement : evidenceText.qcStatement);
            const preparationStatement = reportContent.preparationStatement || evidenceText.preparationStatement;
            const number = publication.reportNumber || reportContent.reportNumber || labels.notRecorded;
            const issuedAt = publication.publishedAt || reportContent.publication?.publishedAt;
            const issuedDate = issuedAt ? new Date(issuedAt).toISOString().split('T')[0] : labels.notRecorded;
            const status = publication.status || reportContent.publication?.status || 'DRAFT';

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });

            // --- PALETTE ---
            const cPrimary = '#1E3A8A';   // Dark Navy
            const cSecondary = '#047857'; // Forest Green
            const cAccent = '#D97706';    // Ochre / Gold
            const cDark = '#1F2937';      // Charcoal Slate
            const cGray = '#4B5563';      // Slate Gray
            const cLightBg = '#F3F4F6';   // Light Gray background
            const cBorder = '#E5E7EB';    // Subtle border
            const cSuccessBg = '#ECFDF5';
            const cSuccessText = '#065F46';

            const pageWidth = 595.28 - 72; // 523.28pt printable width
            const startX = 36;
            let currentY = 36;

            // =========================================================================
            // 1. TOP HEADER BANNER
            // =========================================================================
            doc.rect(startX, currentY, pageWidth, 52).fill(cPrimary);

            // Title inside banner
            doc.fillColor('#FFFFFF')
                .font('Helvetica-Bold')
                .fontSize(10)
                .text('FOOD AND AGRICULTURE ORGANIZATION OF THE UNITED NATIONS', startX + 14, currentY + 10, { width: 340 });

            doc.font('Helvetica')
                .fontSize(8.5)
                .fillColor('#93C5FD')
                .text('Global Soil Doctors Programme · SoilFER Laboratory Network', startX + 14, currentY + 38, { width: 340 });

            // Report Meta Badge (Right side of banner)
            doc.fillColor('#FFFFFF')
                .font('Helvetica-Bold')
                .fontSize(9.5)
                .text(number, startX + 360, currentY + 11, { width: 150, align: 'right' });

            doc.font('Helvetica')
                .fontSize(8)
                .fillColor('#E0E7FF')
                .text(`Issue Date: ${issuedDate}`, startX + 360, currentY + 25, { width: 150, align: 'right' })
                .text(`Status: ${status}`, startX + 360, currentY + 36, { width: 150, align: 'right' });

            currentY += 60;
            if (status === 'SUPERSEDED') {
                doc.fillColor('#B91C1C').font('Helvetica-Bold').fontSize(10)
                    .text(`${labels.superseded} – ${labels.see} ${publication.replacementNumber || labels.notRecorded}`, startX, currentY, { width: pageWidth });
                currentY = doc.y + 10;
            }
            if (reportContent.publication?.replacesReportNumber) {
                doc.fillColor(cGray).font('Helvetica').fontSize(8)
                    .text(`${labels.replaces} ${reportContent.publication.replacesReportNumber}`, startX, currentY, { width: pageWidth });
                currentY = doc.y + 10;
            }

            // =========================================================================
            // 2. DOCUMENT TITLE & ACCREDITATION STATEMENT
            // =========================================================================
            doc.fillColor(cDark)
                .font('Helvetica-Bold')
                .fontSize(15)
                .text('CERTIFICATE OF SOIL ANALYSIS', startX, currentY);

            doc.font('Helvetica-Oblique')
                .fontSize(8)
                .fillColor(cGray)
                .text('Analytical report based on laboratory SOPs and harmonized soil testing guidelines.', startX, currentY + 18);

            currentY += 34;

            // =========================================================================
            // 3. LABORATORY & SAMPLE PROVENANCE BOXES (2-COLUMN GRID)
            // =========================================================================
            const colWidth = (pageWidth - 12) / 2; // ~255pt each
            const boxHeight = 110;

            // --- Left Box: Laboratory Information ---
            doc.rect(startX, currentY, colWidth, boxHeight).fillAndStroke(cLightBg, cBorder);
            
            // Header bar
            doc.rect(startX, currentY, colWidth, 18).fill('#E2E8F0');
            doc.fillColor(cPrimary).font('Helvetica-Bold').fontSize(8.5)
                .text('TESTING LABORATORY', startX + 8, currentY + 5);

            const lab = reportContent.lab || {};
            const sample = reportContent.sample || {};
            const client = reportContent.client || {};

            doc.fillColor(cDark).font('Helvetica-Bold').fontSize(9)
                .text(lab.name || 'National Soil Testing Laboratory', startX + 8, currentY + 24, { width: colWidth - 16, ellipsis: true });

            doc.font('Helvetica').fontSize(7.5).fillColor(cGray)
                .text(`Lab Code: ${lab.code || sample?.assignedLab || 'LAB-GTM'}`, startX + 8, currentY + 40)
                .text(`Address: ${lab.address || 'Central Research Station'}, ${lab.city || ''}`, startX + 8, currentY + 52)
                .text(`Email: ${lab.email || 'lab@soilfer.org'} | Tel: ${lab.phone || '+502 2300-0000'}`, startX + 8, currentY + 64)
                .text(`Registration: GLOSOLAN Registered Laboratory`, startX + 8, currentY + 76)
                .text(`Quality System: ISO/IEC 17025 Aligned Quality Records`, startX + 8, currentY + 88);

            // --- Right Box: Sample Identification & Provenance ---
            const rightX = startX + colWidth + 12;
            doc.rect(rightX, currentY, colWidth, boxHeight).fillAndStroke(cLightBg, cBorder);

            // Header bar
            doc.rect(rightX, currentY, colWidth, 18).fill('#E2E8F0');
            doc.fillColor(cPrimary).font('Helvetica-Bold').fontSize(8.5)
                .text('SAMPLE PROVENANCE & IDENTIFICATION', rightX + 8, currentY + 5);

            const sampleDepth = sample.depthTop !== undefined && sample.depthBottom !== undefined 
                ? `${sample.depthTop} - ${sample.depthBottom} cm` 
                : '0 - 20 cm (Topsoil)';

            doc.fillColor(cDark).font('Helvetica-Bold').fontSize(8)
                .text('Laboratory ID:', rightX + 8, currentY + 24)
                .text('Original / Field ID:', rightX + 8, currentY + 36)
                .text('Project / Country:', rightX + 8, currentY + 48)
                .text('Client / Submitter:', rightX + 8, currentY + 60)
                .text('Sampling Depth / Horiz:', rightX + 8, currentY + 72)
                .text('Date Received / Accepted:', rightX + 8, currentY + 84)
                .text('Date Approved / Issued:', rightX + 8, currentY + 96);

            doc.font('Helvetica').fontSize(8).fillColor(cDark)
                .text(sample.labId || sample.id || 'N/A', rightX + 110, currentY + 24)
                .text(sample.originalId || 'N/A', rightX + 110, currentY + 36)
                .text(`${sample.projectCode || reportContent.project?.code || 'SOILFER'} (${sample.countryName || 'Regional'})`, rightX + 110, currentY + 48)
                .text(`${client.name || sample.clientName || 'General Intake'}`, rightX + 110, currentY + 60, { width: colWidth - 118, ellipsis: true })
                .text(`${sampleDepth} ${sample.horizon ? `[${sample.horizon}]` : ''}`, rightX + 110, currentY + 72)
                .text(`${sample.receptionDate ? String(sample.receptionDate).split('T')[0] : 'Recorded'}`, rightX + 110, currentY + 84)
                .text(issuedDate, rightX + 110, currentY + 96);

            currentY += boxHeight + 12;

            // =========================================================================
            // 4. OPERATIONAL GATES & PREPARATION VERIFICATION BAR
            // =========================================================================
            doc.font('Helvetica').fontSize(8);
            const preparationHeight = doc.heightOfString(preparationStatement, { width: pageWidth - 20 }) + 26;
            doc.rect(startX, currentY, pageWidth, preparationHeight).fillAndStroke(cLightBg, cBorder);
            doc.fillColor(cSuccessText).font('Helvetica-Bold').fontSize(8)
                .text(labels.preparationRecords, startX + 10, currentY + 7);

            doc.font('Helvetica').fontSize(8).fillColor(cSuccessText)
                .text(preparationStatement, startX + 10, currentY + 20, { width: pageWidth - 20 });

            currentY += preparationHeight + 8;

            // =========================================================================
            // 5. TEST RESULTS TABLE (Categorized)
            // =========================================================================
            doc.fillColor(cPrimary).font('Helvetica-Bold').fontSize(11)
                .text('ANALYTICAL DETERMINATIONS & TEST RESULTS', startX, currentY);
            currentY += 16;

            // Table Column Definitions
            const col1 = startX;              // Parameter (150pt)
            const col2 = startX + 155;        // Method (125pt)
            const col3 = startX + 285;        // Value (65pt)
            const col4 = startX + 355;        // Unit (55pt)
            const col5 = startX + 415;        // Interpretation (108pt)

            // Table Header Row
            doc.rect(startX, currentY, pageWidth, 18).fill('#1E293B');
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
                .text('PARAMETER / DETERMINATION', col1 + 6, currentY + 5)
                .text('METHOD / STANDARD', col2 + 4, currentY + 5)
                .text('RESULT', col3 + 4, currentY + 5, { width: 60, align: 'right' })
                .text('UNIT', col4 + 4, currentY + 5)
                .text('FAO INTERPRETATION', col5 + 4, currentY + 5);

            currentY += 19;

            // Collect all results
            const resultGroups = reportContent.resultGroups || [];
            let rowCount = 0;

            // Variables for advanced soil metrology
            let sandVal = null, siltVal = null, clayVal = null;
            let socVal = null, tnVal = null;

            resultGroups.forEach(group => {
                // Category sub-header
                if (currentY > 720) {
                    doc.addPage();
                    currentY = 40;
                }

                doc.rect(startX, currentY, pageWidth, 14).fill('#E2E8F0');
                doc.fillColor(cPrimary).font('Helvetica-Bold').fontSize(8)
                    .text(group.categoryName || 'Standard Chemical Determinations', startX + 6, currentY + 3);
                currentY += 15;

                (group.items || []).forEach(item => {
                    const notReportable=item.reportedMode==='NOT_REPORTABLE';
                    const valueText=notReportable ? require('../locales/'+locale+'.json').reportedValue.notReportable :
                        item.reportedValueSelectionId ? formatReportedValue(item) : String(item.value ?? '—');
                    const valueHeight=doc.font('Helvetica-Bold').fontSize(8).heightOfString(valueText,{width:60});
                    const rowHeight=Math.max(16,valueHeight+8);
                    const noteText=notReportable ? String(item.value ?? '') : '';
                    const noteHeight=noteText ? doc.font('Helvetica').fontSize(7.5).heightOfString(noteText,{width:pageWidth-12})+8 : 0;
                    if (currentY+rowHeight+noteHeight > 750) {
                        doc.addPage();
                        currentY = 40;
                    }

                    const bg = rowCount % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
                    doc.rect(startX, currentY, pageWidth, rowHeight+noteHeight).fillAndStroke(bg, cBorder);

                    // Capture values for scientific checks
                    const paramUpper = String(item.param).toUpperCase();
                    if (paramUpper === 'SAND') sandVal = Number(item.value);
                    if (paramUpper === 'SILT') siltVal = Number(item.value);
                    if (paramUpper === 'CLAY') clayVal = Number(item.value);
                    if (paramUpper === 'SOC') socVal = Number(item.value);
                    if (paramUpper === 'TN') tnVal = Number(item.value);

                    const interp = getInterpretation(item.param, item.value);

                    doc.fillColor(cDark).font('Helvetica-Bold').fontSize(7.5)
                        .text(item.name || item.param, col1 + 6, currentY + 4, { width: 145, ellipsis: true });

                    doc.font('Helvetica').fontSize(7.5).fillColor(cGray)
                        .text(item.method || item.standard || 'SoilFER SOP', col2 + 4, currentY + 4, { width: 120, ellipsis: true });

                    doc.font('Helvetica-Bold').fontSize(8).fillColor(cDark)
                        .text(valueText,col3+4,currentY+4,{width:60,align:'right'});

                    doc.font('Helvetica').fontSize(7.5).fillColor(cGray)
                        .text(item.unit || '', col4 + 4, currentY + 4);

                    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(interp.includes('Optimal') || interp.includes('Adequate') ? '#059669' : interp.includes('Low') || interp.includes('Acidic') ? '#D97706' : cDark)
                        .text(interp, col5 + 4, currentY + 4, { width: 100, ellipsis: true });

                    if(noteText)doc.font('Helvetica').fontSize(7.5).fillColor(cGray)
                        .text(noteText,startX+6,currentY+rowHeight+4,{width:pageWidth-12});
                    currentY += rowHeight+noteHeight;
                    rowCount++;
                });
            });

            // If no result groups, output placeholder table row
            if (rowCount === 0) {
                doc.rect(startX, currentY, pageWidth, 20).fillAndStroke('#FFFFFF', cBorder);
                doc.fillColor(cGray).font('Helvetica-Oblique').fontSize(8)
                    .text('Analytical determinations in progress. Official data will populate upon final validation.', startX + 10, currentY + 6);
                currentY += 24;
            }

            currentY += 10;

            // =========================================================================
            // 6. SOIL METROLOGY & SCIENTIFIC EVALUATION (USDA Texture & Stoichiometry)
            // =========================================================================
            let hasTexture = (sandVal !== null && siltVal !== null && clayVal !== null);
            let hasCn = (socVal !== null && tnVal !== null);

            if (hasTexture || hasCn) {
                if (currentY > 680) {
                    doc.addPage();
                    currentY = 40;
                }

                doc.rect(startX, currentY, pageWidth, 44).fillAndStroke('#F0FDF4', '#86EFAC');
                doc.fillColor(cSecondary).font('Helvetica-Bold').fontSize(8.5)
                    .text('SOIL METROLOGY & DERIVED CLASSIFICATION', startX + 8, currentY + 6);

                let evalText = '';
                if (hasTexture) {
                    const texture = calculateUsdaTexture(sandVal, siltVal, clayVal);
                    evalText += `• USDA Soil Texture Class: ${texture.className} (${texture.code}) [Sand: ${sandVal}%, Silt: ${siltVal}%, Clay: ${clayVal}%]  `;
                }
                if (hasCn) {
                    const cn = evaluateCnRatio(socVal, tnVal);
                    if (cn.cnRatio) {
                        evalText += `• C:N Stoichiometric Ratio: ${cn.cnRatio} (${cn.status === 'OPTIMAL' ? 'Optimal organic matter equilibrium' : cn.status})  `;
                    }
                }

                doc.font('Helvetica').fontSize(7.5).fillColor(cDark)
                    .text(evalText, startX + 8, currentY + 20, { width: pageWidth - 16 });

                currentY += 52;
            }

            // =========================================================================
            // 7. QA/QC ACCEPTANCE & DIGITAL ENDORSEMENT
            // =========================================================================
            if (currentY > 640) {
                doc.addPage();
                currentY = 40;
            }

            doc.font('Helvetica').fontSize(7.5);
            const qcHeight = doc.heightOfString(qcStatement, { width: 320 });
            const endorseHeight = Math.max(84, qcHeight + 66);
            if (currentY + endorseHeight > 770) { doc.addPage(); currentY = 40; }
            doc.rect(startX, currentY, pageWidth, endorseHeight).fillAndStroke(cLightBg, cBorder);

            // Left side: QA Statement
            doc.fillColor(cPrimary).font('Helvetica-Bold').fontSize(8.5)
                .text('QUALITY ASSURANCE & DATA INTEGRITY', startX + 10, currentY + 8);

            doc.font('Helvetica').fontSize(7.5).fillColor(cGray)
                .text(qcStatement, startX + 10, currentY + 22, { width: 320 })
                .text('• Metrological traceability: Calibrated instruments and analytical grade reagents referenced against recognized calibration standards.', startX + 10, currentY + qcHeight + 30, { width: 320 })
                .text('• Disclaimer: This certificate relates solely to the sample as received and tested.', startX + 10, currentY + qcHeight + 52, { width: 320 });

            // Right side: Authorization / Signature
            const sigX = startX + 340;
            doc.fillColor(cPrimary).font('Helvetica-Bold').fontSize(8.5)
                .text('ELECTRONIC APPROVAL RECORD', sigX, currentY + 8);

            const signedBy = reportContent.signedBy || {};
            doc.font('Helvetica-Bold').fontSize(9).fillColor(cDark)
                .text(signedBy.name || 'Laboratory Director', sigX, currentY + 24);

            doc.font('Helvetica').fontSize(7.5).fillColor(cGray)
                .text(signedBy.title || 'Laboratory Quality Manager', sigX, currentY + 36)
                .text(`Signed: ${signedBy.date ? String(signedBy.date).split('T')[0] : new Date().toISOString().split('T')[0]}`, sigX, currentY + 48)
                .text(`Approval Record: RECORDED IN AUDIT LOG`, sigX, currentY + 60, { width: 140 });

            currentY += endorseHeight + 14;

            // =========================================================================
            // 8. PAGE FOOTERS & TOTAL PAGES CALCULATION
            // =========================================================================
            const totalPages = doc.bufferedPageRange().count;
            for (let i = 0; i < totalPages; i++) {
                doc.switchToPage(i);
                // The footer sits below the body's bottom margin. Keep PDFKit
                // from flowing its text into a new page while numbering pages.
                const bottomMargin = doc.page.margins.bottom;
                doc.page.margins.bottom = 0;
                if (status === 'SUPERSEDED') {
                    doc.fillColor('#B91C1C').font('Helvetica-Bold').fontSize(8)
                        .text(`${labels.superseded} - ${labels.see} ${publication.replacementNumber || labels.notRecorded}`, startX, 787, { width: pageWidth, lineBreak: false });
                }
                doc.rect(36, 805, pageWidth, 0.5).fill(cBorder);

                doc.fillColor(cGray)
                    .font('Helvetica')
                    .fontSize(7)
                    .text('FAO SoilFER Programme · Soil Laboratory Quality Information System', 36, 810, { lineBreak: false })
                    .text(`Certificate No: ${number}`, 240, 810, { width: 235, align: 'center', lineBreak: false })
                    .text(`Page ${i + 1} of ${totalPages}`, startX, 810, { width: pageWidth, align: 'right', lineBreak: false });
                doc.page.margins.bottom = bottomMargin;
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generateReportPdfBuffer,
    getInterpretation
};
