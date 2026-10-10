const { compareReportAmendment } = require('../../services/reportAmendmentComparison');
const row = (analysisId, basis = null, changes = {}) => ({ analysisId, basis, value: '6.125', unit: 'g/kg', decimalPlaces: 2,
    reportedValueSelectionId: 'selection', sourceResultIds: ['old-result'], attemptIds: ['old-attempt'], ...changes });
const content = items => ({ meta: { locale: 'en' }, resultGroups: [{ items }] });
const compare = (before, after) => compareReportAmendment(content(before), content(after), { predecessorReportId: 'retained-report', newReportId: 'proposed-report' });

test('exact pairs compare the frozen displayed value, unit and censoring mark', () => {
    const output = compare([row('SAME'), row('VALUE'), row('UNIT'), row('CENSOR')],
        [row('SAME'), row('VALUE', null, { value: '7.125' }), row('UNIT', null, { unit: 'mg/kg' }), row('CENSOR', null, { censoring: 'BELOW_LOQ' })]);
    expect(output.changes.map(item => [item.analysisId, item.kind])).toEqual([
        ['CENSOR', 'CHANGED'], ['SAME', 'UNCHANGED'], ['UNIT', 'CHANGED'], ['VALUE', 'CHANGED']]);
});

test('a single remaining pair records the exact old and new bases as CHANGED', () => {
    const output = compare([row('P', 'AIR_DRY')], [row('P', 'OVEN_DRY')]);
    expect(output.changes).toEqual([{ analysisId: 'P', kind: 'CHANGED', old: expect.objectContaining({ basis: 'AIR_DRY' }), new: expect.objectContaining({ basis: 'OVEN_DRY' }) }]);
});

test('ADDED and REMOVED remain listed alongside an exact pair of the same analysis under another basis', () => {
    const added = compare([row('P', 'AIR_DRY')], [row('P', 'AIR_DRY'), row('P', 'FIELD_MOIST')]);
    const removed = compare([row('P', 'AIR_DRY'), row('P', 'FIELD_MOIST')], [row('P', 'AIR_DRY')]);
    expect(added.changes.map(item => item.kind)).toEqual(expect.arrayContaining(['UNCHANGED', 'ADDED']));
    expect(removed.changes.map(item => item.kind)).toEqual(expect.arrayContaining(['UNCHANGED', 'REMOVED']));
    expect(removed.changes.find(item => item.kind === 'REMOVED')).toMatchObject({ old: { basis: 'FIELD_MOIST' }, new: null });
});

test.each([
    [[row('P', 'AIR_DRY'), row('P', 'OVEN_DRY')], [row('P', 'FIELD_MOIST')]],
    [[row('P', 'AIR_DRY')], [row('P', 'OVEN_DRY'), row('P', 'FIELD_MOIST')]],
    [[row('P', 'AIR_DRY'), row('P', 'AIR_DRY')], [row('P', 'AIR_DRY')]],
    [[row('P', 'AIR_DRY')], [row('P', 'AIR_DRY'), row('P', 'AIR_DRY')]]
])('ambiguous candidates refuse with identities and candidate bases only', (before, after) => {
    const retained = JSON.stringify([before, after]);
    expect(() => compare(before, after)).toThrow(expect.objectContaining({ statusCode: 409, code: 'REPORT_AMENDMENT_EVIDENCE_AMBIGUOUS',
        details: { analysisId: 'P', oldBases: expect.any(Array), newBases: expect.any(Array) } }));
    expect(JSON.stringify([before, after])).toBe(retained);
});

test('re-measurement with the same displayed value is unmarked and retains both source identities', () => {
    const output = compare([row('P')], [row('P', null, { value: '6.1299', sourceResultIds: ['new-result'], attemptIds: ['new-attempt'] })]);
    expect(output.changes[0]).toMatchObject({ kind: 'UNCHANGED', old: { displayText: '6.13', sourceResultIds: ['old-result'], attemptIds: ['old-attempt'] },
        new: { displayText: '6.13', sourceResultIds: ['new-result'], attemptIds: ['new-attempt'] } });
});

test('historical param is the exact stable key even if that legacy code is absent from the catalogue', () => {
    const before = row('LEGACY-UNREGISTERED'); delete before.analysisId; before.param = 'LEGACY-UNREGISTERED';
    expect(compare([before], [row('LEGACY-UNREGISTERED')]).changes[0]).toMatchObject({ analysisId: 'LEGACY-UNREGISTERED', kind: 'UNCHANGED' });
});

test('case and whitespace remain distinct keys; null basis is distinct from a named basis', () => {
    const output = compare([row('P'), row('LEGACY ')], [row('p'), row('LEGACY')]);
    expect(output.changes).toHaveLength(4); expect(output.changes.every(item => ['ADDED', 'REMOVED'].includes(item.kind))).toBe(true);
    expect(compare([row('P')], [row('P', 'AIR_DRY')]).changes[0]).toMatchObject({ kind: 'CHANGED', old: { basis: null }, new: { basis: 'AIR_DRY' } });
});

test.each([{}, { analysisId: '', param: '' }, { analysisId: 42, param: null }])('missing identity refuses and exposes report/item position without values', bad => {
    expect(() => compare([{ ...bad, value: 'PRIVATE-VALUE', unit: 'g/kg' }], [row('P')])).toThrow(expect.objectContaining({
        statusCode: 409, code: 'REPORT_AMENDMENT_EVIDENCE_INVALID', details: { reportId: 'retained-report', itemPosition: { groupIndex: 0, itemIndex: 0 } } }));
});

test('shuffled groups, rows and source identities give the same deterministic frozen comparison', () => {
    const before = [row('B', 'AIR_DRY'), row('A'), row('B', 'FIELD_MOIST')], after = [row('B', 'AIR_DRY'), row('A', null, { value: '8.000' })];
    const original = JSON.stringify([before, after]), expected = compare(before, after);
    expect(compare([...before].reverse(), [...after].reverse())).toEqual(expected);
    expect(compareReportAmendment({ resultGroups: [{ items: before.slice(0, 1) }, { items: before.slice(1) }] }, content(after))).toEqual(expected);
    expect(JSON.stringify([before, after])).toBe(original);
});
