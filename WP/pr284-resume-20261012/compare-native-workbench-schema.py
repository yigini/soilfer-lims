"""Compare retained schema evidence with historical DDL entirely in memory."""
import difflib
import hashlib
import json
import pathlib
import re
import sqlite3

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent

def main():
    protected = json.loads((HERE / 'failed-proof-105200/fresh-protected-state.json').read_bytes())
    actual = protected['objects']['table:WorkItemDraft']['sql']
    historical = REPO / 'server/scripts/migrate_workbench_drafts.js'
    raw = historical.read_bytes()
    ddl = re.search(r'CREATE TABLE IF NOT EXISTS "WorkItemDraft" \([\s\S]*?\n        \);', raw.decode()).group()
    db = sqlite3.connect(':memory:')
    db.executescript(ddl)
    db.execute('ALTER TABLE "WorkItemDraft" ADD COLUMN "records" TEXT')
    generated = db.execute("SELECT sql FROM sqlite_master WHERE name='WorkItemDraft'").fetchone()[0]
    assert generated == actual, 'Historical native emission does not exactly match the captured SQL'
    before_shape = db.execute('PRAGMA table_xinfo(WorkItemDraft)').fetchall()
    oracle = json.loads((REPO / 'server/prisma/migrations/20261010000100_instrument_import_templates/post205-draft-tables.json').read_bytes())
    migration = (REPO / 'server/prisma/migrations/20261010000100_instrument_import_templates/migration.sql').read_text()
    db.executescript(migration)
    upgraded = db.execute("SELECT sql FROM sqlite_master WHERE name='WorkItemDraft'").fetchone()[0]
    after_shape = db.execute('PRAGMA table_xinfo(WorkItemDraft)').fetchall()
    assert after_shape[:-1] == before_shape
    value = {'historicalScript':str(historical.relative_to(REPO)).replace('\\','/'),
        'historicalScriptSha256':hashlib.sha256(raw).hexdigest(),
        'retainedFailedReceiptSha256':'511c1951dd11b37612186190237f302f015ebfabefb970b4490395ef9cc2268e',
        'historicalDdlPlus205ExactlyEqualsCapturedSql':True,
        'preNativeWorkbench':actual,'postNativeWorkbench':upgraded,
        'preSqlSha256':hashlib.sha256(actual.encode()).hexdigest(),
        'postSqlSha256':hashlib.sha256(upgraded.encode()).hexdigest(),
        'beforeShape':before_shape,'afterShape':after_shape,
        'originalDraftRowDigest':protected['tables']['WorkItemDraft'],
        'semanticDifferences':['inline workItemId UNIQUE','updatedAt DEFAULT CURRENT_TIMESTAMP'],
        'nearestOracleDiff':list(difflib.unified_diff(oracle['preUpgraded'].splitlines(),actual.splitlines(),fromfile='captured-preUpgraded',tofile='actual-native-workbench')),
        'productionDatabaseAccess':False,'databaseMode':'IN_MEMORY_DDL_ONLY'}
    with (HERE/'native-workbench-schema-comparison.json').open('x',encoding='utf-8',newline='\n') as f:
        json.dump(value,f,indent=2);f.write('\n')
    print(json.dumps({k:value[k] for k in ['historicalScriptSha256','historicalDdlPlus205ExactlyEqualsCapturedSql','preSqlSha256','postSqlSha256','semanticDifferences']}))

if __name__=='__main__':main()
