const { definition, valid, PRESETS } = require('../../config/policyRegistry');
const { renderReportAmendedStatement } = require('../../services/reportAmendedStatement');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const key = 'report.amendedStatement', rule = definition(key);
const templates = () => structuredClone(rule.localizedDefaults);

test('all presets use localized defaults; the per-lab override declares exactly five locales and three placeholders', () => {
    expect(rule).toMatchObject({ scope: 'LAB', nullable: true, type: 'reportAmendmentTemplate' });
    for (const preset of PRESETS) expect(rule.presets[preset]).toBeNull();
    expect(valid(key, null)).toBe(true); expect(valid(key, templates())).toBe(true);
});

test.each(['missingLocale', 'extraLocale', 'empty', 'missingPlaceholder', 'unknownPlaceholder', 'duplicatePlaceholder', 'brokenBrace'])('invalid template %s refuses the entire policy value', kind => {
    const value = templates();
    if (kind === 'missingLocale') delete value.pt;
    if (kind === 'extraLocale') value.de = value.en;
    if (kind === 'empty') value.fr = '   ';
    if (kind === 'missingPlaceholder') value.en = value.en.replace('{reason}', 'reason');
    if (kind === 'unknownPlaceholder') value.en += ' {token}';
    if (kind === 'duplicatePlaceholder') value.en += ' {reason}';
    if (kind === 'brokenBrace') value.en += ' {';
    expect(valid(key, value)).toBe(false);
    expect(() => renderReportAmendedStatement({ policyValue: value, locale: 'en', replacedNumber: 'OWNED-1', replacedRevision: 1, reason: 'Retained reason' }))
        .toThrow(expect.objectContaining({ statusCode: 400, code: 'POLICY_VALUE_INVALID' }));
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('the selected %s statement preserves literal Unicode reason text without substitution syntax expansion', locale => {
    const reason = '  é 土\n$& {reason}  ', output = renderReportAmendedStatement({ policyValue: null, locale,
        replacedNumber: 'OWNED-2026-00001', replacedRevision: 1, reason });
    expect(output).toContain('OWNED-2026-00001'); expect(output).toContain('1'); expect(output).toContain(reason);
    expect(output).not.toContain('{replacedNumber}'); expect(output).not.toContain('{replacedRevision}');
});

test('the actual policy owner refuses invalid template changes without modifying any retained fixture row', async () => {
    const f = await qcGateFixture();
    try {
        const before = await f.snapshot(), invalid = templates(); invalid.pt = '{reason}';
        await expect(f.setPolicy([{ key, value: invalid }])).rejects.toMatchObject({ statusCode: 400, code: 'POLICY_VALUE_INVALID' });
        expect(await f.snapshot()).toEqual(before); expect(await require('../../services/policyService').get(f.labId, key, { db: f.db })).toBeNull();
        const value = templates(); value.fr = 'Correction locale {replacedNumber} / {replacedRevision}: {reason}';
        await f.setPolicy([{ key, value }]); expect(await require('../../services/policyService').get(f.labId, key, { db: f.db })).toEqual(value);
    } finally { await f.close(); }
});
