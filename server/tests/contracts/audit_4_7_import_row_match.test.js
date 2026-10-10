const { matchInstrumentRow: match } = require('../../services/instrumentImportRowMatch');
function fixture() {
    const samples = Array.from({ length: 40 }, (_, index) => ({ id: 'internal-' + index, labSampleCode: 'LAB-' + (index + 1), originalId: 'EXT-' + (index + 1) }));
    const positions = samples.map((sample, index) => ({ id: 'position-' + (index + 1), position: index + 1,
        kind: 'SAMPLE', sampleId: sample.id, provenance: 'NATIVE', historicalSnapshotSeq: null,
        workItems: ['Ca', 'Mg', 'K', 'Na'].map(analysisCode => ({ analysisCode, workItemId: sample.id + '-' + analysisCode })) }));
    const qc = ['BLANK', 'BLANK', 'CCV', 'CCV', 'LRM', 'LRM'].map((kind, index) => ({ id: 'qc-' + index,
        position: index + 41, kind, provenance: 'NATIVE', historicalSnapshotSeq: null }));
    return { samples, batch: { positions: positions.concat(qc) }, mapping: { idColumn: 0, idType: 'LAB_SAMPLE_CODE',
        qcDetector: { positionColumn: 5, prefixes: [{ prefix: 'BLK', kind: 'BLANK' }, { prefix: 'CCV', kind: 'CCV' }, { prefix: 'LRM', kind: 'LRM' }] } } };
}
test('forty lab labels retain all four analyte destinations and six QC rows require the exact mapped physical position', () => {
    const f = fixture(), before = JSON.stringify(f);
    for (let index = 0; index < 40; index++) {
        const cells = ['  LAB-' + (index + 1) + '  ', ' 1.0000 ', '2,5000', '<0.1', '0'];
        expect(match(f.batch, f.samples, f.mapping, cells)).toEqual({ kind: 'SAMPLE', code: null, sourceId: cells[0],
            positionId: 'position-' + (index + 1), positionNumber: index + 1, sampleId: 'internal-' + index,
            workItemIdsByAnalysis: Object.fromEntries(['Ca', 'Mg', 'K', 'Na'].map(code => [code, 'internal-' + index + '-' + code])) });
        expect(cells.slice(1)).toEqual([' 1.0000 ', '2,5000', '<0.1', '0']);
    }
    for (let index = 0; index < 6; index++) {
        const prefix = ['BLK', 'BLK', 'CCV', 'CCV', 'LRM', 'LRM'][index];
        expect(match(f.batch, f.samples, f.mapping, [prefix + '-export', '0', '0', '0', '0', String(index + 41)]))
            .toMatchObject({ kind: 'QC', code: null, positionId: 'qc-' + index, positionNumber: index + 41 });
    }
    expect(JSON.stringify(f)).toBe(before);
});
test.each([['ORIGINAL_ID', 'EXT-3'], ['POSITION', '03']])('explicit %s mapping uses its own identifier authority', (idType, id) => {
    const f = fixture(); expect(match(f.batch, f.samples, { ...f.mapping, idType }, [id]))
        .toMatchObject({ kind: 'SAMPLE', positionId: 'position-3', sampleId: 'internal-2' });
});
test.each(['UNKNOWN', 'internal-0', 'EXT-1', '=1+1', 'lab-1'])('unknown %s is listed rather than guessed or imported', id => {
    const f = fixture(); expect(match(f.batch, f.samples, f.mapping, [id]))
        .toMatchObject({ kind: 'UNKNOWN', code: 'IMPORT_IDENTIFIER_UNMATCHED', sourceId: id, positionId: null });
});
test('duplicate original ids are ambiguous, and historical/duplicate positions never act as sample destinations', () => {
    const f = fixture(); f.samples[1].originalId = f.samples[0].originalId;
    expect(match(f.batch, f.samples, { ...f.mapping, idType: 'ORIGINAL_ID' }, ['EXT-1']))
        .toMatchObject({ kind: 'AMBIGUOUS', code: 'IMPORT_IDENTIFIER_AMBIGUOUS', candidatePositionIds: ['position-1', 'position-2'] });
    f.batch.positions[0].historicalSnapshotSeq = 1; f.batch.positions[1].kind = 'DUPLICATE';
    for (const id of ['LAB-1', 'LAB-2']) expect(match(f.batch, f.samples, f.mapping, [id])).toMatchObject({ kind: 'UNKNOWN', positionId: null });
});
test.each(['', '41.5', '1e2', '999', '43'])('QC kind and exact physical column are required: %j', position => {
    const f = fixture(); expect(match(f.batch, f.samples, f.mapping, ['BLK-41', '', '', '', '', position]))
        .toMatchObject({ kind: 'UNKNOWN', code: 'IMPORT_QC_POSITION_UNMATCHED', positionId: null });
});
test('overlapping QC detectors refuse ambiguity instead of choosing a prefix', () => {
    const f = fixture(); f.mapping.qcDetector.prefixes.push({ prefix: 'B', kind: 'BLANK' });
    expect(match(f.batch, f.samples, f.mapping, ['BLK-export', '', '', '', '', '41']))
        .toMatchObject({ kind: 'AMBIGUOUS', code: 'IMPORT_QC_POSITION_AMBIGUOUS', positionId: null });
});
