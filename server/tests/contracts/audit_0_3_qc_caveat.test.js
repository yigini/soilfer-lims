const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PDFDocument = require('pdfkit');
const { generateReportPdfBuffer } = require('../../services/pdfGenerator');
const React = require('../../../client/node_modules/react');
const ReactDOMServer = require('../../../client/node_modules/react-dom/server');
const esbuild = require('../../../client/node_modules/esbuild');
const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/report/ReportContent.jsx'), 'utf8');
const transformed = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' });
const mod = { exports: {} };
vm.runInNewContext(transformed.code, { module: mod, exports: mod.exports, require: name => name === 'react' ? React : {}, console });
const ReportContent = mod.exports.default;

describe('Audit 0.3: truthful frozen QC caveats in both renderers', () => {
    test.each(['en', 'es', 'es-419', 'fr', 'pt'])('%s caveat replaces the QA claim in HTML and PDF', async locale => {
        const statement = require(`../../locales/${locale}.json`).resultReports.qcWarningStatement;
        const data = { sample: { id: 'sample', labId: 'lab' }, client: {}, lab: {}, generated: {}, resultGroups: [],
            qcWarnings: [{ batchId: 'batch', analysisCode: 'PH_H2O', qcStatus: 'QC_FAIL', dispositionDecision: null }], qcWarningStatement: statement };
        const html = ReactDOMServer.renderToStaticMarkup(React.createElement(ReportContent, { data }));
        expect(html).toContain(statement);
        expect(html).not.toContain('All analyses were performed according to standard laboratory protocols.');
        const text = jest.spyOn(PDFDocument.prototype, 'text');
        try {
            const pdf = await generateReportPdfBuffer(data);
            expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
            expect(text.mock.calls.some(([value]) => value === statement)).toBe(true);
            expect(text.mock.calls.some(([value]) => typeof value === 'string' && value.includes('All batch Quality Control checks'))).toBe(false);
        } finally { text.mockRestore(); }
    });
});