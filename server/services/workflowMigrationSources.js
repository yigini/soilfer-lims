const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

// #179 pins 5992004254 / 5992064632. These are the exact LF bytes shipped
// outside the persistent Prisma volume; a volume cannot replace release DDL.
const SOURCES = Object.freeze({
    evidence: Object.freeze({ directory: '20261005000000_workflow_state_evidence',
        sha256: 'ae3accea0c276aab9ea3ed443b44d89ac05e52ef38a39345aa33e8744f019552' }),
    guards: Object.freeze({ directory: '20261005000100_workflow_state_guards',
        sha256: '84921ef45fa8609621b38908de5261d716820f2135f2dde1b9a20fafa6fc81ed' })
});

function loadWorkflowMigrationSources() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv')
        ? '.migrations-backup/179' : 'prisma/migrations');
    return Object.fromEntries(Object.entries(SOURCES).map(([key, definition]) => {
        const file = path.join(root, definition.directory, 'migration.sql');
        let bytes;
        try { bytes = fs.readFileSync(file); }
        catch (cause) {
            throw Object.assign(new Error(`The release migration source is unavailable: ${file}`, { cause }),
                { code: 'WORKFLOW_GUARDS_SOURCE_MISMATCH', differences: [{ source: key, file, missing: true }] });
        }
        const actualSha256 = createHash('sha256').update(bytes).digest('hex');
        if (actualSha256 !== definition.sha256) {
            throw Object.assign(new Error(`The release migration source digest differs: ${file}`),
                { code: 'WORKFLOW_GUARDS_SOURCE_MISMATCH', differences: [{ source: key, file,
                    expectedSha256: definition.sha256, actualSha256 }] });
        }
        return [key, { ...definition, file, sql: bytes.toString('utf8') }];
    }));
}

function evidenceCreates(sql) {
    const start = sql.indexOf('CREATE TABLE');
    const result = start < 0 ? '' : sql.slice(start);
    if (!result || result.split(';').filter(statement => statement.trim()).some(statement => !/^\s*CREATE (?:TABLE|INDEX)\b/.test(statement))) {
        throw Object.assign(new Error('The evidence reference slice must contain only CREATE TABLE/INDEX statements.'),
            { code: 'WORKFLOW_GUARDS_SOURCE_MISMATCH' });
    }
    return result;
}

module.exports = { SOURCES, loadWorkflowMigrationSources, evidenceCreates };
