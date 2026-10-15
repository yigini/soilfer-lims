"""New owned regression cases, preserving stock policy/chart/order/scanner tests."""
import json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015/visible-guards-and-races-preparation-once'
assert not D.exists();D.mkdir()
file=R/'server/tests/contracts/startup_readiness_context.test.js';text=file.read_text(encoding='utf-8')
text=text.replace('during, afterCopy, beforeSql','during, afterCopy, afterOrderPolicy, afterOrderChart')
start=text.index("                    if (key === 'pragma') return (sql, opts) => {")
end=text.index('                    const value = Reflect.get(real, key, real);',start)
text=text[:start]+"""                    if (key === 'pragma') return (sql, opts) => {
                        if (sql === 'integrity_check') {
                            physical.push({ target, sql, stage: activeStage });
                            if (corruptIntegrity) return opts?.simple ? 'synthetic damaged database' : [{ integrity_check: 'synthetic damaged database' }];
                            return real.pragma('integrity_check', opts);
                        }
                        if (sql === 'foreign_key_check') {
                            physical.push({ target, sql, stage: activeStage });
                            if (corruptForeignKeys) return [{ table: 'WorkItem', rowid: 1, parent: 'Sample', fkid: 0 }];
                            return real.pragma('foreign_key_check', opts);
                        }
                        throw new Error('Unexpected pragma in the closed startup test instrumentation.');
                    };
"""+text[end:]
anchor='            try {\n                for (const [script, method] of selected) {'
replacement="""            const restore = [];
            if (afterOrderPolicy) {
                const owner = require('../../scripts/install_lab_policy_schema');
                const original = owner.assertLabPolicyStartupReady;
                const spy = jest.spyOn(owner, 'assertLabPolicyStartupReady').mockImplementation((...args) => {
                    const result = original(...args);
                    if (activeStage === 'install_order_revisions' && args[0] === file) {
                        const captured = result.readonlySnapshot.path;
                        Object.defineProperty(result.readonlySnapshot, 'path', { enumerable: true, get() {
                            afterOrderPolicy(); return captured;
                        } });
                    }
                    return result;
                });
                restore.push(() => spy.mockRestore());
            }
            if (afterOrderChart) {
                const owner = require('../../scripts/install_control_charts');
                const original = owner.assertControlChartStartupReady;
                const spy = jest.spyOn(owner, 'assertControlChartStartupReady').mockImplementation((...args) => {
                    const result = original(...args);
                    if (activeStage === 'install_order_revisions') afterOrderChart();
                    return result;
                });
                restore.push(() => spy.mockRestore());
            }
            try {
                for (const [script, method] of selected) {"""
assert anchor in text;text=text.replace(anchor,replacement)
text=text.replace('            } finally { context?.close(); }','            } finally { context?.close(); for (const reset of restore) reset(); }')
start=text.index('function changeOwned(file, sql) {');end=text.index("\ntest('all 26",start)
text=text[:start]+"""function ownedMutationTarget(file) {
    const parent = path.dirname(file), root = path.resolve(__dirname, '../.tmp');
    if (process.env.NODE_ENV !== 'test' || path.dirname(parent) !== root ||
        !path.basename(parent).startsWith('startup-readiness-') || path.basename(file) !== 'owned.db' ||
        fs.realpathSync(file).toLowerCase() !== path.resolve(file).toLowerCase() ||
        [process.env.DATABASE_PATH, process.env.PRODUCTION_DATABASE_PATH, path.resolve(__dirname, '../../prisma/dev.db')]
            .filter(Boolean).some(protectedFile => path.resolve(protectedFile).toLowerCase() === path.resolve(file).toLowerCase()))
        throw new Error('A closed startup mutation requires its independently owned file.');
    require('../../services/workflowStateRules').assertFixtureContext();
    return file;
}
function changeOwned(file, change) {
    if (!['policy-index', 'order-index', 'chart-trigger'].includes(change)) throw new Error('Unknown closed startup DDL case.');
    const db = new Database(ownedMutationTarget(file), { fileMustExist: true });
    try {
        if (change === 'policy-index') db.exec('DROP INDEX "LabPolicy_labId_key"');
        if (change === 'order-index') db.exec('DROP INDEX "OrderLine_workItemId_idx"');
        if (change === 'chart-trigger') db.exec('DROP TRIGGER "control_limit_proposal_insert"');
    } finally { db.close(); }
}
"""+text[end:]
text=text.replace("'DROP INDEX \\\"LabPolicy_labId_key\\\"'", "'policy-index'") if False else text
text=text.replace("['policy', 'DROP INDEX \"LabPolicy_labId_key\"',", "['policy', 'policy-index',").replace("['order', 'DROP INDEX \"OrderLine_workItemId_idx\"',", "['order', 'order-index',")
text=text.replace("changeOwned(file, 'DROP INDEX \"OrderLine_workItemId_idx\"')", "changeOwned(file, 'order-index')")
text=text.replace("    changeOwned(file, 'DROP TRIGGER \"' + trigger + '\"');", "    expect(trigger).toBe('control_limit_proposal_insert');\n    changeOwned(file, 'chart-trigger');")
text=text.replace("expect(() => reader.prepare('DELETE FROM WorkItem').run()).toThrow();", "expect(() => reader.exec('CREATE TABLE startup_readonly_canary(id INTEGER)')).toThrow();")
old="            if (key === 'pragma') return (...args) => { physical.push(args[0]); return real.pragma(...args); };"
new="""            if (key === 'pragma') return (sql, options) => {
                physical.push(sql);
                if (sql === 'integrity_check') return real.pragma('integrity_check', options);
                if (sql === 'foreign_key_check') return real.pragma('foreign_key_check', options);
                throw new Error('Unexpected pragma in the closed mixed-view test.');
            };"""
assert old in text;text=text.replace(old,new)
start=text.index("test('an original-file race during impact keeps ORDER_REVISION_SNAPSHOT_CHANGED'")
end=text.index("\ntest('reusing a chart",start)
text=text[:start]+"""test.each(['after-policy-capture', 'after-nested-chart'])('an original-file race %s keeps ORDER_REVISION_SNAPSHOT_CHANGED', boundary => {
    const results = [false, true].map(shared => {
        const file = cloneFixture(); let changed = false;
        const mutate = () => { if (!changed) { changed = true; changeOwned(file, 'order-index'); } };
        return startup(file, { shared,
            ...(boundary === 'after-policy-capture' ? { afterOrderPolicy: mutate } : { afterOrderChart: mutate }) });
    });
    expect(results[0].outcomes.at(-1).error.code).toBe('ORDER_REVISION_SNAPSHOT_CHANGED');
    expect(results[1].outcomes).toEqual(results[0].outcomes);
});

test.each(['absent', 'empty', 'nonempty'])('all26 reports and shared checks remain equivalent with an owned WAL-mode %s WAL', representation => {
    const file = cloneFixture();
    let writer = new Database(ownedMutationTarget(file), { fileMustExist: true });
    try {
        expect(writer.pragma('journal_mode = WAL', { simple: true })).toBe('wal');
        writer.pragma('wal_autocheckpoint = 0');
        writer.exec('CREATE TABLE startup_wal_canary(id INTEGER PRIMARY KEY)');
        if (representation === 'empty') writer.pragma('wal_checkpoint(TRUNCATE)');
        if (representation === 'absent') { writer.close(); writer = null; }
        const exists = fs.existsSync(file + '-wal');
        if (representation === 'absent') expect(exists).toBe(false);
        if (representation === 'empty') expect(fs.statSync(file + '-wal').size).toBe(0);
        if (representation === 'nonempty') expect(fs.statSync(file + '-wal').size).toBeGreaterThan(32);
        expect([...fs.readFileSync(file).subarray(18, 20)]).toEqual([2, 2]);
        const old = startup(file), current = startup(file, { shared: true });
        expect(current.outcomes).toEqual(old.outcomes);
        expect(current.outcomes).toHaveLength(26);
        expect(current.outcomes.every(row => row.report && !row.error)).toBe(true);
        expect(current.physical.filter(row => row.sql === 'integrity_check')).toHaveLength(1);
        expect(current.physical.filter(row => row.sql === 'foreign_key_check')).toHaveLength(1);
        expect(current.snapshotCopies).toBe(1);
        expect(current.computations.chart).toBe(1);
    } finally { writer?.close(); }
});
"""+text[end:]
assert 'beforeSql' not in text and 'real.prepare(sql)' not in text and 'real.pragma(...args)' not in text
file.write_bytes(text.encode())
(D/'preparation.json').write_text(json.dumps({'closedLiteralDdlAndPragmaInstrumentation':True,
    'passivePolicySnapshotPathAndAfterChartHooks':True,'newEarlierRaceBeforeNestedChart':True,
    'ownedWalRepresentations':['absent','empty','nonempty-idle-writer'],'newOutcomesNotYetObserved':True,
    'originalPolicyChartOrderAndStockScannerTestsUnchanged':True,'productionOperations':0},indent=2),encoding='utf-8')
print(json.dumps({'status':'VISIBLE_GUARDS_AND_NEW_RACE_WAL_CASES_PREPARED_NOT_RUN'}))
