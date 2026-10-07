const { calibrationBrackets, repeatBracketScope } = require('../../services/qcCalibrationBracketService');

function run() {
    const positions = Array.from({ length: 37 }, (_, index) => {
        const position = index + 1, kind = position === 1 ? 'ICV' : [13, 25, 37].includes(position) ? 'CCV' : 'SAMPLE';
        return { id: `p${position}`, position, kind, workItems: kind === 'SAMPLE' ? [{ workItemId: `w${position}`, analysisCode: 'A' }] : [] };
    });
    const checks = [1, 13, 25, 37].map(position => ({ positionId: `p${position}`, position,
        kind: position === 1 ? 'ICV' : 'CCV', status: position === 25 ? 'FAIL' : 'PASS', failAction: position === 1 ? 'FAIL_BATCH' : 'REPEAT_BRACKET' }));
    return { batch: { analysis: 'A' }, positions, checks };
}

test('a failed CCV at 25 with passing CCVs at 13 and 37 selects exactly samples 14–24', () => {
    const f = run(), brackets = calibrationBrackets(f.batch, 'A', f.positions, f.checks);
    expect(brackets).toHaveLength(1);
    expect(brackets[0]).toEqual({ failedPositionId: 'p25', kind: 'CCV', openingPositionId: 'p13',
        affectedPositionIds: Array.from({ length: 11 }, (_, index) => `p${index + 14}`),
        affectedWorkItemIds: Array.from({ length: 11 }, (_, index) => `w${index + 14}`), failAction: 'REPEAT_BRACKET' });
});

test('several failed brackets union samples and duplicates of affected parents, without another analyte', () => {
    const f = run(); f.checks.find(row => row.positionId === 'p37').status = 'FAIL';
    f.positions.push({ id: 'duplicate', position: 38, kind: 'DUPLICATE', duplicateOfPositionId: 'p20', workItems: [] });
    f.positions.find(row => row.id === 'p20').workItems.push({ workItemId: 'other-analyte', analysisCode: 'B' });
    const brackets = calibrationBrackets(f.batch, 'A', f.positions, f.checks);
    const evidence = { evaluation: { id: 'eval', details: JSON.stringify({ calibrationFailActionSource: 'SNAPSHOT',
        calibrationBrackets: brackets, evaluation: { controls: f.checks } }) } };
    const scope = repeatBracketScope({ provenance: 'NATIVE' }, evidence);
    expect(scope.failedPositionIds).toEqual(['p25', 'p37']);
    expect(scope.affectedWorkItemIds).toHaveLength(22);
    expect(scope.affectedWorkItemIds).not.toContain('other-analyte');
    expect(scope.affectedPositionIds).toContain('duplicate');
    expect(scope.affectedPositionIds).not.toContain('p13');
    expect(scope.affectedPositionIds).not.toContain('p25');
});

test('a failed CCB uses the bracket ending at its passing verification boundary', () => {
    const f = run(); f.checks.find(row => row.positionId === 'p25').status = 'PASS';
    f.positions.find(row => row.id === 'p26').kind = 'CCB';
    f.checks.push({ positionId: 'p26', kind: 'CCB', status: 'FAIL', failAction: 'REPEAT_BRACKET' });
    const brackets = calibrationBrackets(f.batch, 'A', f.positions, f.checks);
    expect(brackets[0]).toMatchObject({ failedPositionId: 'p26', kind: 'CCB', openingPositionId: 'p13' });
    expect(brackets[0].affectedWorkItemIds).toEqual(Array.from({ length: 11 }, (_, index) => `w${index + 14}`));
});

test.each(['PROFILE_ONLY', 'LEGACY_MIGRATED', 'NATIVE'])('legacy snapshots or non-native %s evidence never offers REPEAT_BRACKET', provenance => {
    const f = run(), evidence = { evaluation: { id: 'eval', details: JSON.stringify({ calibrationFailActionSource: 'LEGACY_SNAPSHOT_FALLBACK',
        calibrationBrackets: calibrationBrackets(f.batch, 'A', f.positions, f.checks), evaluation: { controls: f.checks } }) } };
    expect(() => repeatBracketScope({ provenance }, evidence)).toThrow(expect.objectContaining({ statusCode: 409, code: 'QC_BRACKET_REPEAT_NOT_ALLOWED' }));
});

test('a failing non-calibration check retains the full-analyte disposition requirement', () => {
    const f = run(), evidence = { evaluation: { id: 'eval', details: JSON.stringify({ calibrationFailActionSource: 'SNAPSHOT',
        calibrationBrackets: calibrationBrackets(f.batch, 'A', f.positions, f.checks),
        evaluation: { controls: f.checks, blanks: [{ positionId: 'blank', kind: 'BLANK', status: 'FAIL', failAction: 'FAIL_BATCH' }] } }) } };
    expect(() => repeatBracketScope({ provenance: 'NATIVE' }, evidence)).toThrow(expect.objectContaining({ code: 'QC_BRACKET_REPEAT_NOT_ALLOWED' }));
});
