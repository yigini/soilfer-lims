// Default is read-only. The apply path inserts policies/overrides/audits only;
// original Lab.settings and all analytical/QC/report rows are untouched.
const policyService = require('../services/policyService');
const { validateNumberFormat } = require('../../shared/numberParse');

async function planLegacyNumberPolicies(db) {
    const labs = await db.lab.findMany({ select: { id: true, settings: true }, orderBy: { id: 'asc' } });
    const counts = { labsScanned: labs.length, labsWithExplicitSeparators: 0, labsToChange: 0,
        overridesToCreate: 0, inheritedRowsToCreate: 0, explicitRowsToCreate: 0, existingKeysSkipped: 0, invalidLabs: 0 };
    const plans = [], invalid = [];
    for (const lab of labs) {
        let settings;
        try { settings = lab.settings ? JSON.parse(lab.settings) : {}; }
        catch (_) { counts.invalidLabs++; invalid.push({ labId: lab.id, code: 'LEGACY_SETTINGS_INVALID' }); continue; }
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
            counts.invalidLabs++; invalid.push({ labId: lab.id, code: 'LEGACY_SETTINGS_INVALID' }); continue;
        }
        const fields = [['decimalSeparator', 'numbers.decimalSeparator'], ['thousandsSeparator', 'numbers.thousandsSeparator']]
            .filter(([field]) => Object.hasOwn(settings, field));
        if (!fields.length) continue;
        counts.labsWithExplicitSeparators++;
        const current = await policyService.snapshot(lab.id, { db });
        const changes = fields.filter(([, key]) => {
            const keep = current.resolved[key].source !== 'LAB_OVERRIDE';
            if (!keep) counts.existingKeysSkipped++;
            return keep;
        }).map(([field, key]) => ({ key, value: settings[field] }));
        if (!changes.length) continue;
        const values = { ...current.values, ...Object.fromEntries(changes.map(c => [c.key, c.value])) };
        if (!validateNumberFormat({ decimal: values['numbers.decimalSeparator'], thousands: values['numbers.thousandsSeparator'] })) {
            counts.invalidLabs++; invalid.push({ labId: lab.id, code: 'NUMBER_FORMAT_POLICY_INVALID' }); continue;
        }
        counts.labsToChange++; counts.overridesToCreate += changes.length;
        if (current.version === 0) counts.inheritedRowsToCreate++;
        plans.push({ labId: lab.id, expectedVersion: current.version, changes });
    }
    return { counts, plans, invalid };
}
async function migrateLegacyNumberPolicies({ db = require('../prisma'), apply = false } = {}) {
    const plan = await planLegacyNumberPolicies(db);
    if (!apply) return { mode: 'DRY_RUN', ...plan };
    if (plan.counts.invalidLabs) throw Object.assign(new Error('Invalid legacy settings require review before migration.'),
        { statusCode: 409, code: 'LEGACY_POLICY_MIGRATION_BLOCKED', counts: plan.counts, invalid: plan.invalid });
    const actor = { role: 'SUPER_ADMIN', username: 'SYSTEM_POLICY_MIGRATION', isActive: true };
    await db.$transaction(async tx => {
        for (const row of plan.plans) await policyService.mutateInTransaction(actor, row.labId, {
            changes: row.changes, expectedVersion: row.expectedVersion, reason: 'migrated from Lab.settings'
        }, tx);
    });
    return { mode: 'APPLIED', counts: plan.counts, auditRowsCreated: plan.plans.length };
}
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.some(arg => !['--dry-run', '--apply'].includes(arg)) || (args.includes('--dry-run') && args.includes('--apply'))) {
        console.error('Use --dry-run (default) or --apply.'); process.exitCode = 1;
    } else migrateLegacyNumberPolicies({ apply: args.includes('--apply') }).then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(e => { console.error(JSON.stringify({ code: e.code, error: e.message, counts: e.counts, invalid: e.invalid })); process.exitCode = 1; })
        .finally(() => require('../prisma').$disconnect());
}
module.exports = { planLegacyNumberPolicies, migrateLegacyNumberPolicies };
