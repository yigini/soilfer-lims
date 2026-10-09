const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const { JSDOM } = require('jsdom');
const { mountUi, nativeHost, nativeFixture } = require('../helpers/qcWorksheetUi');
const moduleObject = { exports: {} };
vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.resolve(__dirname,
    '../../../client/src/components/workbench/qcWorksheetNavigation.js'), 'utf8'), { format: 'cjs' }).code,
{ module: moduleObject, exports: moduleObject.exports });
const { advanceWorksheetCell } = moduleObject.exports;
const item = (id, extra = {}) => ({ workItemId: id, sampleId: id, sampleDisplayId: id, status: 'IN_PROGRESS',
    readiness: { isReady: true, blockers: [] }, numberFormat: { decimal: '.', thousands: null }, ...extra });

function grid() {
    const dom = new JSDOM(`<table><tbody>
      <tr><td><input id="check" type="checkbox" tabindex="-1"></td><td><input id="a0"><input id="a1"></td><td><button tabindex="-1">Inspect</button></td></tr>
      <tr><td><input id="b0" disabled><input id="b1"></td></tr>
      <tr><td><input id="c0" readonly><input id="c1" tabindex="-1"></td></tr>
      <tr><td><input id="d0"><input id="d1"></td></tr>
    </tbody></table><button id="record">Record all ready</button>`);
    const doc = dom.window.document;
    return { doc, close: () => dom.window.close(), move(from, key, extras = {}) {
        const target = doc.getElementById(from); target.focus();
        const event = { target, currentTarget: doc.querySelector('table'), key, preventDefault: jest.fn(), stopPropagation: jest.fn(), ...extras };
        advanceWorksheetCell(event, doc.getElementById('record'));
        return { focused: doc.activeElement.id, event };
    } };
}

test.each([
    ['a0', 'Enter', {}, 'd0'], ['a1', 'ArrowDown', {}, 'b1'], ['b1', 'ArrowDown', {}, 'd1'],
    ['d1', 'ArrowUp', {}, 'b1'], ['d0', 'Enter', { shiftKey: true }, 'a0'],
    ['a1', 'Enter', { code: 'NumpadEnter' }, 'b1'], ['a0', 'Tab', {}, 'a1'], ['a1', 'Tab', {}, 'b1'],
    ['d0', 'Tab', { shiftKey: true }, 'b1'], ['a0', 'Tab', { shiftKey: true }, 'a0'],
    ['d1', 'Tab', {}, 'record'], ['d0', 'Enter', {}, 'record']
])('real DOM %s + %s stays in the correct eligible row/column', (from, key, extras, expected) => {
    const g = grid(); try {
        const result = g.move(from, key, extras);
        expect(result.focused).toBe(expected); expect(result.event.preventDefault).toHaveBeenCalledTimes(1);
        expect(result.event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(['check', 'c0', 'c1', 'b0']).not.toContain(result.focused);
    } finally { g.close(); }
});

test('modified keys and non-editor targets retain their existing behavior', () => {
    const g = grid(); try {
        expect(g.move('a0', 'Enter', { ctrlKey: true }).event.preventDefault).not.toHaveBeenCalled();
        expect(g.move('check', 'Tab').event.preventDefault).not.toHaveBeenCalled();
    } finally { g.close(); }
});

test('valid changed Result drafts become ready automatically; invalid, cleared, unchanged and ineligible rows do not', async () => {
    const rows = [item('valid', { draft: { value: '6.25' } }), item('invalid', { draft: { value: 'abc' } }),
        item('empty', { draft: { value: '' } }), item('same', { currentResult: '6', draft: { value: '6.00' } }),
        item('held', { draft: { value: '6' }, readiness: { isReady: false, blockers: ['SAMPLE_ON_HOLD'] } }),
        item('locked', { draft: { value: '6' }, readiness: { isReady: false, blockers: ['QC_BATCH_LOCKED'] } }),
        item('committed', { status: 'COMPLETED', draft: { value: '6' } })];
    const record = jest.fn(), props = { activeGroup: { analysis: 'PH_H2O', items: rows }, onDraftChange: jest.fn(), onReviewRecord: record };
    const view = mountUi('components/workbench/WorksheetArea.jsx', props); await view.render();
    expect(view.find('record-all-ready').props['aria-disabled']).toBe(false);
    view.find('record-all-ready').props.onClick(); expect(record).toHaveBeenCalledWith(['valid']);
    expect(view.all().filter(node => node.type === 'input' && node.props.type === 'checkbox').every(node => node.props.tabIndex === -1)).toBe(true);
    const editor = view.all().find(node => node.type === view.children['./NumericEditor']);
    rows[0].draft.value = 'bad'; editor.props.onChange('bad'); await view.render();
    expect(view.find('record-all-ready').props['aria-disabled']).toBe(true);
    rows[0].draft.value = ''; await view.render(); expect(view.find('record-all-ready').props['aria-disabled']).toBe(true);
    const denied = mountUi('components/workbench/WorksheetArea.jsx', props, { canEdit: false });
    rows[0].draft.value = '7'; await denied.render(); expect(denied.find('record-all-ready').props['aria-disabled']).toBe(true);
});

test('mouse exclusion lasts until the next draft change; Record all ready uses the existing callback', async () => {
    const row = item('one', { draft: { value: '6.2' } }), record = jest.fn(), change = jest.fn();
    const view = mountUi('components/workbench/WorksheetArea.jsx', { activeGroup: { analysis: 'PH_H2O', items: [row] }, onDraftChange: change, onReviewRecord: record });
    await view.render();
    view.all().find(node => node.type === 'input' && node.props['aria-label'] === 'Select one').props.onChange();
    await view.render(); expect(view.find('record-all-ready').props['aria-disabled']).toBe(true);
    const editor = view.all().find(node => node.type === view.children['./NumericEditor']);
    row.draft.value = '6.3'; editor.props.onChange('6.3'); await view.render();
    view.find('record-all-ready').props.onClick(); expect(record).toHaveBeenCalledWith(['one']); expect(change).toHaveBeenCalledWith('one', '6.3');
    expect(view.axios.post).not.toHaveBeenCalled();
});

test('native QC observations are not counted or sent by Record all ready', async () => {
    const batch = nativeFixture(), rows = [item('wi-0', { draft: { value: '6.4' } })], record = jest.fn();
    const view = mountUi('components/workbench/WorksheetArea.jsx', { activeGroup: { analysis: 'A', items: rows }, onDraftChange: jest.fn(), onReviewRecord: record },
        { responses: { '/api/qc/batches': [batch], '/api/qc/batches/worksheet-run': batch } });
    await view.render(); view.find('worksheet-run-select').props.onChange({ target: { value: batch.id } }); await view.render();
    const native = nativeHost(batch, view.all().find(node => node.type === view.children['./NativeRunPanel']).props); await native.render();
    native.find('native-value-parent-0').props.onChange({ target: { value: '7' } }); await native.render();
    native.find('record-all-ready').props.onClick(); expect(record).toHaveBeenCalledWith(['wi-0']);
    expect(native.axios.post).not.toHaveBeenCalled(); expect(native.axios.put).not.toHaveBeenCalled();
});

test('numeric Escape restores the focus-time draft through the client-only callback and stops propagation only on a change', async () => {
    const change = jest.fn(), restore = jest.fn();
    const view = mountUi('components/workbench/NumericEditor.jsx', { value: '6.2', onChange: change, onRevertValue: restore });
    await view.render(); let input = view.all().find(node => node.type === 'input');
    input.props.onFocus({ currentTarget: { value: '6.2' } });
    await view.render({ value: '7' }); input = view.all().find(node => node.type === 'input');
    const event = { key: 'Escape', currentTarget: { value: '7' }, preventDefault: jest.fn(), stopPropagation: jest.fn() };
    input.props.onKeyDown(event); expect(restore).toHaveBeenCalledWith('6.2'); expect(change).not.toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalledTimes(1); expect(view.axios.post).not.toHaveBeenCalled();
    const unchanged = { ...event, currentTarget: { value: '6.2' }, stopPropagation: jest.fn(), preventDefault: jest.fn() };
    input.props.onKeyDown(unchanged); expect(unchanged.stopPropagation).not.toHaveBeenCalled();
});

test('QC Escape restores its focus-time observation without a preview, save or evaluation', async () => {
    const view = nativeHost(); await view.render(); let input = view.find('native-value-parent-0');
    input.props.onChange({ target: { value: '6.2' } }); await view.render(); input = view.find('native-value-parent-0');
    input.props.onFocus({ currentTarget: { value: '6.2' } }); input.props.onChange({ target: { value: '7' } }); await view.render();
    input = view.find('native-value-parent-0'); input.props.onKeyDown({ key: 'Escape', currentTarget: { value: '7' }, preventDefault: jest.fn(), stopPropagation: jest.fn() });
    await view.render(); expect(view.find('native-value-parent-0').props.value).toBe('6.2');
    expect(view.axios.post).not.toHaveBeenCalled(); expect(view.axios.put).not.toHaveBeenCalled();
});

test('texture Escape restores only the focused fraction and recomputes policy-driven readiness', async () => {
    const restore = jest.fn(), change = jest.fn();
    const view = mountUi('components/workbench/TextureEditor.jsx', { values: { sand: '40', silt: '40', clay: '20' },
        tolerance: 0.5, numberFormat: { decimal: '.', thousands: null }, onChange: change, onRevertValues: restore });
    await view.render(); let inputs = view.all().filter(node => node.type === 'input');
    inputs[0].props.onFocus({ currentTarget: { value: '40' } });
    await view.render({ values: { sand: '50', silt: '40', clay: '20' } }); inputs = view.all().filter(node => node.type === 'input');
    inputs[0].props.onKeyDown({ key: 'Escape', currentTarget: { value: '50' }, preventDefault: jest.fn(), stopPropagation: jest.fn() });
    expect(restore).toHaveBeenCalledWith({ sand: '40', silt: '40', clay: '20' }); expect(change).not.toHaveBeenCalled();
    expect(view.axios.post).not.toHaveBeenCalled();
    const row = item('texture', { editorKind: 'TEXTURE', draft: { values: { sand: '40', silt: '40', clay: '20' } } });
    const ready = mountUi('components/workbench/WorksheetArea.jsx', { activeGroup: { analysis: 'TEXTURE', validation: { tolerance: 0.5 }, items: [row] }, onReviewRecord: jest.fn() });
    await ready.render(); expect(ready.find('record-all-ready').props['aria-disabled']).toBe(false);
    row.draft.values.sand = '50'; await ready.render(); expect(ready.find('record-all-ready').props['aria-disabled']).toBe(true);
    row.draft.values.sand = ''; await ready.render(); expect(ready.find('record-all-ready').props['aria-disabled']).toBe(true);
});

test('restoring the committed scalar value immediately removes the Result from the ready count', async () => {
    const row = item('revert', { currentResult: '6.2', draft: { value: '7' } });
    const view = mountUi('components/workbench/WorksheetArea.jsx', { activeGroup: { analysis: 'PH_H2O', items: [row] },
        onRevertDraft: (id, value) => { row.draft.value = value; }, onReviewRecord: jest.fn() });
    await view.render(); expect(view.find('record-all-ready').props['aria-disabled']).toBe(false);
    view.all().find(node => node.type === view.children['./NumericEditor']).props.onRevertValue('6.2');
    await view.render(); expect(view.find('record-all-ready').props['aria-disabled']).toBe(true);
});

test('locale parsing and all five translated primary actions retain the existing number rules', async () => {
    const row = item('comma', { draft: { value: '6,82' }, numberFormat: { decimal: ',', thousands: null } }), record = jest.fn();
    const view = mountUi('components/workbench/WorksheetArea.jsx', { activeGroup: { analysis: 'PH_H2O', items: [row] }, onReviewRecord: record });
    await view.render(); view.find('record-all-ready').props.onClick(); expect(record).toHaveBeenCalledWith(['comma']);
    for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        const translated = require(`../../../client/src/translations/${locale}.json`).keyboardGrid;
        expect(translated.recordAllReady).toContain('{count}'); expect(translated.readyHint).toContain('{count}');
    }
});
