const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const ReactDOMServer = require('../../../client/node_modules/react-dom/server');
const esbuild = require('../../../client/node_modules/esbuild');
const PDFDocument = require('pdfkit');
const { generateReportPdfBuffer } = require('../../services/pdfGenerator');

function reportPresentationFixture(locale = 'en', missing = true) {
    const at = '2026-11-17T12:00:00.000Z';
    return { meta: { locale }, reportNumber: 'OWNED-PRESENTATION-456',
        sample: { id: 'OWNED-SAMPLE-456', labId: 'OWNED-456', approvedBy: 'internal-reviewer', approvedAt: at },
        lab: { name: 'Owned certificate laboratory' },
        locationData: { country: 'ES', district: 'A Coruña', region: 'Galicia' },
        fieldMetadata: { country: { value: 'ES', label: 'España' } },
        signedBy: { username: 'internal-reviewer', name: 'Marta Example', title: 'LAB_MANAGER', date: at },
        publication: { status: 'PUBLISHED', publishedAt: at, issuer: { username: 'internal-issuer', name: 'Alex Example', role: 'LAB_MANAGER' } },
        generated: { at, by: 'internal-issuer' },
        resultGroups: [{ categoryName: 'Physical & Hydraulic Properties', items: ['SAND', 'SILT', 'CLAY'].map((param, index) => ({
            param, name: ['Sand fraction', 'Silt fraction', 'Clay fraction'][index], value: String([60, 25, 15][index]), unit: '%', basis: 'AIR_DRY',
            method: missing ? null : 'Retained particle-size method', methodVersion: missing ? null : 3,
            executedMethods: [{ param, method: missing ? null : 'Retained particle-size method', methodVersion: missing ? null : 3 }],
            flags: ['QC_WARN'], qcNotes: ['PROCEED_WITH_WARNING · INTERNAL MANAGER FREE TEXT']
        })) }],
        methodologies: ['SAND', 'SILT', 'CLAY'].map(param => ({ param, paramName: param + ' recorded name', method: missing ? null : 'Retained particle-size method', methodVersion: missing ? null : 3 })),
        evidence: { qc: { withinLimits: false, deviations: [{ analysisCode: 'CLAY', qcStatus: 'NO_BATCH', acknowledgedBy: 'internal-reviewer',
            acknowledgementReason: 'INTERNAL MANAGER FREE TEXT', dispositionReason: 'INTERNAL DISPOSITION' }] } },
        qcStatement: 'QC deviations: CLAY · NO_BATCH · internal-reviewer · INTERNAL MANAGER FREE TEXT'
    };
}

function renderReportHtml(content) {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/report/ReportContent.jsx'), 'utf8');
    const module = { exports: {} };
    class FixedDate extends Date {
        constructor(...args) { super(...(args.length ? args : ['2026-11-17T12:00:00Z'])); }
        toLocaleDateString(locale, options) { return super.toLocaleDateString(locale, { ...options, timeZone: 'UTC' }); }
    }
    vm.runInNewContext(esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' }).code, {
        module, exports: module.exports, Date: FixedDate,
        require: name => name === 'react' ? React : name === '@lims/reported-value-format'
            ? require('../../../shared/reportedValueFormat') : {}
    });
    return ReactDOMServer.renderToStaticMarkup(React.createElement(module.exports.default, { data: content }));
}

async function reportPdfTexts(content) {
    const texts = [], original = PDFDocument.prototype.text;
    PDFDocument.prototype.text = function (value, ...args) { texts.push(String(value)); return original.call(this, value, ...args); };
    try { await generateReportPdfBuffer(content); return texts; }
    finally { PDFDocument.prototype.text = original; }
}
module.exports = { reportPresentationFixture, renderReportHtml, reportPdfTexts };
