const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261010000100_instrument_import_templates';
const SHA256 = '68555c0f9901a48c1c87a7d4ccb8320d0c515e388df094a47865064ee0ad6fc8';
const ORACLE_SHA256 = '9e098129de487fdb8ae551da9756a48c5627821ebe8da899f965824f815849df';
const PRE_DRAFT_SHA256 = 'a523b351ff7046f21c448c637600ddbbc159c38487a4cd982163e0ada13ef6af';
const UPGRADED_DRAFT_SHA256 = '4f444bdf15f710a2c0223764b650713ce6b413c3d4469a950bb8bfaa05bf666b';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const mismatch = cause => Object.assign(new Error('Instrument import release evidence differs from the reviewed source.', { cause }),
    { statusCode: 409, code: 'IMPORT_SOURCE_MISMATCH' });
function loadInstrumentImportMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/200' : 'prisma/migrations', DIRECTORY);
    const read = (name, expected) => {
        let bytes;
        try { bytes = fs.readFileSync(path.join(root, name)); } catch (cause) { throw mismatch(cause); }
        if (digest(bytes) !== expected) throw mismatch();
        return bytes.toString('utf8');
    };
    const sql = read('migration.sql', SHA256), freshTables = JSON.parse(read('fresh-prisma-tables.json', ORACLE_SHA256));
    const boundary = sql.indexOf('-- Contract guards');
    if (boundary < 0 || Object.keys(freshTables).join(',') !== 'ImportTemplate,InstrumentImportReceipt,WorkItemDraft' ||
        (sql.match(/^CREATE TRIGGER /gm) || []).length !== 6) throw mismatch();
    for (const name of ['ImportTemplate', 'InstrumentImportReceipt']) {
        if (sql.match(new RegExp('^CREATE TABLE "' + name + '" \\([\\s\\S]*?^\\);', 'm'))?.[0] !== freshTables[name]) throw mismatch();
    }
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary),
        sha256: SHA256, oracleSha256: ORACLE_SHA256, freshTables: Object.freeze(freshTables),
        preDraftSql: read('pre-prisma-draft-table.sql', PRE_DRAFT_SHA256), upgradedDraftSql: read('upgraded-prisma-draft-table.sql', UPGRADED_DRAFT_SHA256),
        preDraftSha256: PRE_DRAFT_SHA256, upgradedDraftSha256: UPGRADED_DRAFT_SHA256 });
}
module.exports = { loadInstrumentImportMigrationSource };
