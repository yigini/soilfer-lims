const { mountUi, nodes, content } = require('../helpers/qcWorksheetUi');
const { localeTranslator } = require('../helpers/clientTranslation');

test('public share page passes localized Download PDF label to ReportPdfButton in all 5 locales', async () => {
    for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        const client = require('../../../client/src/translations/' + locale + '.json');
        expect(typeof client.resultReports.downloadPdf).toBe('string');
        expect(client.resultReports.downloadPdf.trim().length).toBeGreaterThan(0);

        const axios = {
            get: jest.fn(async () => ({
                data: { id: 'rep-1', version: 2, sampleLabId: 'LAB-1', content: { reportNumber: 'R-1' } }
            }))
        };
        const view = mountUi('pages/PublicReport.jsx', {}, {
            axios,
            routeParams: { token: 'pub-token-1' },
            translate: localeTranslator(locale)
        });
        await view.render();
        await view.render();

        const pdfButton = view.all().find(node => node.type === view.children['../components/report/ReportPdfButton']);
        expect(pdfButton).toBeTruthy();
        expect(pdfButton.props.publicToken).toBe('pub-token-1');
        expect(pdfButton.props.label).toBe(client.resultReports.downloadPdf);
    }
});

test('ReportPdfButton renders visible text with icon when label is passed, and stays icon-only otherwise', async () => {
    const t = localeTranslator('en');
    const report = { id: 'rep-1', version: 2, sampleLabId: 'LAB-1' };

    const labeled = mountUi('components/report/ReportPdfButton.jsx', {
        report,
        publicToken: 'pub-token-1',
        label: t('resultReports.downloadPdf', 'Download PDF')
    }, { translate: t });
    await labeled.render();
    const labeledBtn = labeled.all().find(node => node.type === 'button');
    expect(labeledBtn).toBeTruthy();
    expect(labeledBtn.props['aria-label']).toBeUndefined();
    expect(labeledBtn.props.title).toBe('Download PDF');
    expect(content(labeledBtn)).toContain('Download PDF');
    expect(nodes(labeledBtn).some(node => node.props?.['aria-hidden'] === 'true')).toBe(true);

    const iconOnly = mountUi('components/report/ReportPdfButton.jsx', { report }, { translate: t });
    await iconOnly.render();
    const iconBtn = iconOnly.all().find(node => node.type === 'button');
    expect(iconBtn).toBeTruthy();
    expect(iconBtn.props['aria-label']).toBe('Print / Save as PDF');
    expect(content(iconBtn).trim()).toBe('');
    expect(nodes(iconBtn).some(node => node.props?.['aria-hidden'] === 'true')).toBe(true);
});
