const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const moduleObject = { exports: {} };
vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.resolve(__dirname,
    '../../../client/src/components/workbench/qcWorksheetNavigation.js'), 'utf8'), { loader: 'js', format: 'cjs' }).code,
{ module: moduleObject, exports: moduleObject.exports });
const { runWorksheetRows, advanceWorksheetCell } = moduleObject.exports;

test('run rows retain every server position in sequence and attach Result drafts by work-item link only', () => {
    const positions = [
        { id: 'blank', position: 1, kind: 'BLANK' },
        { id: 'sample', position: 2, kind: 'SAMPLE', sampleId: 'same-sample',
            workItems: [{ workItemId: 'owned-a', analysisCode: 'A' }, { workItemId: 'owned-b', analysisCode: 'B' }] },
        { id: 'dup', position: 3, kind: 'DUPLICATE', sampleId: 'same-sample', duplicateOfPositionId: 'sample' },
        { id: 'check', position: 4, kind: 'CCV' }
    ];
    const items = [{ workItemId: 'another-run', sampleId: 'same-sample', draft: { value: 'do not copy' } },
        { workItemId: 'owned-a', sampleId: 'same-sample', draft: { value: '6.23' } },
        { workItemId: 'owned-b', sampleId: 'same-sample', draft: { value: '91' } }];
    const rows = runWorksheetRows(positions, items, 'A');
    expect(rows.map(row => row.position.id)).toEqual(['blank', 'sample', 'dup', 'check']);
    expect(rows[1].item).toBe(items[1]);
    expect(rows.filter(row => row.item)).toHaveLength(1);
    expect(runWorksheetRows(positions, items, 'B')[1].item).toBe(items[2]);
    expect(runWorksheetRows(positions, items.slice(0, 1), 'A')[1].item).toBeNull();
    expect(positions[1]).not.toHaveProperty('qcParentObservation');
});

function keyboardFixture() {
    const cell = (name, overrides = {}) => ({ name, type: 'text', disabled: false, readOnly: false, tabIndex: 0,
        focus: jest.fn(), ...overrides });
    const sample = cell('sample-result'), parent = cell('qc-parent'), blank = cell('blank'), duplicate = cell('duplicate');
    const checkbox = cell('selection', { type: 'checkbox' }), recorded = cell('recorded', { readOnly: true }), blocked = cell('blocked', { disabled: true });
    const setup = cell('reference-selector'), review = { focus: jest.fn() };
    const table = { querySelectorAll: jest.fn(() => [checkbox, sample, parent, recorded, blank, blocked, duplicate]) };
    const event = (target, key, shiftKey = false) => ({ currentTarget: table, target, key, shiftKey,
        preventDefault: jest.fn(), stopPropagation: jest.fn() });
    return { sample, parent, blank, duplicate, setup, review, table, event };
}

test.each(['Enter', 'Tab'])('%s advances through Result, separate QC parent, blank and duplicate cells', key => {
    const f = keyboardFixture();
    for (const [from, to] of [[f.sample, f.parent], [f.parent, f.blank], [f.blank, f.duplicate]]) {
        const event = f.event(from, key); advanceWorksheetCell(event, f.review);
        expect(to.focus).toHaveBeenCalledTimes(1);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    }
    advanceWorksheetCell(f.event(f.duplicate, key), f.review);
    expect(f.review.focus).toHaveBeenCalledTimes(1);
    expect(f.setup.focus).not.toHaveBeenCalled();
    expect(f.table.querySelectorAll).toHaveBeenCalledWith('input, textarea');
});

test('reverse grid navigation and modified keys never jump into run setup', () => {
    const f = keyboardFixture();
    advanceWorksheetCell(f.event(f.blank, 'Tab', true), f.review);
    expect(f.parent.focus).toHaveBeenCalledTimes(1);
    advanceWorksheetCell(f.event(f.sample, 'Tab', true), f.review);
    expect(f.duplicate.focus).not.toHaveBeenCalled();
    expect(f.review.focus).not.toHaveBeenCalled();
    const shortcut = { ...f.event(f.sample, 'Enter'), ctrlKey: true };
    advanceWorksheetCell(shortcut, f.review);
    expect(shortcut.preventDefault).not.toHaveBeenCalled();
    expect(f.setup.focus).not.toHaveBeenCalled();
});
