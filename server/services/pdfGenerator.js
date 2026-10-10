/**
 * SoilFER-LIMS Analytical Report & Certificate of Analysis PDF Generator
 * 
 * Generates ISO/IEC 17025 compliant, publication-grade Soil Analysis Certificates.
 * Pure JavaScript implementation using PDFKit (zero external binary / headless Chrome dependencies).
 */

const PDFDocument = require('pdfkit');
const { displayResult, resultNotes, displayUncertainty } = require('./reportContentDisplay');
const { iso } = require('./reportContentEvidence');
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
            if (status === 'WITHDRAWN') {
                doc.fillColor('#B91C1C').font('Helvetica-Bold').fontSize(10)
                    .text(labels.withdrawnPendingAmendment.replace('{{amendmentId}}', publication.withdrawal.amendmentId), startX, currentY, { width: pageWidth });
                currentY = doc.y + 10;
            }
            const amendment = reportContent.amendment;
            if (amendment?.statement) {
                // #211: the statement, marks and removals were frozen at generation.
                doc.fillColor('#B45309').font('Helvetica-Bold').fontSize(9)
                    .text(amendment.statement, startX, currentY, { width: pageWidth });
                doc.fillColor(cGray).font('Helvetica').fontSize(7.5)
                    .text(`${labels.amendmentChangedMark} ${labels.amendmentChangedLegend}  ${labels.amendmentAddedMark} ${labels.amendmentAddedLegend}`, startX, doc.y + 2, { width: pageWidth });
                if (amendment.removed?.length) doc.text(`${labels.amendmentRemoved}: ${amendment.removed.map(row =>
                    [row.name, row.basis, [row.value, row.unit].filter(Boolean).join(' ')].filter(Boolean).join(' ')).join('; ')}`,
                startX, doc.y + 2, { width: pageWidth });
                currentY = doc.y + 10;
            } else if (reportContent.publication?.replacesReportNumber) {
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
                .text(`Lab Code: ${lab.code || labels.notRecorded}`, startX + 8, currentY + 40)
                .text(`Address: ${lab.address || labels.notRecorded}${lab.city ? ', ' + lab.city : ''}`, startX + 8, currentY + 52)
                .text(`Email: ${lab.email || labels.notRecorded} | Tel: ${lab.phone || labels.notRecorded}`, startX + 8, currentY + 64);

            // --- Right Box: Sample Identification & Provenance ---
            const rightX = startX + colWidth + 12;
            doc.rect(rightX, currentY, colWidth, boxHeight).fillAndStroke(cLightBg, cBorder);

            // Header bar
            doc.rect(rightX, currentY, colWidth, 18).fill('#E2E8F0');
            doc.fillColor(cPrimary).font('Helvetica-Bold').fontSize(8.5)
                .text('SAMPLE PROVENANCE & IDENTIFICATION', rightX + 8, currentY + 5);

            const sampleDepth = sample.depthTop != null && sample.depthBottom != null
                ? `${sample.depthTop} - ${sample.depthBottom} cm` 
                : labels.notRecorded;

            doc.fillColor(cDark).font('Helvetica-Bold').fontSize(8)
                .text('Laboratory ID:', rightX + 8, currentY + 24)
                .text('Original / Field ID:', rightX + 8, currentY + 36)
                .text('Project / Country:', rightX + 8, currentY + 48)
                .text('Client / Submitter:', rightX + 8, currentY + 60)
                .text('Sampling Depth / Horiz:', rightX + 8, currentY + 72)
                .text('Date Received / Accepted:', rightX + 8, currentY + 84)
                .text(labels.approvedAt + ':', rightX + 8, currentY + 96);

            doc.font('Helvetica').fontSize(8).fillColor(cDark)
                .text(sample.labId || sample.id || 'N/A', rightX + 110, currentY + 24)
                .text(sample.originalId || 'N/A', rightX + 110, currentY + 36)
                .text(`${sample.projectCode || reportContent.project?.code || 'SOILFER'} (${sample.countryName || 'Regional'})`, rightX + 110, currentY + 48)
                .text(`${client.name || sample.clientName || 'General Intake'}`, rightX + 110, currentY + 60, { width: colWidth - 118, ellipsis: true })
                .text(`${sampleDepth} ${sample.horizon ? `[${sample.horizon}]` : ''}`, rightX + 110, currentY + 72)
                .text(iso(sample.receptionDate)?.split('T')[0] || labels.notRecorded, rightX + 110, currentY + 84)
                .text(iso(reportContent.signedBy?.date)?.split('T')[0] || labels.notRecorded, rightX + 110, currentY + 96);

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

            const sampleEvidence = sample.reportEvidence || {};
            const condition = sampleEvidence.conditionOnReceipt || {};
            const sampleText = [
                `${labels.conditionOnReceipt}: ${[condition.moisture, condition.status, condition.note].filter(Boolean).join(' · ') || labels.notRecorded}`,
                `${labels.intakeNonconformities}: ${sampleEvidence.intakeNonconformities?.join('; ') || labels.notRecorded}`,
                `${labels.analysisDates}: ${sampleEvidence.analysisStart || labels.notRecorded} – ${sampleEvidence.analysisEnd || labels.notRecorded}`,
                `${labels.sampling}: ${sampleEvidence.sampling || labels.notStated}`
            ].join('\n');
            const bottomMargin = doc.page.margins.bottom;
            doc.page.margins.bottom = 92;
            doc.font('Helvetica').fontSize(7.5).fillColor(cGray).text(sampleText, startX, currentY, { width: pageWidth });
            currentY = doc.y + 10; doc.page.margins.bottom = bottomMargin;

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
            const col5 = startX + 415;        // Expanded uncertainty (100pt)

            // Table Header Row
            doc.rect(startX, currentY, pageWidth, 18).fill('#1E293B');
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
                .text('PARAMETER / DETERMINATION', col1 + 6, currentY + 5)
                .text('METHOD / STANDARD', col2 + 4, currentY + 5)
                .text('RESULT', col3 + 4, currentY + 5, { width: 60, align: 'right' })
                .text('UNIT', col4 + 4, currentY + 5)
                .text(labels.expandedUncertainty, col5 + 4, currentY + 5);

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
                    const valueText=notReportable ? require('../locales/'+locale+'.json').reportedValue.notReportable : displayResult(item, labels);
                    const valueHeight=doc.font('Helvetica-Bold').fontSize(8).heightOfString(valueText,{width:60});
                    const uncertaintyText = displayUncertainty(item, labels);
                    const uncertaintyHeight = doc.font('Helvetica').fontSize(7.5).heightOfString(uncertaintyText, { width: 100 });
                    const rowHeight=Math.max(16,valueHeight+8,uncertaintyHeight+8);
                    // Keep the opinion frozen in the report payload. Historical
                    // payloads without it retain the existing interpretation formatter.
                    const interpretation = notReportable ? null : Object.hasOwn(item, 'interpretation')
                        ? item.interpretation?.label : getInterpretation(item.param, item.value, item.unit);
                    const noteText = [resultNotes(item, labels),
                        notReportable ? null : `${labels.interpretation}: ${interpretation || labels.notStated}`
                    ].filter(Boolean).join('\n');
                    const noteHeight=noteText ? doc.font('Helvetica').fontSize(7.5).heightOfString(noteText,{width:pageWidth-12})+8 : 0;
                    // Keep short explanations with their row. Long explanations
                    // flow across pages, reserving the publication footer.
                    const fitsWholePage=rowHeight+noteHeight <= 710;
                    if (currentY+rowHeight+(fitsWholePage ? noteHeight : 28) > 750) {
                        doc.addPage();
                        currentY = 40;
                    }

                    const bg = rowCount % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
                    const noteFits=currentY+rowHeight+noteHeight <= 750;
                    doc.rect(startX, currentY, pageWidth, rowHeight+(noteFits ? noteHeight : 0)).fillAndStroke(bg, cBorder);

                    // Capture values for scientific checks
                    const paramUpper = String(item.param).toUpperCase();
                    if (paramUpper === 'SAND') sandVal = Number(item.value);
                    if (paramUpper === 'SILT') siltVal = Number(item.value);
                    if (paramUpper === 'CLAY') clayVal = Number(item.value);
                    if (paramUpper === 'SOC') socVal = Number(item.value);
                    if (paramUpper === 'TN') tnVal = Number(item.value);

                    doc.fillColor(cDark).font('Helvetica-Bold').fontSize(7.5)
                        .text(`${item.amendmentChange === 'CHANGED' ? labels.amendmentChangedMark + ' '
                            : item.amendmentChange === 'ADDED' ? labels.amendmentAddedMark + ' ' : ''}${item.name || item.param}`,
                        col1 + 6, currentY + 4, { width: 145, ellipsis: true });

                    doc.font('Helvetica').fontSize(7.5).fillColor(cGray)
                        .text(item.method || item.standard || labels.methodNotRecorded, col2 + 4, currentY + 4, { width: 120, ellipsis: true });

                    doc.font('Helvetica-Bold').fontSize(8).fillColor(cDark)
                        .text(valueText,col3+4,currentY+4,{width:60,align:'right'});

                    doc.font('Helvetica').fontSize(7.5).fillColor(cGray)
                        .text(item.unit || '', col4 + 4, currentY + 4);

                    doc.font('Helvetica').fontSize(7.5).fillColor(cDark)
                        .text(uncertaintyText, col5 + 4, currentY + 4, { width: 100 });

                    if(noteText) {
                        const bottomMargin=doc.page.margins.bottom;
                        doc.page.margins.bottom=92;
                        doc.font('Helvetica').fontSize(7.5).fillColor(cGray)
                            .text(noteText,startX+6,currentY+rowHeight+4,{width:pageWidth-12});
                        currentY=doc.y+4;
                        doc.page.margins.bottom=bottomMargin;
                    } else currentY += rowHeight;
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

            // Display only the actual methods frozen into this report payload.
            if (reportContent.methodologies?.length) {
                const methodText = reportContent.methodologies.map(method => `${method.param}: ${method.method || labels.methodNotRecorded}` +
                    `${method.methodVersion != null ? ` · v${method.methodVersion}` : ''}` +
                    `${method.standard ? ` · ${method.standard}` : ''}` +
                    `${method.reference?.citation ? ` · ${method.reference.citation}` : ''}`).join('\n');
                const height = doc.font('Helvetica').fontSize(7.5).heightOfString(methodText, { width: pageWidth });
                if (currentY + Math.min(height + 24, 710) > 750) { doc.addPage(); currentY = 40; }
                doc.font('Helvetica-Bold').fontSize(8).fillColor(cPrimary).text(labels.methodReferences, startX, currentY);
                const bottomMargin = doc.page.margins.bottom;
                doc.page.margins.bottom = 92;
                doc.font('Helvetica').fontSize(7.5).fillColor(cGray).text(methodText, startX, doc.y + 4, { width: pageWidth });
                currentY = doc.y + 12; doc.page.margins.bottom = bottomMargin;
            }

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
            const signedBy = reportContent.signedBy || {};
            const issuer = reportContent.publication?.issuer || {};
            const signatureRows = [
                { text: signedBy.username && signedBy.date ? signedBy.name || signedBy.username : labels.approvalNotRecorded, font: 'Helvetica-Bold', size: 9 },
                { text: `${labels.approvalRole}: ${signedBy.title || labels.notRecorded}`, font: 'Helvetica', size: 7.5 },
                { text: `${labels.approvedAt}: ${iso(signedBy.date) || labels.notRecorded}`, font: 'Helvetica', size: 7.5 },
                { text: `${labels.issuedBy}: ${issuer.name || issuer.username || labels.notRecorded}`, font: 'Helvetica-Bold', size: 8, gapBefore: 10 },
                { text: `${labels.issuerRole}: ${issuer.role || labels.notRecorded}`, font: 'Helvetica', size: 7.5 },
                { text: `${labels.issuedAt}: ${iso(issuedAt) || labels.notRecorded}`, font: 'Helvetica', size: 7.5 }
            ];
            let signatureEnd = 24;
            for (const row of signatureRows) {
                signatureEnd += row.gapBefore || 0;
                row.offset = signatureEnd;
                signatureEnd += doc.font(row.font).fontSize(row.size).heightOfString(row.text, { width: 160 }) + 4;
            }
            const endorseHeight = Math.max(120, qcHeight + 66, signatureEnd + 8);
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

            for (const row of signatureRows) {
                doc.font(row.font).fontSize(row.size).fillColor(row.font === 'Helvetica-Bold' ? cDark : cGray)
                    .text(row.text, sigX, currentY + row.offset, { width: 160 });
            }

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
                if (status === 'WITHDRAWN') {
                    doc.fillColor('#B91C1C').font('Helvetica-Bold').fontSize(8)
                        .text(labels.withdrawnPendingAmendment.replace('{{amendmentId}}', publication.withdrawal.amendmentId), startX, 787, { width: pageWidth, lineBreak: false });
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
