const { mountUi } = require('../helpers/qcWorksheetUi');
test('the actual public component shows the localized amendment notice for REPORT_WITHDRAWN and renders no report content', async () => {
    const axios = { get: jest.fn(async () => { throw { response: { status: 409, data: { code: 'REPORT_WITHDRAWN', error: 'Internal details must not appear' } } }; }) };
    const view = mountUi('pages/PublicReport.jsx', {}, { axios, routeParams: { token: 'owned-public-token' } });
    await view.render(); await view.render();
    expect(axios.get).toHaveBeenCalledWith('/api/reports/public/owned-public-token');
    expect(view.text()).toContain('amendment.publicWithdrawn');
    expect(view.text()).not.toContain('Internal details must not appear');
    expect(view.text()).not.toContain('Failed to load report');
    expect(view.all().some(node => node.props?.content || node.props?.report)).toBe(false);
});
test('five client and server locales disclose withdrawal without a replacement pointer', () => {
    for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        const client = require('../../../client/src/translations/' + locale + '.json');
        const server = require('../../locales/' + locale + '.json');
        expect(client.amendment.publicWithdrawn).toEqual(expect.any(String));
        expect(client.amendment.publicWithdrawn.trim()).not.toBe('');
        expect(server.amendment.publicWithdrawn).toBe(client.amendment.publicWithdrawn);
    }
});
