const { currentAnalyteEvidence, batchApiView, readQcRun } = require('../../services/qcRunViewService');
const { randomUUID } = require('node:crypto');
function fixture() {
    const id = randomUUID(), sample = randomUUID(), duplicate = randomUUID(), blank = randomUUID();
    const batch = { id, labId: 'VIEW-FIXTURE-LAB', analysis: 'A', status: 'QC_PASS', qcResults: '{"legacy":"must not be read"}',
        workItemIds: '["legacy-id"]', disposition: '{"decision":"REJECT_BATCH"}', history: '[{"legacy":"must not be read"}]',
        analytes: [{ id: randomUUID(), batchId: id, analysisCode: 'A', provenance: 'NATIVE' }],
        positions: [{ id: sample, batchId: id, position: 1, kind: 'SAMPLE', sampleId: randomUUID(), provenance: 'NATIVE', historicalSnapshotSeq: null,
            workItems: [{ workItemId: 'real-work-item', analysisCode: 'A' }] },
            { id: duplicate, batchId: id, position: 2, kind: 'DUPLICATE', duplicateOfPositionId: sample, provenance: 'NATIVE', historicalSnapshotSeq: null, workItems: [] },
            { id: blank, batchId: id, position: 3, kind: 'BLANK', provenance: 'NATIVE', historicalSnapshotSeq: null, workItems: [] }],
        measurements: [{ id: 'sample-value', positionId: sample, analysisCode: 'A', replicateNo: 1, value: 7.123456789, rawInput: '7.123456789', supersededById: null },
            { id: 'duplicate-value', positionId: duplicate, analysisCode: 'A', replicateNo: 1, value: 7.123456780, rawInput: '7.123456780', supersededById: null },
            { id: 'blank-value', positionId: blank, analysisCode: 'A', replicateNo: 1, value: 0.0123456789, rawInput: '0.0123456789', supersededById: null }],
        evaluations: [{ id: 'eval-1', analysisCode: 'A', version: 1, verdict: 'PASS', policyVersion: 4, details: JSON.stringify({
            evaluation: { blanks: [{ id: blank, status: 'PASS' }], duplicates: [{ id: duplicate, status: 'PASS', rpd: 0 }], controls: [], overallStatus: 'QC_PASS' } }) }],
        dispositions: [], events: [{ id: randomUUID(), type: 'RUN_BUILT', at: '2026-10-07T01:00:00Z', payload: JSON.stringify({ positions: [
            { id: sample, servedAnalytes: ['A'] }, { id: duplicate, servedAnalytes: ['A'] }, { id: blank, servedAnalytes: ['A'] }] }) }] };
    return { batch, sample, duplicate, blank };
}

test('legacy API shape comes from current normalized measurements and real duplicate parent, preserving precision and frozen legacy bytes', () => {
    const { batch, sample, duplicate, blank } = fixture(), before = JSON.stringify(batch);
    const result = batchApiView(batch, { serialized: true }), qc = JSON.parse(result.qcResults);
    expect(qc.duplicates).toEqual([expect.objectContaining({ positionId: duplicate, duplicateOfPositionId: sample, value1: 7.123456789, value2: 7.123456780 })]);
    expect(qc.blanks[0]).toMatchObject({ positionId: blank, value: 0.0123456789 });
    expect(JSON.parse(result.workItemIds)).toEqual(['real-work-item']);
    expect(result.disposition).toBeNull();
    expect(JSON.stringify(batch)).toBe(before);
});

test('a correction shows only replacement values while old measurements and evaluations remain in the evidence view', () => {
    const { batch, duplicate } = fixture();
    batch.measurements[1].supersededById = 'corrected';
    batch.measurements.push({ ...batch.measurements[1], id: 'corrected', value: 8.123456789, rawInput: '8.123456789', supersededById: null, correctionReason: 'Transcription checked' });
    batch.evaluations.push({ ...batch.evaluations[0], id: 'eval-2', version: 2, verdict: 'FAIL', supersedesId: 'eval-1', details: JSON.stringify({ evaluation: {
        blanks: [], controls: [], duplicates: [{ id: duplicate, status: 'FAIL', rpd: 13 }], overallStatus: 'QC_FAIL' } }) });
    const result = batchApiView(batch);
    expect(result.qcResults.duplicates[0]).toMatchObject({ value2: 8.123456789, status: 'FAIL', rpd: 13 });
    expect(result.measurements).toHaveLength(4); expect(result.evaluations).toHaveLength(2);
    expect(result.analytes[0].evaluation.id).toBe('eval-2');
});

test('a migrated clear excludes every historical position/value, keeps real membership and exposes earlier snapshots in history', () => {
    const { batch, sample, duplicate, blank } = fixture();
    batch.analytes[0].provenance = 'LEGACY_MIGRATED';
    batch.positions.filter(row => row.id !== sample).forEach(row => { row.provenance = 'LEGACY_MIGRATED'; row.historicalSnapshotSeq = 9; });
    const event = { action: 'QC_EVIDENCE_SNAPSHOT', seq: 9, snapshot: { qcResults: { blanks: [{ value: 0.0123456789 }] }, status: 'QC_PASS' } };
    batch.evaluations = [{ id: 'historical', analysisCode: 'A', version: 1, details: JSON.stringify({ legacy: true, positionIds: [duplicate, blank], measurementIds: ['blank-value', 'duplicate-value'] }),
        legacySource: JSON.stringify({ seq: 9, source: 'AUDIT_LOG', historyIndex: 1, auditRow: { details: JSON.stringify(event) } }) },
        { id: 'cleared', analysisCode: 'A', version: 2, verdict: 'INCOMPLETE', supersedesId: 'historical', details: JSON.stringify({ legacy: true, reason: 'LEGACY_CLEARED', positionIds: [], measurementIds: [], disposition: null }), legacySource: JSON.stringify({ seq: null, source: 'CURRENT_ROWS' }) }];
    batch.events = [{ id: randomUUID(), type: 'REOPENED', at: null, payload: JSON.stringify({ legacy: true, historyIndex: 2, event: { status: 'OPEN', changedBy: 'recorded-actor' } }) }];
    const result = batchApiView(batch);
    expect(result.qcResults).toBeNull(); expect(result.qcItems).toEqual([]);
    expect(result.positions.map(row => row.id)).toEqual([sample]);
    expect(result.analytes[0].measurements).toEqual([]);
    expect(result.measurements).toHaveLength(3); expect(result.evaluations).toHaveLength(2);
    expect(result.history).toEqual([event, { status: 'OPEN', changedBy: 'recorded-actor' }]);
});

test('legacy parentless pairs use the two recorded replicates and preserve censoring without a measured number', () => {
    const { batch, duplicate } = fixture();
    batch.positions = [{ id: duplicate, position: 1, kind: 'DUPLICATE', provenance: 'LEGACY_MIGRATED', historicalSnapshotSeq: null, duplicateOfPositionId: null,
        legacySource: JSON.stringify({ entry: { status: 'PASS' } }) }];
    batch.measurements = [{ id: 'one', positionId: duplicate, analysisCode: 'A', replicateNo: 1, value: null, rawInput: '<LOQ', censoring: '<', censoringLimit: 0.2 },
        { id: 'two', positionId: duplicate, analysisCode: 'A', replicateNo: 2, value: null, rawInput: '<0.5', censoring: '<', censoringLimit: 0.5 }];
    batch.evaluations[0].details = JSON.stringify({ legacy: true, positionIds: [duplicate], measurementIds: ['one', 'two'] });
    const result = currentAnalyteEvidence(batch);
    expect(result.qcResults.duplicates[0]).toMatchObject({ value1: null, value2: null, rawInput: { value1: '<LOQ', value2: '<0.5' },
        censoringLimits: [{ qualifier: '<', limit: 0.2, literalLoq: true }, { qualifier: '<', limit: 0.5, literalLoq: false }] });
});

test('mixed-analyte views never invent values or membership for the other analyte', () => {
    const { batch, sample, duplicate, blank } = fixture();
    batch.analytes.push({ id: randomUUID(), analysisCode: 'B', provenance: 'NATIVE' });
    const bSample = randomUUID();
    batch.positions.push({ id: bSample, position: 4, kind: 'SAMPLE', provenance: 'NATIVE', historicalSnapshotSeq: null, workItems: [{ workItemId: 'b-work', analysisCode: 'B' }] });
    batch.events[0].payload = JSON.stringify({ positions: [{ id: blank, servedAnalytes: ['A', 'B'] }] });
    batch.measurements.push({ id: 'b-blank', positionId: blank, analysisCode: 'B', replicateNo: 1, value: 0.04, rawInput: '0.04' });
    const result = currentAnalyteEvidence(batch, 'B');
    expect(result.positions.map(row => row.id)).toEqual([blank, bSample]);
    expect(result.qcResults.duplicates).toEqual([]); expect(result.qcResults.blanks[0].value).toBe(0.04);
    expect(result.measurements.every(row => row.analysisCode === 'B')).toBe(true);
    expect(currentAnalyteEvidence(batch, 'A').positions.map(row => row.id)).toEqual([sample, duplicate, blank]);
});

test('reference views keep the selected immutable snapshot and display the position criterion use', () => {
    const { batch, blank } = fixture();
    const snapshot = { expected: 12.123456789, referenceUse: 'CCV', assignedValue: 12.123456789 };
    batch.positions.find(row => row.id === blank).kind = 'CCV';
    batch.positions.find(row => row.id === blank).references = [{ id: 'superseded', analysisCode: 'A', referenceSnapshot: '{"expected":999}', supersededById: 'current' },
        { id: 'current', analysisCode: 'A', referenceMaterialId: 'lot', referenceValueId: 'revision', referenceUse: 'CCV', referenceSnapshot: JSON.stringify(snapshot), supersededById: null }];
    batch.evaluations[0].details = JSON.stringify({ evaluation: { controls: [{ id: blank, status: 'PASS', criterion: 'CALIBRATION_RECOVERY' }] } });
    const control = currentAnalyteEvidence(batch).qcResults.controls[0];
    expect(control).toMatchObject({ kind: 'CCV', referenceUse: 'CCV', expected: 12.123456789, referenceValueId: 'revision', referenceSnapshot: snapshot, criterion: 'CALIBRATION_RECOVERY' });
});

test('reader enforces the existing lab scope and returns a stable missing-batch refusal', async () => {
    const { batch } = fixture(), db = { batch: { findUnique: jest.fn(async () => batch) } };
    await expect(readQcRun(db, batch.id, { role: 'LAB_MANAGER', labId: 'FOREIGN-LAB' })).rejects.toMatchObject({ statusCode: 403, code: 'QC_BATCH_SCOPE_DENIED' });
    await expect(readQcRun(db, batch.id, { role: 'LAB_MANAGER', labId: batch.labId })).resolves.toMatchObject({ id: batch.id });
    db.batch.findUnique.mockResolvedValue(null);
    await expect(readQcRun(db, batch.id, { role: 'LAB_MANAGER', labId: batch.labId })).rejects.toMatchObject({ statusCode: 404, code: 'BATCH_NOT_FOUND' });
});

test('analyte dispositions and reopen events apply only to their named analyte', () => {
    const { batch } = fixture();
    batch.dispositions = [{ id: 'a-decision', analysisCode: 'A', decision: 'ACCEPT_WITH_DEVIATION', reason: 'Reviewed A failure', decidedBy: 'manager', decidedAt: '2026-10-07T01:30:00Z' },
        { id: 'b-decision', analysisCode: 'B', decision: 'REJECT', reason: 'Reviewed B failure', decidedBy: 'manager', decidedAt: '2026-10-07T01:31:00Z' }];
    expect(currentAnalyteEvidence(batch, 'A').disposition).toMatchObject({ decision: 'PROCEED_WITH_WARNING', canonicalDecision: 'ACCEPT_WITH_DEVIATION' });
    expect(currentAnalyteEvidence(batch, 'B').disposition).toMatchObject({ decision: 'REJECT_BATCH', canonicalDecision: 'REJECT' });
    batch.events.push({ id: 'a-reopen', type: 'REOPENED', at: '2026-10-07T01:32:00Z', payload: JSON.stringify({ analysisCode: 'A', reason: 'Repeat A checks' }) });
    expect(currentAnalyteEvidence(batch, 'A').disposition).toBeNull();
    expect(currentAnalyteEvidence(batch, 'B').disposition).toMatchObject({ decision: 'REJECT_BATCH' });
});
