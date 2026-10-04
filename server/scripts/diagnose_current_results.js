#!/usr/bin/env node
'use strict';

// Explicit database path, read-only connection, no repair or write mode.
function diagnoseCurrentResults(db) {
    const groups = db.prepare(`SELECT sampleId, param, replicateNo, COUNT(*) AS currentCount
        FROM Result WHERE isCurrent = 1
        GROUP BY sampleId, param, replicateNo HAVING COUNT(*) > 1
        ORDER BY sampleId, param, replicateNo`).all();
    return { groupCount: groups.length, currentRowCount: groups.reduce((sum, group) => sum + group.currentCount, 0), groups };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--database' || !args[1]) {
        console.error('Usage: node scripts/diagnose_current_results.js --database <existing SQLite database>');
        process.exitCode = 1;
    } else {
        let db;
        try {
            const Database = require('better-sqlite3');
            db = new Database(args[1], { readonly: true, fileMustExist: true });
            console.log(JSON.stringify(diagnoseCurrentResults(db), null, 2));
        } catch (error) {
            console.error(error.message);
            process.exitCode = 1;
        } finally {
            if (db) db.close();
        }
    }
}

module.exports = { diagnoseCurrentResults };
