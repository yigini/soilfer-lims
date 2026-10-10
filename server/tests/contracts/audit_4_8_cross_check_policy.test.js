const { registry, PRESETS, valid } = require('../../config/policyRegistry');
const policy = require('../../services/policyService');
const defaults = { basesCecFactor: 1.1, baseSaturationMaxPct: 100,
    textureClosureTolerancePct: 2, cnMin: 8, cnMax: 25, carbonatePhMin: 7 };

describe('Audit 4.8: laboratory cross-check policy contract', () => {
    test('all presets supply the pinned per-lab defaults and finite values', () => {
        for (const [name, value] of Object.entries(defaults)) {
            const key = 'crossCheck.' + name;
            expect(registry[key]).toMatchObject({ scope: 'LAB', type: 'number' });
            for (const preset of PRESETS) expect(registry[key].presets[preset]).toBe(value);
            expect(valid(key, value)).toBe(true);
            for (const invalid of [NaN, Infinity, -Infinity, null, undefined, '2']) expect(valid(key, invalid)).toBe(false);
        }
        expect(valid('crossCheck.basesCecFactor', 0.99)).toBe(false);
        expect(valid('crossCheck.basesCecFactor', 1)).toBe(true);
    });
    test('five server and client locales label every cross-check policy', () => {
        for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const server = require('../../locales/' + locale + '.json');
            const client = require('../../../client/src/translations/' + locale + '.json');
            for (const name of Object.keys(defaults)) {
                const key = 'crossCheck_' + name;
                expect(server.policies.keys[key]).toEqual(expect.any(String));
                expect(server.policies.keys[key].trim()).not.toBe('');
                expect(client.policies.keys[key]).toBe(server.policies.keys[key]);
            }
        }
    });
    test('profile validation rejects equal and inverted C:N bounds using the stable policy code', () => {
        for (const [lower, upper] of [[25, 25], [26, 25]]) {
            expect(() => policy.loadProfile({ profile: { overrides: {
                'crossCheck.cnMin': lower, 'crossCheck.cnMax': upper
            } } })).toThrow(expect.objectContaining({ statusCode: 409, code: 'POLICY_PROFILE_INVALID' }));
        }
        expect(policy.loadProfile({ profile: { overrides: { 'crossCheck.cnMin': 9, 'crossCheck.cnMax': 24 } } }))
            .toMatchObject({ configured: true, overrides: { 'crossCheck.cnMin': 9, 'crossCheck.cnMax': 24 } });
    });
});
