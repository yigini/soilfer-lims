#!/usr/bin/env node
/**
 * Stopped-Writer Exchange Epoch Rotation & Recovery Tool
 * Issue #140 (Work Package P4 / Codex Remediation R5/R10)
 *
 * Run this utility while writers are stopped immediately after restoring a database
 * backup. Generates an unrepeatable cryptographic restore generation (epoch), invalidating
 * any cursors issued prior to or after the backup point, preventing event replay or duplicate processing.
 *
 * Usage:
 *   node server/scripts/rotate_exchange_epoch.cjs [--database <path>] [--reason <reason>]
 */

'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        database: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'),
        reason: 'STOPPED_WRITER_RESTORE'
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--database' || args[i] === '-d') {
            options.database = path.resolve(args[++i]);
        } else if (args[i] === '--reason' || args[i] === '-r') {
            options.reason = args[++i];
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Stopped-Writer Exchange Epoch Rotation Tool

Options:
  --database, -d <path>    Path to SQLite database file (default: server/prisma/dev.db)
  --reason,   -r <string>  Audit reason for epoch rotation (default: STOPPED_WRITER_RESTORE)
  --help,     -h           Show this help message
`);
            process.exit(0);
        }
    }
    return options;
}

function main() {
    const options = parseArgs();

    if (!fs.existsSync(options.database)) {
        console.error(`[ERROR] Database file not found at: ${options.database}`);
        process.exit(1);
    }

    console.log(`[EPOCH_ROTATION] Target database: ${options.database}`);
    console.log(`[EPOCH_ROTATION] Reason: ${options.reason}`);

    process.env.DATABASE_PATH = options.database;
    const { rotateEpoch, getCurrentEpoch, getSourceSystemId, ensureTriggers } = require('../services/exchangeStateService');

    const db = new Database(options.database, { timeout: 5000 });
    db.pragma('journal_mode = WAL');

    try {
        const oldEpoch = getCurrentEpoch(db);
        const result = rotateEpoch(db, options.reason);
        ensureTriggers(db);

        const maxJournalSeq = db.prepare('SELECT MAX(sequence) as s FROM _exchange_journal').get()?.s || 0;
        const totalSnapshots = db.prepare('SELECT COUNT(*) as c FROM _exchange_snapshots').get()?.c || 0;
        const sourceSystemId = getSourceSystemId(db);

        console.log('\n============================================================');
        console.log('       EXCHANGE EPOCH ROTATION COMPLETE (STOPPED WRITER)    ');
        console.log('============================================================');
        console.log(`Installation Source ID:   ${sourceSystemId}`);
        console.log(`Previous Epoch:           ${oldEpoch}`);
        console.log(`New Unrepeatable Epoch:   ${result.currentEpoch}`);
        console.log(`Rotated At:               ${result.rotatedAt}`);
        console.log(`Current Journal Sequence: ${maxJournalSeq}`);
        console.log(`Retained Snapshots:       ${totalSnapshots}`);
        console.log('============================================================\n');

        console.log('POST-RESTORE RECONCILIATION INSTRUCTIONS:');
        console.log('1. All consumer cursors signed with the old epoch are now expired (HTTP 410).');
        console.log('2. External receivers (OpenNSIS / harvesters) encountering HTTP 410 must:');
        console.log('   a) Request a fresh frozen snapshot via POST /api/v2/data-exchange/snapshots, or');
        console.log('   b) Reset cursor to the current sequence boundary using seq=0 on /changes.');
        console.log('3. Verify that database integrity check returns "ok": PRAGMA integrity_check;');
        console.log('4. External exchange endpoints can now safely be re-enabled.\n');

        db.close();
        process.exit(0);
    } catch (err) {
        console.error(`[EPOCH_ROTATION_ERROR] Failed: ${err.message}`);
        if (db.open) db.close();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { parseArgs };
