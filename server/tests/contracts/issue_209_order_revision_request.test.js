const { orderRevisionRequest } = require('../../services/orderRevisionContract');

const facts = { currentAnalyses: ['PH_H2O'], priorActiveCount: 1 };
const errorCode = (action, code, status) => {
    try { action(); throw new Error('Expected refusal'); }
    catch (error) { expect(error).toMatchObject({ code, statusCode: status }); }
};

describe('#209 reasoned complete order request', () => {
    test.each([undefined, null, '', '   ', 42])('a changed order refuses invalid reason %p', reason => {
        errorCode(() => orderRevisionRequest({ analyses: ['PH_H2O', 'SOC'], reason }, facts),
            'TRANSITION_REASON_REQUIRED', 400);
    });
    test('normalises aliases, whitespace and compound codes before comparing the complete set', () => {
        const input = { analyses: [' Particle Size Analysis ', 'TEXTURE', 'exchangeableBases'], reason: '  Client revised the order  ' };
        const before = JSON.stringify(input);
        expect(orderRevisionRequest(input, facts)).toEqual({ analyses: ['TEXTURE', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA'],
            reason: 'Client revised the order', changed: true, explicitTarget: true });
        expect(JSON.stringify(input)).toBe(before);
    });
    test('equivalent normalised sets are a no-op without an invented reason', () => {
        expect(orderRevisionRequest({ analyses: ['TEXTURE', 'PH_H2O'] },
            { currentAnalyses: ['PH_H2O', 'pSA'], priorActiveCount: 1 })).toMatchObject({ changed: false, reason: null });
    });
    test('three historical ACTIVE revisions require an explicit complete set', () => {
        errorCode(() => orderRevisionRequest({ reason: 'Reviewed all orders' }, { ...facts, priorActiveCount: 3 }),
            'ORDER_TARGET_REQUIRED', 409);
    });
    test('an unchanged target still needs a deliberate reason when repairing ACTIVE ambiguity', () => {
        errorCode(() => orderRevisionRequest({ analyses: ['PH_H2O'] }, { ...facts, priorActiveCount: 3 }),
            'TRANSITION_REASON_REQUIRED', 400);
        expect(orderRevisionRequest({ analyses: ['PH_H2O'], reason: 'Reviewed all prior revisions' },
            { ...facts, priorActiveCount: 3 })).toMatchObject({ changed: true, explicitTarget: true });
    });
    test('a complete empty set is a reasoned request, leaving downstream reconciliation to protect recorded work', () => {
        expect(orderRevisionRequest({ analyses: [], reason: 'No remaining requested analyses' }, facts)).toMatchObject({ analyses: [], changed: true });
    });
    test('a reasoned line repair cannot disappear as an unchanged-analysis no-op', () => {
        errorCode(() => orderRevisionRequest({ analyses: ['PH_H2O'] }, { ...facts, requiresLineRevision: true }),
            'TRANSITION_REASON_REQUIRED', 400);
        expect(orderRevisionRequest({ analyses: ['PH_H2O'], reason: 'Resolve missing order line' },
            { ...facts, requiresLineRevision: true })).toMatchObject({ changed: true });
    });
    test.each(['PH_H2O', [''], ['  '], [null], [42]])('refuses malformed requested selections %p', analyses => {
        errorCode(() => orderRevisionRequest({ analyses, reason: 'Changed order' }, facts), 'INVALID_ANALYSIS_SELECTION', 400);
    });
    test('corrupt stored selections cannot be silently replaced', () => {
        errorCode(() => orderRevisionRequest({ analyses: ['PH_H2O'], reason: 'Changed order' },
            { currentAnalyses: null, priorActiveCount: 1 }), 'INVALID_STORED_ANALYSES', 409);
    });
});
