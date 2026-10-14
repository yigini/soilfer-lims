const fs = require('node:fs'), path = require('node:path');
const { mountUi } = require('../helpers/qcWorksheetUi');
function mount(status = 'PROCESSING') {
    const axios = { get: jest.fn(async () => ({ data: [] })), post: jest.fn(async () => ({ data: {} })), put: jest.fn(async () => ({ data: {} })) };
    return mountUi('components/sample/AnalysisUpdateModal.jsx', { sample: { id: 'owned-order-ui', status, requiredAnalyses: ['PH_H2O'] },
        isOpen: true, onClose: jest.fn(), onUpdateSuccess: jest.fn() }, { axios });
}
const save = view => view.all().find(node => node.type === 'button' && String(view.text()).includes('Save Changes') && node.props.onClick?.name === 'handleSave');
const reason = view => view.all().find(node => node.type === 'input' && node.props.id === 'order-revision-reason');

test('the actual analysis dialog requires a reason and sends the full selection with that reason', async () => {
    const view = mount(); await view.render();
    expect(reason(view).props.required).toBe(true); expect(save(view).props.disabled).toBe(true);
    await save(view).props.onClick(); await view.render(); expect(view.axios.put).not.toHaveBeenCalled();
    expect(view.text()).toContain('orderRevision.reasonRequired');
    reason(view).props.onChange({ target: { value: ' Reviewed full order ' } }); await view.render();
    expect(save(view).props.disabled).toBe(false); await save(view).props.onClick();
    expect(view.axios.put).toHaveBeenCalledWith('/api/samples/owned-order-ui/analyses',
        expect.objectContaining({ analyses: ['PH_H2O'], reason: 'Reviewed full order' }), expect.any(Object));
    view.unmount();
});

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED'])('the actual %s dialog guides amendment and disables direct order changes', async status => {
    const view = mount(status); await view.render();
    reason(view).props.onChange({ target: { value: 'Reviewed request' } }); await view.render();
    expect(save(view).props.disabled).toBe(true); expect(view.text()).toContain('orderRevision.amendmentRequired');
    expect(view.axios.put).not.toHaveBeenCalled(); view.unmount();
});

test.each(['en','es','es-419','fr','pt'])('order-revision messages exist in both %s catalogues', locale => {
    for (const directory of ['client/src/translations', 'server/locales']) {
        const messages = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../..', directory, locale + '.json'), 'utf8')).orderRevision;
        for (const key of ['reason','reasonPlaceholder','reasonRequired','completeTarget','amendmentRequired']) expect(messages[key].trim()).not.toBe('');
    }
});
