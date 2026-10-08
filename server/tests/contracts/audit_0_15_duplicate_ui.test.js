const { nativeHost, nativeFixture, enter, nodes, content } = require('../helpers/qcWorksheetUi');

// Obsolete profile input cases migrated under Claude's #188 pin 6052289128.
describe('Audit 0.15: native worksheet censored duplicate entry', () => {
    test.each([[' <loq', '≤0,05 '], ['>100', '100'], ['<0.1', '0.05']])('observations %s / %s reach preview and evaluation verbatim', async (first, second) => {
        const view = nativeHost(); await view.render();
        const serverParse = { qualifier: '<', numericValue: null, censoringLimit: 0.05 };
        view.axios.post.mockResolvedValueOnce({ data: { preview: true, analytes: [{ analysisCode: 'A', verdict: 'INCOMPLETE', positions: [{ positionId: 'parent-0', parsedObservation: serverParse }] }] } });
        await enter(view, { blank: '0', 'control-0': '7', 'parent-0': first, 'duplicate-0': second });
        await view.find('native-value-parent-0').props.onBlur(); await view.render();
        expect(view.axios.post.mock.calls[0]).toEqual(['/api/qc/batches/worksheet-run/preview', [
            { analysisCode: 'A', positionId: 'blank', rawInput: '0' }, { analysisCode: 'A', positionId: 'control-0', rawInput: '7' },
            { analysisCode: 'A', positionId: 'parent-0', rawInput: first }, { analysisCode: 'A', positionId: 'duplicate-0', rawInput: second }
        ]]);
        expect(content(view.find('native-parsed-parent-0'))).toBe(JSON.stringify(serverParse));
        expect(view.find('native-value-parent-0').props.value).toBe(first); expect(view.find('native-value-duplicate-0').props.value).toBe(second);
        expect(view.find('native-qc-evaluate').props.disabled).toBeFalsy(); await view.find('native-qc-evaluate').props.onClick();
        expect(view.axios.post.mock.calls[1]).toEqual(['/api/qc/batches/worksheet-run/evaluate', { analysisCode: 'A', references: [], measurements: [
            { positionId: 'blank', replicateNo: 1, rawInput: '0' }, { positionId: 'control-0', replicateNo: 1, rawInput: '7' },
            { positionId: 'parent-0', replicateNo: 1, rawInput: first }, { positionId: 'duplicate-0', replicateNo: 1, rawInput: second }
        ] }]);
    });
    test.each([['<0.1', '7', '<0.1'], ['<bad', '7', '0'], ['', '7', '0']])('server rejection blocks invalid observations (%s / %s / %s)', async (first, second, blank) => {
        const view = nativeHost(); await view.render(); await enter(view, { blank, 'control-0': '7', 'parent-0': first, 'duplicate-0': second });
        view.axios.post.mockRejectedValueOnce({ response: { data: { code: 'QC_VALUES_MISSING', error: 'Invalid observation' } } });
        await view.find('native-value-duplicate-0').props.onBlur(); await view.render();
        expect(content(view.find('native-qc-preview-error'))).toBe('qcRuns.errors.QC_VALUES_MISSING');
        expect(view.find('native-qc-evaluate').props.disabled).toBe(true); await view.find('native-qc-evaluate').props.onClick();
        expect(view.axios.post).toHaveBeenCalledTimes(1); expect(view.axios.post.mock.calls[0][0]).toBe('/api/qc/batches/worksheet-run/preview');
        expect(view.axios.put).not.toHaveBeenCalled();
    });
    test.each(['parent-0', 'parent-1'])('duplicate uses only server parent %s without a chooser or Result copy', async parentId => {
        const batch = nativeFixture({ duplicates: 2 }); batch.positions = batch.positions.filter(row => row.id !== 'duplicate-1');
        batch.positions.find(row => row.id === 'duplicate-0').duplicateOfPositionId = parentId; batch.analytes[0].positions = batch.positions;
        batch.analytes[0].criteriaSnapshot = JSON.stringify({ requiredPositions: { BLANK: ['blank'], LRM: ['control-0'], DUPLICATE: ['duplicate-0'] } });
        batch.workItems.forEach(item => { item.draft = { value: '99.999999' }; });
        const view = nativeHost(batch); await view.render(); expect(view.find('native-value-' + parentId).props.value).toBe('');
        expect(view.find('native-value-' + (parentId === 'parent-0' ? 'parent-1' : 'parent-0'))).toBeUndefined();
        expect(nodes(view.find('native-run-sequence')).some(node => node.type === 'select')).toBe(false);
        expect(view.text()).toContain('CODE-' + parentId.at(-1)); expect(view.text()).not.toContain('99.999999');
        await enter(view, { blank: '0', 'control-0': '7', [parentId]: '7.123456789', 'duplicate-0': '7.123456780' });
        await view.find('native-qc-evaluate').props.onClick(); expect(view.axios.post).toHaveBeenCalledTimes(1);
        const measurements = view.axios.post.mock.calls[0][1].measurements;
        expect(measurements).toContainEqual({ positionId: parentId, replicateNo: 1, rawInput: '7.123456789' });
        expect(measurements).toContainEqual({ positionId: 'duplicate-0', replicateNo: 1, rawInput: '7.123456780' });
        expect(measurements.every(row => Object.keys(row).sort().join(',') === 'positionId,rawInput,replicateNo')).toBe(true);
    });
});
