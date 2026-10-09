const PDFDocument = require('pdfkit');
const { generateReportPdfBuffer } = require('../../services/pdfGenerator');

describe('#192 saved not-reportable PDF explanations', () => {
    test.each(['en', 'es', 'es-419', 'fr', 'pt'].flatMap(locale =>
        ['short', 'multiple pages'].map(length => [locale, length])))('%s / %s retains the entire reason before the following result', async (locale, length) => {
        const label = require(`../../locales/${locale}.json`).reportedValue.notReportable;
        const reason = `${label}: ${'Retained evidence requires reviewer clarification. '.repeat(length === 'short' ? 8 : 240)}END-OF-SAVED-REASON`;
        const calls = [];
        const original = PDFDocument.prototype.text;
        const spy = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function(value, x, y, options) {
            const pageBefore = this.page;
            const result = original.call(this, value, x, y, options);
            calls.push({ value, x, y, options, pageBefore, pageAfter: this.page, endY: this.y });
            return result;
        });
        let pdf;
        try {
            pdf = await generateReportPdfBuffer({
                meta: { locale }, sample: { id: 'OWNED-PDF-192', labId: 'OWNED-PDF-192' },
                lab: { name: 'Owned PDF contract' },
                resultGroups: [{ categoryName: 'Saved values', items: [
                    { param: 'SOC', name: 'Soil organic carbon', value: reason, reportedMode: 'NOT_REPORTABLE',
                        reportedValueSelectionId: 'saved-nr', method: 'Recorded method' },
                    { param: 'PH_H2O', name: 'pH in water', value: '6.345678', unit: 'pH_units',
                        reportedValueSelectionId: 'saved-ph', decimalPlaces: 2, method: 'Recorded method' }
                ] }]
            });
        } finally { spy.mockRestore(); }
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
        const explanation = calls.filter(call => call.value === reason);
        expect(explanation).toHaveLength(1);
        expect(explanation[0].options).toEqual({ width: 511.28 });
        expect(explanation[0].endY).toBeLessThan(750);
        const rowLabel = calls.find(call => call.value === label);
        expect(rowLabel).toBeDefined();
        // An unavailable result must not be described as a normal measurement.
        expect(calls.some(call => call.value === 'Normal' && call.pageBefore === rowLabel.pageBefore && call.y === rowLabel.y)).toBe(false);
        const followingValue = calls.find(call => call.value === '6.35');
        expect(followingValue).toBeDefined();
        expect(followingValue.pageBefore).toBe(explanation[0].pageAfter);
        expect(followingValue.y).toBeGreaterThanOrEqual(explanation[0].endY + 4);
        if (length === 'multiple pages') expect(explanation[0].pageAfter).not.toBe(explanation[0].pageBefore);
    });
});
