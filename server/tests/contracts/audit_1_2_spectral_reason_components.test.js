const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');
const clientRoot = path.resolve(__dirname, '../../../client/src');
const settle = () => new Promise(resolve => setImmediate(resolve));
const t = key => key;
function load(file, resolve = () => ({})) {
    const module = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.join(clientRoot, file), 'utf8'),
        { loader: file.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' }).code,
    { module, exports: module.exports, require: resolve, console, window: { addEventListener() {}, removeEventListener() {} } });
    return module.exports;
}
const workflow = load('utils/spectralWorkflowRequest.js');
function elements(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap(node => elements(node, predicate));
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}
function host(file, axios = {}) {
    const states = [], showDialog = jest.fn();
    let cursor = 0;
    const hooks = { ...React, useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    }, useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {} };
    const icons = new Proxy({}, { get: (_, iconName) => Object.assign(() => null, { iconName }) });
    const exported = load(file, name => {
        if (name === 'react') return hooks;
        if (name === 'axios') return axios;
        if (name === 'lucide-react') return icons;
        if (name.includes('AuthContext')) return { useAuth: () => ({ user: { role: 'LAB_MANAGER' } }) };
        if (name.includes('LanguageContext')) return { useLanguage: () => ({ t }) };
        if (name.includes('DialogContext')) return { useDialog: () => ({ showDialog }) };
        if (name.includes('NotificationContext')) return { useNotifications: () => ({}) };
        if (name.includes('spectralWorkflowRequest')) return workflow;
        return () => null;
    });
    const component = exported.default || exported.DialogProvider;
    return { states, showDialog, render() { cursor = 0; return component({}); } };
}

test('required prompt blocks whitespace by button and Enter and submits the actual reason', () => {
    const h = host('context/DialogContext.jsx');
    const confirm = jest.fn();
    h.render().props.value.showDialog({ type: 'prompt', title: 'Reason', inputRequired: true, onConfirm: confirm });
    let tree = h.render(), input = elements(tree, node => node.type === 'input')[0];
    input.props.onChange({ target: { value: '   ' } });
    tree = h.render(); input = elements(tree, node => node.type === 'input')[0];
    const button = elements(tree, node => node.type === 'button' && node.props.children === 'OK')[0];
    expect(button.props.disabled).toBe(true); button.props.onClick(); input.props.onKeyDown({ key: 'Enter' });
    expect(confirm).not.toHaveBeenCalled();
    input.props.onChange({ target: { value: 'Instrument recheck' } });
    tree = h.render();
    elements(tree, node => node.type === 'button' && node.props.children === 'OK')[0].props.onClick();
    expect(confirm).toHaveBeenCalledWith('Instrument recheck');
});

test('single library trash sends the required reason in the DELETE body', async () => {
    const axios = { delete: jest.fn().mockResolvedValue({ data: {} }) }, h = host('pages/SpectralLibrary.jsx', axios);
    h.render(); h.states[1] = [{ id: 'scan-179', labId: 'LABEL-179', status: 'PENDING', modality: 'NIR', metadata: {} }];
    h.states[8] = new Set(['scan-179']);
    const buttons = elements(h.render(), node => node.type === 'button' && elements(node, child => child.type?.iconName === 'Trash').length);
    buttons.at(-1).props.onClick();
    const prompt = h.showDialog.mock.calls.at(-1)[0];
    expect(prompt).toMatchObject({ type: 'prompt', inputRequired: true });
    await prompt.onConfirm('  '); expect(axios.delete).not.toHaveBeenCalled();
    await prompt.onConfirm('  Invalid acquisition  ');
    expect(axios.delete).toHaveBeenCalledWith('/api/spectral/scan-179', { data: { reason: 'Invalid acquisition' } });
});

test('batch trash preserves the selected ids and supplies one reason', async () => {
    const axios = { post: jest.fn().mockResolvedValue({ data: { message: 'Done' } }), get: jest.fn().mockResolvedValue({ data: { data: [] } }) };
    const h = host('pages/SpectralLibrary.jsx', axios); h.render(); h.states[6] = new Set(['scan-a', 'scan-b']);
    const button = elements(h.render(), node => node.type === 'button' && node.props.onClick?.name === 'handleBatchDelete')[0];
    button.props.onClick(); const prompt = h.showDialog.mock.calls.at(-1)[0];
    expect(prompt).toMatchObject({ type: 'prompt', inputRequired: true });
    await prompt.onConfirm('Replicates acquired in error');
    expect(axios.post).toHaveBeenCalledWith('/api/spectral/batch-delete', { ids: ['scan-a', 'scan-b'], reason: 'Replicates acquired in error' });
});

test('a reopen refusal prompts once and retries the same request with the supplied reason', async () => {
    const refusal = { response: { status: 409, data: { code: 'WORKITEM_REOPEN_REQUIRED' } } };
    const send = jest.fn().mockRejectedValueOnce(refusal).mockResolvedValueOnce({ data: { success: true } }), showDialog = jest.fn();
    const pending = workflow.requestWithSpectralReopen(send, showDialog, t); await settle();
    expect(showDialog.mock.calls[0][0]).toMatchObject({ type: 'prompt', inputRequired: true });
    showDialog.mock.calls[0][0].onConfirm('  A replacement scan is required  ');
    expect(await pending).toEqual({ data: { success: true } });
    expect(send.mock.calls).toEqual([[], ['A replacement scan is required']]);
});

test('canceling a reopen prompt does not retry; unrelated failures do not prompt', async () => {
    const send = jest.fn().mockRejectedValue({ response: { status: 409, data: { code: 'WORKITEM_REOPEN_REQUIRED' } } }), showDialog = jest.fn();
    const pending = workflow.requestWithSpectralReopen(send, showDialog, t); await settle();
    showDialog.mock.calls[0][0].onCancel(); expect(await pending).toBeNull(); expect(send).toHaveBeenCalledTimes(1);
    const other = { response: { status: 403, data: { code: 'ACCESS_DENIED' } } }; showDialog.mockClear(); send.mockRejectedValue(other);
    await expect(workflow.requestWithSpectralReopen(send, showDialog, t)).rejects.toBe(other); expect(showDialog).not.toHaveBeenCalled();
});

test('spectral reason prompts have messages in all five locales', () => {
    for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        const messages = require(`../../../client/src/translations/${locale}.json`).spectralWorkflow;
        for (const key of ['reason', 'retry', 'reopenTitle', 'reopenMessage', 'trashTitle', 'trashMessage', 'batchTrashMessage', 'trashConfirm']) {
            expect(messages[key]).toEqual(expect.any(String)); expect(messages[key].trim()).not.toBe('');
        }
    }
});
