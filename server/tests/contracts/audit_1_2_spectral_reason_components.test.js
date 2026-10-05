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
    { module, exports: module.exports, require: resolve, console, FormData: class {
        constructor() { this.fields = []; }
        append(key, value) { this.fields.push([key, value]); }
        set(key, value) { this.fields = this.fields.filter(([name]) => name !== key); this.append(key, value); }
        get(key) { return this.fields.find(([name]) => name === key)?.[1]; }
        getAll(key) { return this.fields.filter(([name]) => name === key).map(([, value]) => value); }
    }, window: { addEventListener() {}, removeEventListener() {} } });
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
    return { states, showDialog, render(props = {}) { cursor = 0; return component(props); } };
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
        for (const key of ['reason', 'retry', 'reopenTitle', 'reopenMessage', 'trashTitle', 'trashMessage', 'batchTrashMessage', 'trashConfirm',
            'partialTitle', 'receiptTitle', 'receiptCounts', 'retryFailed']) {
            expect(messages[key]).toEqual(expect.any(String)); expect(messages[key].trim()).not.toBe('');
        }
    }
});

test.each(['upload', 'review', 'staged'])('%s flow prompts once and resends the exact original files or decisions', async flow => {
    const refusal = { response: { status: 409, data: { code: 'WORKITEM_REOPEN_REQUIRED' } } };
    const calls = [], axios = { post: jest.fn((url, body) => {
        calls.push({ url, body, reason: body.get ? body.get('reopenReason') : body.reopenReason });
        return calls.length === 1 ? Promise.reject(refusal) : Promise.resolve({ data: {
            results: { success: 1, failed: 0, errors: [] }, success: 1, failed: 0, complete: true, message: 'Done'
        } });
    }), get: jest.fn().mockResolvedValue({ data: { data: [] } }) };
    const file = { name: 'retained-raw.csv', bytes: Buffer.from('wavelength,value\n4000,0.1') };
    const props = flow === 'staged' ? { isOpen: true } : { currentSampleId: 'same-sample', targetWorkItemId: 'same-work' };
    const h = host(flow === 'upload' ? 'components/SpectraBatchUpload.jsx' : flow === 'review' ? 'pages/SpectralLibrary.jsx'
        : 'components/workbench/SpectralIntakeModal.jsx', axios);
    h.render(props);
    if (flow === 'upload') {
        h.states[0] = 2; h.states[1] = file; h.states[2] = [file]; h.states[9] = 'same-equipment';
        h.states[5] = { new: [], errors: [], scans: [{ labId: 'retained-sample', wavelengths: [4000, 400], values: [0.1, 0.2] }] };
    } else if (flow === 'review') h.states[6] = new Set(['scan-a', 'scan-b']);
    else {
        h.states[0] = 3; h.states[2] = 'same-equipment'; h.states[6] = 'same-manifest';
        h.states[7] = [{ id: 'entry-a', filename: file.name, qcStatus: 'PASS', matchedSample: { id: 'same-sample' } }];
        h.states[9] = { 'entry-a': { decision: 'PROCEED', sampleId: 'same-sample', targetWorkItemId: 'same-work' } };
        h.states[10] = true;
    }
    const handler = flow === 'upload' ? 'handleConfirm' : flow === 'review' ? 'handleBatchApprove' : 'handleExecuteCommit';
    const button = elements(h.render(props), node => node.type === 'button' && node.props.onClick?.name === handler)[0];
    expect(button).toBeDefined(); let pending = button.props.onClick();
    if (flow === 'review') pending = h.showDialog.mock.calls.at(-1)[0].onConfirm();
    await settle(); const prompt = h.showDialog.mock.calls.at(-1)[0];
    expect(prompt).toMatchObject({ type: 'prompt', inputRequired: true });
    prompt.onConfirm('  Replacement reviewed  '); await pending;
    expect(h.showDialog.mock.calls.filter(([dialog]) => dialog.type === 'prompt')).toHaveLength(1);
    expect(axios.post).toHaveBeenCalledTimes(2); expect(calls[0].reason).toBeUndefined(); expect(calls[1].reason).toBe('Replacement reviewed');
    expect(calls[1].url).toBe(calls[0].url);
    if (flow === 'upload') {
        expect(calls[1].body).toBe(calls[0].body);
        expect(calls[1].body.getAll('files')).toEqual([file]);
        expect(calls[1].body.get('scans')).toBe(JSON.stringify(h.states[5].scans));
        expect(calls[1].body.get('contextSampleId')).toBe('same-sample');
    } else {
        expect({ ...calls[1].body, reopenReason: undefined }).toEqual(calls[0].body);
        if (flow === 'staged') expect(calls[1].body.manifestId).toBe('same-manifest');
        else expect(calls[1].body.ids).toEqual(['scan-a', 'scan-b']);
    }
});

test('partial staged receipts show the failures and retain the manifest for an operator-controlled retry', async () => {
    const axios = { post: jest.fn().mockResolvedValue({ data: { success: 0, failed: 1, complete: false,
        manifestId: 'retained-manifest', errors: [{ filename: 'failed-entry.csv', error: 'Concurrent completion requires review' }] } }) };
    const h = host('components/workbench/SpectralIntakeModal.jsx', axios), props = { isOpen: true };
    h.render(props); h.states[0] = 3; h.states[6] = 'retained-manifest'; h.states[10] = true;
    const button = elements(h.render(props), node => node.type === 'button' && node.props.onClick?.name === 'handleExecuteCommit')[0];
    await button.props.onClick(); expect(axios.post).toHaveBeenCalledTimes(1); expect(h.showDialog).not.toHaveBeenCalled();
    const tree = h.render(props);
    expect(elements(tree, node => node.type === 'li').map(node => node.props.children.flat().join(''))).toContain('failed-entry.csv: Concurrent completion requires review');
    elements(tree, node => node.type === 'button' && node.props.children === 'spectralWorkflow.retryFailed')[0].props.onClick();
    expect(h.states[0]).toBe(3); expect(h.states[6]).toBe('retained-manifest'); expect(axios.post).toHaveBeenCalledTimes(1);
});
