const fs = require('node:fs');
const path = require('node:path');
const migrations = require('../services/statusMigrationService');

function parseArguments(args) {
    const options = { direction: 'apply', apply: false };
    const valued = { '--db': 'databasePath', '--plan': 'planPath', '--reviewed-sha256': 'fingerprint', '--timeout-ms': 'timeoutMs' };
    const seen = new Set();
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (seen.has(arg)) throw new Error(`Repeated argument: ${arg}`);
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--revert') options.direction = 'revert';
        else if (arg === '--dry-run') options.dryRun = true;
        else if (valued[arg] && args[index + 1] && !args[index + 1].startsWith('--')) options[valued[arg]] = args[++index];
        else throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
    if (!options.databasePath) throw new Error('An explicit --db path is required; there is no default writable database.');
    if (options.apply && options.dryRun) throw new Error('--apply and --dry-run are mutually exclusive.');
    if (options.timeoutMs != null) {
        options.timeoutMs = Number(options.timeoutMs);
        if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) throw new Error('--timeout-ms must be a positive integer.');
    }
    if (options.apply && (!options.planPath || !/^[a-f0-9]{64}$/.test(options.fingerprint || ''))) {
        throw new Error('--apply requires --plan and its exact --reviewed-sha256 from a reviewed dry run.');
    }
    return options;
}

async function main(args = process.argv.slice(2)) {
    const options = parseArguments(args);
    const report = migrations.inspectDatabase(options.databasePath, options.direction);
    if (!options.apply) {
        process.stdout.write(`${JSON.stringify({ mode: 'DRY_RUN', ...report }, null, 2)}\n`);
        return;
    }
    if (!report.schemaReady) throw new Error('The complete additive state schema and guards are required before --apply.');
    const document = JSON.parse(fs.readFileSync(path.resolve(options.planPath), 'utf8'));
    const plan = document.plan || document;
    if (plan.direction !== options.direction) throw new Error('The reviewed plan direction does not match --revert.');
    // Import the writable runtime only after all read-only argument/schema checks.
    const { PrismaClient } = require('../prisma_client');
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${path.resolve(options.databasePath)}`, timeout: 5000 }) });
    try {
        const outcome = await migrations.applyReviewedPlan(client, plan, options.fingerprint, { timeoutMs: options.timeoutMs });
        process.stdout.write(`${JSON.stringify({ mode: 'APPLIED', ...outcome }, null, 2)}\n`);
    } finally { await client.$disconnect(); }
}

if (require.main === module) main().catch(error => {
    process.stderr.write(`${JSON.stringify({ error: error.code || 'STATUS_MIGRATION_REFUSED', message: error.message, ...(error.details || {}) })}\n`);
    process.exitCode = 1;
});

module.exports = { parseArguments, main };
