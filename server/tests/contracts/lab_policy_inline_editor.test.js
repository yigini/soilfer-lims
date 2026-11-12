const path = require('node:path');
const { chromium } = require('playwright');
const { registry } = require('../../config/policyRegistry');
const { snapshot } = require('../../services/policyService');
const { checkLabPolicyEditor } = require('../../../client/scripts/check-lab-policy-editor.cjs');

test('policy Edit on the first and last editable rows is visible; Edit/Clear preserve requests and permissions', async () => {
    const state = await snapshot(null);
    const fixture = { ...state, version: 7, registry, canEdit: true, presets: ['ISO17025_STRICT','BASIC','ADVISORY'],
        analyses: [{ code: 'PH', name: 'pH' }, { code: 'EC', name: 'Conductivity' }],
        methodologies: [{ id: 'method-ec', name: 'Conductivity method', analysisCode: 'EC' }], history: [],
        overrides: [{ id: 'analysis-rule', key: 'qc.mode', analysisCode: 'PH', methodologyId: null, value: 'ADVISORY', reason: 'Practice analysis rule' },
            { id: 'method-rule', key: 'qc.mode', analysisCode: 'EC', methodologyId: 'method-ec', value: 'ADVISORY', reason: 'Practice method rule' }] };
    fixture.resolved['qc.mode'] = { ...fixture.resolved['qc.mode'], source: 'LAB_OVERRIDE', scope: { analysisCode: null, methodologyId: null } };
    await checkLabPolicyEditor({ chromium, fixture, artifactDir: path.resolve(__dirname, '../../../output/playwright/issue419-lab-policy-inline') });
}, 90000);

test('inline policy editor explanations exist in all five client languages', () => {
    for (const locale of ['en','fr','pt','es','es-419']) {
        const strings = require(`../../../client/src/translations/${locale}.json`).policyEditor;
        for (const key of ['reasonRequiredHint','labScopeOnly','labOrAnalysisScopeOnly','installScopeOnly','replaceUnsaved']) expect(typeof strings?.[key]).toBe('string');
    }
});
