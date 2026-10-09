const { buildSelectionLineage } = require('../../services/reportedValueSelectionLineage');
const { automaticReportedChoice, explicitReportedChoice } = require('../../services/reportedValueChoiceContract');
const { assertReportedSelectionGroup } = require('../../services/reportedValueGroupContract');
const { calculateUsdaTexture } = require('../../utils/soilCalculations');

const item = { id: 'work', analysis: 'PH_H2O' };
const fixture = () => ({ attempts: [{ id: 'a1', workItemId: item.id, attemptNo: 1, status: 'ACCEPTED', evidenceHash: 'hash1' }],
    results: [{ id: 'r1', attemptId: 'a1', param: item.analysis, value: '6.4', unit: 'pH_units', methodologyId: 'method', censoring: 'NONE', replicateNo: 1, supersededBy: null }],
    limits: { a1: { source: 'QC_RULE', qcRuleId: 'q1', qcRuleVersion: 1, r: null, controlledUnit: 'pH_units', methodologyId: 'method', recordedAt: '2026-10-08T10:00:00Z' } } });
const lineage = data => buildSelectionLineage(data.attempts, data.results);

test.each(['MEAN_IF_WITHIN_R', 'LATEST_VALID'])('AUTO_SINGLE needs no r under %s and preserves the original string', policy => {
    const data = fixture(), before = JSON.stringify(data);
    expect(automaticReportedChoice(item, lineage(data), policy, data.limits).choice).toMatchObject({
        mode: 'ATTEMPT', rule: 'AUTO_SINGLE', attemptIds: ['a1'], outputs: [{ value: 6.4, valueText: '6.4', resultIds: ['r1'] }] });
    expect(JSON.stringify(data)).toBe(before);
});

test('a censored single value stays censored without needing r', () => {
    const data = fixture(); Object.assign(data.results[0], { value: '<0.1', censoring: 'BELOW_LOQ' });
    expect(automaticReportedChoice(item, lineage(data), 'MEAN_IF_WITHIN_R', data.limits).choice.outputs[0])
        .toMatchObject({ value: null, valueText: '<0.1', censoring: 'BELOW_LOQ' });
});

test('REVIEWER_PICKS never auto-selects even a single execution', () => {
    const data = fixture(); expect(automaticReportedChoice(item, lineage(data), 'REVIEWER_PICKS', data.limits))
        .toEqual({ choice: null, reasons: ['REVIEWER_PICKS'] });
    expect(explicitReportedChoice(item, lineage(data), { mode: 'ATTEMPT', attemptIds: ['a1'] }, data.limits).rule).toBe('REVIEWER');
});

test('a duplicate execution without r requires a choice, while NOT_REPORTABLE can retain its reason', () => {
    const data = fixture(); data.results.push({ ...data.results[0], id: 'r2', replicateNo: 2, value: '6.5' });
    expect(automaticReportedChoice(item, lineage(data), 'MEAN_IF_WITHIN_R', data.limits)).toEqual({ choice: null, reasons: ['REPORTED_VALUE_LIMIT_MISSING'] });
    expect(() => explicitReportedChoice(item, lineage(data), { mode: 'ATTEMPT', attemptIds: ['a1'] }, data.limits)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_LIMIT_MISSING' }));
    expect(explicitReportedChoice(item, lineage(data), { mode: 'NOT_REPORTABLE', reason: 'Duplicate agreement cannot be assessed' }, data.limits))
        .toMatchObject({ attemptIds: [], rule: 'REVIEWER', reason: 'Duplicate agreement cannot be assessed', outputs: [{ value: null, valueText: '' }] });
});

function addAttempt(data, status = 'ACCEPTED', value = '6.6') {
    data.attempts.push({ ...data.attempts[0], id: 'a2', attemptNo: 2, status, evidenceHash: 'hash2' });
    data.results.push({ ...data.results[0], id: 'r2', attemptId: 'a2', value });
    data.limits.a2 = { ...data.limits.a1, recordedAt: '2026-10-08T12:00:00Z' };
}

test('an INVALIDATED6.1 is excluded and the accepted6.4 is labelled AUTO_LATEST_AFTER_INVALIDATION', () => {
    const data = fixture(); data.attempts[0].status = 'INVALIDATED'; data.results[0].value = '6.1'; addAttempt(data, 'ACCEPTED', '6.4');
    expect(automaticReportedChoice(item, lineage(data), 'MEAN_IF_WITHIN_R', data.limits).choice)
        .toMatchObject({ rule: 'AUTO_LATEST_AFTER_INVALIDATION', attemptIds: ['a2'], outputs: [{ valueText: '6.4' }] });
    expect(() => explicitReportedChoice(item, lineage(data), { mode: 'ATTEMPT', attemptIds: ['a1'] }, data.limits)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_SELECTION_INVALID' }));
});

test('LATEST_VALID follows recording time even when request time or attempt number orders differently', () => {
    const data = fixture(); addAttempt(data); data.attempts[0].createdAt = '2026-10-08T15:00:00Z';
    data.limits.a1.recordedAt = '2026-10-08T13:00:00Z';
    expect(automaticReportedChoice(item, lineage(data), 'LATEST_VALID', data.limits).choice)
        .toMatchObject({ rule: 'AUTO_LATEST_VALID', attemptIds: ['a1'] });
});

test.each(['equal', 'missing'])('%s recording times need a reviewer choice', kind => {
    const data = fixture(); addAttempt(data); data.limits.a2.recordedAt = kind === 'equal' ? data.limits.a1.recordedAt : null;
    expect(automaticReportedChoice(item, lineage(data), 'LATEST_VALID', data.limits)).toEqual({ choice: null, reasons: ['RECORDING_TIME_AMBIGUOUS'] });
});

test('a QUESTIONED parent can be chosen unchanged, and prevents an automatic latest-value shortcut', () => {
    const data = fixture(); data.attempts[0].status = 'QUESTIONED'; data.results[0].isCurrent = false; addAttempt(data);
    data.results[0].supersededBy = 'r2';
    expect(automaticReportedChoice(item, lineage(data), 'LATEST_VALID', data.limits)).toEqual({ choice: null, reasons: ['QUESTIONED_ORIGINAL'] });
    expect(explicitReportedChoice(item, lineage(data), { mode: 'ATTEMPT', attemptIds: ['a1'] }, data.limits).outputs[0].valueText).toBe('6.4');
});

const textureItem = { id: 'texture-work', analysis: 'TEXTURE' };
function textureFixture() {
    const data = fixture(); data.attempts[0].workItemId = textureItem.id;
    data.results = [['SAND', '60'], ['SILT', '20'], ['CLAY', '20'], ['TEXTURE', 'Retained issued classification']].map(([param, value]) => ({
        ...fixture().results[0], id: param+'-1', param, value, unit: param === 'TEXTURE' ? null : '%'
    }));
    data.limits.a1.controlledUnit = '%'; return data;
}

test('a single composite execution gives four outputs with one linked AUTO_SINGLE choice and no r', () => {
    const data = textureFixture(), choice = automaticReportedChoice(textureItem, lineage(data), 'MEAN_IF_WITHIN_R', data.limits).choice;
    expect(choice).toMatchObject({ rule: 'AUTO_SINGLE', attemptIds: ['a1'] });
    expect(choice.outputs.map(row => row.analysisCode)).toEqual(['CLAY','SAND','SILT','TEXTURE']);
    expect(choice.outputs.find(row => row.analysisCode === 'TEXTURE').valueText).toBe('Retained issued classification');
});

function addTextureRepeat(data) {
    data.attempts[0].status = 'QUESTIONED';
    data.attempts.push({ ...data.attempts[0], id: 'a2', attemptNo: 2, status: 'ACCEPTED', evidenceHash: 'hash2' });
    for (const row of [...data.results]) {
        data.results.push({ ...row, id: row.param+'-2', attemptId: 'a2',
            value: row.param === 'SAND' ? '58' : row.param === 'SILT' ? '22' : row.param === 'TEXTURE' ? 'A different stored class' : row.value });
        row.isCurrent = false; row.supersededBy = row.param+'-2';
    }
    data.limits.a1.r = 2; data.limits.a2 = { ...data.limits.a1, recordedAt: '2026-10-08T12:00:00Z' };
}

test('a reviewer chooses all four QUESTIONED outputs from the same attempt without mixing the child', () => {
    const data = textureFixture(); addTextureRepeat(data);
    const choice = explicitReportedChoice(textureItem, lineage(data), { mode: 'ATTEMPT', attemptIds: ['a1'] }, data.limits);
    expect(choice.outputs.every(row => row.resultIds[0].endsWith('-1'))).toBe(true);
    expect(choice.outputs.find(row => row.analysisCode === 'TEXTURE').valueText).toBe('Retained issued classification');
});

test('a texture mean averages each fraction and derives its class using the actual server authority', () => {
    const data = textureFixture(); addTextureRepeat(data); const before = JSON.stringify(data);
    const choice = explicitReportedChoice(textureItem, lineage(data), { mode: 'MEAN', attemptIds: ['a1','a2'] }, data.limits);
    expect(choice.outputs.find(row => row.analysisCode === 'SAND').value).toBe(59);
    expect(choice.outputs.find(row => row.analysisCode === 'SILT').value).toBe(21);
    const classification = choice.outputs.find(row => row.analysisCode === 'TEXTURE');
    expect(classification).toMatchObject({ valueText: calculateUsdaTexture(59,21,20).className, derivation: 'calculateUsdaTexture' });
    expect(classification.resultIds.sort()).toEqual(['CLAY-1','CLAY-2','SAND-1','SAND-2','SILT-1','SILT-2']);
    expect(JSON.stringify(data)).toBe(before);
});

test('one texture fraction outside r refuses the whole choice', () => {
    const data = textureFixture(); addTextureRepeat(data); data.limits.a1.r = 1; data.limits.a2.r = 1;
    expect(() => explicitReportedChoice(textureItem, lineage(data), { mode: 'MEAN', attemptIds: ['a1','a2'] }, data.limits)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_OUTSIDE_LIMIT' }));
});

test('an incomplete composite replicate set cannot drop a fraction or select one replicate', () => {
    const data = textureFixture(); data.results.pop();
    expect(() => explicitReportedChoice(textureItem, lineage(data), { mode: 'ATTEMPT', attemptIds: ['a1'] }, data.limits)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_SELECTION_INVALID' }));
});

test('categorical outputs without a server derivation cannot be averaged', () => {
    const data = fixture(); data.results[0].value = 'Class A'; addAttempt(data, 'ACCEPTED', 'Class B');
    data.limits.a1.r = 1; data.limits.a2.r = 1;
    expect(() => explicitReportedChoice(item, lineage(data), { mode: 'MEAN', attemptIds: ['a1','a2'] }, data.limits)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_NON_NUMERIC_MEAN' }));
});

test('a missing or independently changed group member is stale while a full group preserves the selection', () => {
    const data = textureFixture(), snapshot = JSON.stringify(lineage(data).snapshot), params = ['CLAY','SAND','SILT','TEXTURE'];
    const rows = params.map(analysisCode => ({ analysisCode, workItemId: textureItem.id, selectionGroupId: 'group',
        mode: 'ATTEMPT', attemptIds: '["a1"]', rule: 'AUTO_SINGLE', policyKey: 'results.reportedValueRule', policyRule: 'MEAN_IF_WITHIN_R',
        policyVersion: 1, qcRuleSnapshot: '[]', evidenceSnapshot: '{}', lineageSnapshot: snapshot, outputParams: JSON.stringify(params),
        reason: null, selectedBy: 'reviewer', selectedAt: new Date('2026-10-08T13:00:00Z'), backfill: false }));
    expect(assertReportedSelectionGroup(rows, params, data.attempts, data.results)).toBe(rows);
    expect(() => assertReportedSelectionGroup(rows.slice(1), params, data.attempts, data.results)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_STALE' }));
    const changed = rows.map(row => ({ ...row })); changed[0].attemptIds = '["a2"]';
    expect(() => assertReportedSelectionGroup(changed, params, data.attempts, data.results)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_STALE' }));
});
