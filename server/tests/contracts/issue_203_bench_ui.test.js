const { mountUi, content } = require('../helpers/qcWorksheetUi');

test('a browser that blocks the localStorage getter still opens with standard density', () => {
    const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
    const esbuild = require('../../../client/node_modules/esbuild');
    const module = { exports: {} };
    const context = vm.createContext({ module, exports: module.exports, require: () => ({}) });
    Object.defineProperty(context, 'localStorage', { get() { throw Error('Storage blocked'); } });
    const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/workbench/BenchDensity.jsx'), 'utf8');
    vm.runInContext(esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' }).code, context);
    expect(module.exports.readBenchDensity()).toBe('standard');
    expect(module.exports.readBenchDensity({ getItem: () => 'bench' })).toBe('bench');
});

test('bench density is a device choice and does not call a policy or analytical endpoint', async () => {
    const onChange = jest.fn();
    const view = mountUi('components/workbench/BenchDensity.jsx', { value: 'standard', onChange });
    await view.render();
    const buttons = view.all().filter(node => node.type === 'button');
    expect(buttons).toHaveLength(2);
    expect(buttons.map(node => node.props['aria-pressed'])).toEqual([true, false]);
    buttons[1].props.onClick();
    expect(onChange).toHaveBeenCalledWith('bench');
    await view.render({ value: 'bench' });
    expect(view.all().filter(node => node.type === 'button').map(node => node.props['aria-pressed'])).toEqual([false, true]);
    expect(view.axios.get).not.toHaveBeenCalled();
    expect(view.axios.post).not.toHaveBeenCalled();
});

const first = { workItemId: 'private-work-uuid-1', sampleId: 'private-sample-uuid-1', labSampleCode: 'LAB-26-001A',
    rackPosition: 2, analysis: 'EC', value: 0, displayUnit: 'dS/m', validation: { flags: ['BELOW_TYPICAL'] }, warnings: ['Check extraction'], basis: 'AIR_DRY' };
const later = { workItemId: 'private-work-uuid-2', sampleId: 'private-sample-uuid-2', labSampleCode: 'LAB-26-002B',
    rackPosition: 12, analysis: 'EC', value: 3.4, displayUnit: 'dS/m', validation: { flags: [] }, warnings: [] };

test('completion review orders positions, shows issued identities, zero with unit, and every flag and warning', async () => {
    const view = mountUi('components/workbench/ReviewCompletionView.jsx', { previewData: { included: [later, first], excluded: [] } });
    await view.render();
    const rows = view.all().filter(node => node.props?.['data-testid'] === 'bench-completion-row');
    expect(rows).toHaveLength(2);
    expect(content(rows[0])).toContain('LAB-26-001A');
    expect(content(rows[1])).toContain('LAB-26-002B');
    expect(content(rows[0])).toContain('0dS/m');
    expect(view.text()).toContain('BELOW_TYPICAL');
    expect(view.text()).toContain('Check extraction');
    expect(view.text()).not.toContain('private-sample-uuid');
    expect(view.text()).not.toContain('private-work-uuid');
});

test('excluded and unissued items expose all reasons and missing metadata instead of internal UUIDs', async () => {
    const view = mountUi('components/workbench/ReviewCompletionView.jsx', { previewData: { included: [], excluded: [{
        ...first, labSampleCode: null, displayUnit: null, rackPosition: null, reasons: ['Missing instrument', 'Run locked']
    }] } });
    await view.render();
    expect(view.text()).toContain('benchErgonomics.codeMissing');
    expect(view.text()).toContain('benchErgonomics.unitUnknown');
    expect(view.text()).toContain('Missing instrument; Run locked');
    expect(view.text()).not.toContain('private-sample-uuid');
});

test('a new preview requires fresh confirmation, and record preserves the reviewed entries', async () => {
    const onCommit = jest.fn(), previewData = { included: [first], excluded: [] };
    const view = mountUi('components/workbench/ReviewCompletionView.jsx', { previewData, onCommit });
    await view.render();
    const confirm = () => view.all().find(node => node.type === 'input' && node.props.type === 'checkbox');
    confirm().props.onChange({ target: { checked: true } });
    await view.render();
    const record = () => view.all().filter(node => node.type === 'button').at(-1);
    expect(record().props.disabled).toBe(false);
    record().props.onClick();
    expect(onCommit).toHaveBeenCalledWith([first]);
    await view.render({ previewData: { included: [later], excluded: [] } });
    expect(confirm().props.checked).toBe(false);
    expect(record().props.disabled).toBe(true);
});

test('excluded texture observations remain visible and missing values never invent a passing checklist', async () => {
    const view = mountUi('components/workbench/ReviewCompletionView.jsx', { previewData: { included: [], excluded: [
        { ...first, value: null, values: { sand: '12', silt: '23', clay: '66' }, displayUnit: '%', reasons: ['Closure failed'] },
        { ...later, value: null, values: null, checks: null, reasons: ['Missing observation'] }
    ] } });
    await view.render();
    expect(view.text()).toContain('12/23/66 %');
    expect(view.text()).toContain('Closure failed');
    expect(view.text()).toContain('benchErgonomics.unknown');
    expect(view.text()).not.toContain('3/3 checks');
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('%s has every bench ergonomics label and confirmation', locale => {
    const strings = require(`../../../client/src/translations/${locale}.json`).benchErgonomics;
    expect(Object.keys(strings).sort()).toEqual(Object.keys(require('../../../client/src/translations/en.json').benchErgonomics).sort());
    expect(Object.values(strings).every(value => typeof value === 'string' && value.trim())).toBe(true);
});
