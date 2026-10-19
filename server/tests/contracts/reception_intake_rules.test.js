'use strict';
const registry = require('../../config/policyRegistry');
const rulesService = require('../../services/intakeRulesService');
const { evaluateChecklistCompliance: evaluate } = require('../../services/intakeValidationService');
const fixture = require('../helpers/intakeRulesFixture');

describe('#156 bounded reception policy', () => {
    test.each(registry.PRESETS)('%s preserves default criteria and optional context', preset => {
        const value = registry.clone(registry.definition('reception.intakeRules').presets[preset]);
        expect(registry.valid('reception.intakeRules', value)).toBe(true);
        for (const [name, profile] of Object.entries(value)) {
            expect(Object.values(profile.context).every(rule => rule.enabled && !rule.required)).toBe(true);
            for (const [key, rule] of Object.entries(profile.criteria)) expect(rule).toEqual({ enabled: true, required: true, naAllowed: key === 'coc' && name === 'walkIn' });
        }
        expect(evaluate(null).isComplete).toBe(false);
    });
    test.each([
        value => { value.extra = value.project; },
        value => { value.project.criteria.extra = value.project.criteria.coc; },
        value => { delete value.walkIn.context.composite; },
        value => { value.project.criteria.container.enabled = 'false'; },
        value => { value.walkIn.context.landUse.naAllowed = true; },
        value => { value.project.context = []; }
    ])('rejects malformed values and custom fields', mutate => {
        const value = registry.strict('reception.intakeRules'); mutate(value);
        expect(registry.valid('reception.intakeRules', value)).toBe(false);
    });
    test('disabled criteria are ignored, optional items may be unanswered, N/A follows the resolved key', () => {
        const rules = fixture();
        rules.criteria.container.enabled = false;
        rules.criteria.label.required = false;
        rules.criteria.quantity.naAllowed = true;
        const checklist = { items: { container: { status: 'FAIL' }, quantity: { status: 'NA' }, condition: { status: 'PASS' }, coc: { status: 'PASS' } } };
        expect(evaluate(checklist, { rules })).toMatchObject({ isComplete: true, isPassed: true, failedItems: [], unansweredItems: [], invalidNAItems: [] });
        rules.criteria.quantity.naAllowed = false;
        expect(evaluate(checklist, { rules }).invalidNAItems).toEqual(['quantity']);
    });
    test('an entirely disabled checklist does not invent unanswered requirements', () => {
        const rules = fixture(); Object.values(rules.criteria).forEach(rule => { rule.enabled = false; });
        expect(evaluate(undefined, { rules })).toMatchObject({ isProvided: false, isComplete: true, isPassed: true });
    });
    test('required context uses observations, including zero depth and explicit false', () => {
        const rules = fixture(); Object.values(rules.context).forEach(rule => { rule.required = true; });
        expect(rulesService.evaluateContext({}, null, rules).unansweredItems).toEqual(Object.keys(rules.context));
        const body = { samplingDetails: { landUse: 'Cropland', date: '2026-10-19', depthTopCm: 0, depthBottomCm: 20, isComposite: false } };
        expect(rulesService.evaluateContext(body, null, rules).isComplete).toBe(true);
        body.samplingDetails.depthTopCm = '';
        expect(rulesService.evaluateContext(body, null, rules).unansweredItems).toEqual(['samplingDepth']);
        rules.context.samplingDepth.enabled = false;
        expect(rulesService.evaluateContext(body, null, rules).isComplete).toBe(true);
    });
    test('stored observations are read without changing existing receipts', () => {
        const rules = fixture(); rules.context.landUse.required = true;
        const sample = { fieldMetadata: JSON.stringify({ landUse: { value: 'Forest', source: 'FIELD' } }),
            receptionData: JSON.stringify({ samplingDetails: {}, checklist: { items: {} } }) };
        const before = JSON.stringify(sample);
        expect(rulesService.evaluateContext({}, sample, rules).isComplete).toBe(true);
        expect(rulesService.evaluateContext({ samplingDetails: { landUse: '' } }, sample, rules).isComplete).toBe(false);
        expect(JSON.stringify(sample)).toBe(before);
    });
    test.each([
        [{ projectId: 'project', metadata: '{"origin":"DESK_WALKIN"}' }, 'project'],
        [{ fieldMetadata: '{"source":"KOBO"}' }, 'project'],
        [{ metadata: '{"origin":"DESK_WALKIN"}' }, 'walkIn'],
        [{}, 'project']
    ])('saved provenance wins over caller profile flags (%j)', (sample, expected) => {
        expect(rulesService.profileFor({ sample, isWalkIn: true, profile: 'walkIn' })).toBe(expected);
    });
    test('resolves the sample lab policy, ignoring caller-supplied rules and another lab', async () => {
        const value = registry.strict('reception.intakeRules'); value.project.criteria.container.enabled = false;
        const labsRead = [];
        const db = { lab: { findUnique: async ({ where }) => { labsRead.push(where.id || where.code); return { id: where.id || where.code }; } },
            labPolicy: { findUnique: async () => ({ version: 3 }) },
            labPolicyOverride: { findMany: async ({ where }) => [{ id: 'override', key: 'reception.intakeRules', value: JSON.stringify(where.labId === 'sample-lab' ? value : registry.strict('reception.intakeRules')) }] } };
        const resolved = await rulesService.resolve(db, { sample: { assignedLab: 'sample-lab', projectId: 'project' }, labId: 'other-lab', isWalkIn: true, rules: {} });
        expect(resolved).toMatchObject({ profile: 'project', version: 3, criteria: { container: { enabled: false } } });
        expect(labsRead).toEqual(['sample-lab']);
    });
    test('all five locales have the same complete labels and help', () => {
        const keys = value => Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? keys(item).map(child => key + '.' + child) : [key]);
        const english = require('../../../client/src/translations/en.json').intakeRules;
        for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const value = require(`../../../client/src/translations/${locale}.json`).intakeRules;
            expect(keys(value)).toEqual(keys(english));
            for (const key of keys(value)) expect(key.split('.').reduce((item, part) => item[part], value).trim()).not.toBe('');
        }
    });
});
