"""Validate the private retained copy before any policy-cache reuse."""
import hashlib,json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015/retained-copy-validation-source-successor-once'
assert not D.exists()
F=R/'WP/startup-order-readiness-20261015/pinned-policy-alias-focused-once'
summary=json.loads((F/'summary.json').read_bytes());assert summary['status']=='PASS' and summary['passed']==166
frozen=json.loads((F/'source-after.json').read_bytes());assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==v for n,v in frozen.items())
D.mkdir()
for name in ['server/utils/startupReadinessContext.js','server/tests/contracts/startup_readiness_context.test.js']:
    p=D/'source-before'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((R/name).read_bytes())
file=R/'server/utils/startupReadinessContext.js';text=file.read_text(encoding='utf-8')
old="""            if (policy && policy.sourceSha256 === source.sha256) {
                if (resolved === policy.readonlySnapshot.path && same(policyCopyHashes, hashes)) {"""
new="""            let copyUnchanged = false;
            if (policy && policy.sourceSha256 === source.sha256) {
                copyUnchanged = same(policyCopyHashes, resolved === policy.readonlySnapshot.path
                    ? hashes : snapshotHashes(policy.readonlySnapshot.path));
                if (resolved === policy.readonlySnapshot.path && copyUnchanged) {"""
assert old in text;text=text.replace(old,new)
text=text.replace("if (resolved === original && same(policy.readonlySnapshot.originalDbWalShmSha256, hashes))", "if (resolved === original && copyUnchanged && same(policy.readonlySnapshot.originalDbWalShmSha256, hashes))")
old="""            releaseReader();
            policy = chart = null;
            policyCopyHashes = null;"""
new="""            releaseReader();
            if (policy && !copyUnchanged) {
                checks.clear(); checkedVersion = firstReadVersion = null;
            }
            policy = chart = null;
            policyCopyHashes = null;"""
assert old in text;text=text.replace(old,new);file.write_bytes(text.encode())
file=R/'server/tests/contracts/startup_readiness_context.test.js';text=file.read_text(encoding='utf-8')
anchor="test('reusing a chart result still reloads and verifies its migration digest'"
new="""test('changed retained-copy bytes cannot reuse cached policy or integrity results', () => {
    const results = [false, true].map(shared => {
        const file = cloneFixture(), before = triples(file);
        let capturedCopy;
        const result = startup(file, { shared, selected: stages.slice(23, 25),
            afterCopy: (source, destination) => {
                if (source === file && destination.endsWith('snapshot.db')) capturedCopy = destination;
            },
            during: script => {
                if (script === 'install_lab_policy_schema') {
                    expect(capturedCopy).toBeDefined();
                    // Only this run's newly retained copy is changed. The
                    // original owned fixture and SQL data remain unchanged.
                    fs.appendFileSync(capturedCopy, '\\nowned-copy-byte-canary\\n');
                }
            } });
        expect(triples(file)).toEqual(before);
        return result;
    });
    expect(results[1].outcomes).toEqual(results[0].outcomes);
    expect(results[1].outcomes.every(row => row.report && !row.error)).toBe(true);
    expect(results[1].snapshotCopies).toBe(2);
    expect(results[1].physical.filter(row => row.sql === 'integrity_check')).toHaveLength(2);
    expect(results[1].physical.filter(row => row.sql === 'foreign_key_check')).toHaveLength(2);
});

"""
assert text.count(anchor)==1;text=text.replace(anchor,new+anchor);file.write_bytes(text.encode())
runner=R/'WP/backlog-resume-20261013/verify-startup-retained-copy-validation-focused-once.py';assert not runner.exists()
prior=(R/'WP/backlog-resume-20261013/verify-startup-pinned-policy-alias-focused-once.py').read_text(encoding='utf-8')
runner.write_bytes(prior.replace('pinned-policy-alias-focused-once','retained-copy-validation-focused-once').replace(")+6", ")+7").encode())
(D/'preparation.json').write_text(json.dumps({'priorFocusedPass':summary,'newOwnedCopyByteCanary':True,
    'copyFullHashesValidatedBeforeOriginalOrAliasCacheHit':True,'changedCopyClearsSqlAndChartCaches':True,
    'defaultCliAndOriginalCopyRaceGuardsUnchanged':True,'nextRunner':runner.relative_to(R).as_posix(),'testsNotRunYet':True},indent=2),encoding='utf-8')
print(json.dumps({'status':'PRIVATE_COPY_CACHE_VALIDATION_PREPARED_NOT_RUN'}))
