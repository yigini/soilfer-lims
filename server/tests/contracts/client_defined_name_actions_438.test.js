const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const parser = require('@babel/parser');
const read = file => fs.readFileSync(path.resolve(__dirname, '../../../client/src/pages', file), 'utf8');
function locate(source, predicate) {
    const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }), matches = [];
    function visit(node) { if (!node || typeof node !== 'object') return; if (predicate(node)) matches.push(node);
        for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value?.type) visit(value); }
    visit(ast); expect(matches).toHaveLength(1); return source.slice(matches[0].start, matches[0].end);
}
test.each(['RECEIVE', 'ACCEPT_INTAKE', 'RELEASE_REPORT'])('sample next action %s executes its existing route or report confirmation', async action => {
    const source = read('SampleDetail.jsx');
    const click = locate(source, node => node.type === 'ArrowFunctionExpression' && node.body.body?.[0]?.type === 'IfStatement' && source.slice(node.body.body[0].test.start, node.body.body[0].test.end).includes("nextAction.action === 'RECEIVE'"));
    const generate = locate(source, node => node.type === 'VariableDeclarator' && node.id.name === 'handleGenerateReport');
    const context = { nextAction: { action }, sample: { id: 'sample /1' }, id: 'sample /1', token: null,
        navigate: jest.fn(), setActiveTab: jest.fn(), requestConfirmation: jest.fn(), showInfo: jest.fn(), fetchWorkspaceData: jest.fn(),
        setExistingReport: jest.fn(), setReportModal: jest.fn(), t: key => key,
        axios: { post: jest.fn(async () => ({ data: { id: 'report-1', version: 1 } })), get: jest.fn(async () => ({ data: { id: 'report-1', body: 'fixture' } })) } };
    vm.runInNewContext(`const ${generate}; (${click})();`, context);
    if (['RECEIVE', 'ACCEPT_INTAKE'].includes(action)) expect(context.navigate).toHaveBeenCalledWith('/reception?sampleId=sample%20%2F1');
    expect(context.axios.post).not.toHaveBeenCalled();
    if (action === 'RELEASE_REPORT') { expect(context.requestConfirmation).toHaveBeenCalledTimes(1); await context.requestConfirmation.mock.calls[0][2]();
        expect(context.axios.post).toHaveBeenCalledWith('/api/reports/generate/sample /1', {}, { headers: {} });
        expect(context.setReportModal).toHaveBeenCalledWith({ id: 'report-1', body: 'fixture' }); }
});
test.each([false, true])('resuming draft restores actual found metadata (JSON encoded: %s)', encoded => {
    const source = read('Reception.jsx');
    const property = locate(source, node => node.type === 'ObjectProperty' && node.key.name === 'onConfirm' && source.slice(node.start, node.end).includes('const field = found.fieldMetadata'));
    const callback = property.slice(property.indexOf(':') + 1);
    const fields = { collectionDate: { value: '2026-11-14T12:00:00Z' }, landUse: { value: 'CROPLAND' }, isComposite: { value: false } };
    const found = { id: 'draft-1', fieldMetadata: encoded ? JSON.stringify(fields) : fields, depthTopCm: 0, depthBottomCm: 10,
        receptionData: { samplingDetails: { date: '2020-01-01', landUse: 'old', isComposite: true }, notes: 'fixture note' } };
    let sampling = {};
    const context = { found, resolveCoordinates: () => ({ isRecorded: false }),
        setSampling: update => { sampling = typeof update === 'function' ? update(sampling) : update; } };
    for (const name of ['playSuccessChime','setMode','setSessionProject','setSampleData','setSubmitter','setChecklistData','setIntakeNotes','setCustodyCarrierName','setCustodyTrackingNumber','setCustodySenderSignature','setCustodyHandoverAt','setSelectedGroup','setAdditions','setRemovals','setJustification','populateDeskFacts']) context[name] = jest.fn();
    vm.runInNewContext(`(${callback})();`, context);
    expect(context.setSampleData).toHaveBeenCalledWith(found);
    expect(sampling).toMatchObject({ date: '2026-11-14', landUse: 'CROPLAND', isComposite: false, depthTopCm: 0, depthBottomCm: 10 });
    expect(context.populateDeskFacts).toHaveBeenCalledWith(found);
});
