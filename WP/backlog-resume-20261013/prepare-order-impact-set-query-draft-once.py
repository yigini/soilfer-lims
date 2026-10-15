"""Source-only performance change; preserve every owner report field and ordering."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015/order-impact-set-query-preparation-once';assert not D.exists();D.mkdir()
p=R/'server/scripts/install_order_revisions.js';before=p.read_bytes();text=before.decode();legacy=subprocess.check_output(['git','show','cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367:server/scripts/install_order_revisions.js'],cwd=R).decode()
assert text.replace('\r\n','\n')==legacy.replace('\r\n','\n'),'Unexpected existing app edit'
(D/'install-order-revisions-before-original.js').write_bytes(before)
old='''    const ownersBySample = new Map();
    for (const item of db.prepare("SELECT id,sampleId,analysis,status FROM WorkItem WHERE analysis IN ('SAND','SILT','CLAY') AND status<>'WAIVED' ORDER BY id").iterate()) {
        if (!ownersBySample.has(item.sampleId)) ownersBySample.set(item.sampleId, []);
        ownersBySample.get(item.sampleId).push(item);
    }
    const incompleteTextureOwners = [], invalidStoredAnalyses = [];
    const sampleTarget = db.prepare('SELECT requiredAnalyses FROM Sample WHERE id=?');
    for (const [sampleId, owners] of ownersBySample) {
        const raw = sampleTarget.get(sampleId).requiredAnalyses;
'''
new='''    const ownersBySample = new Map(), sampleTargets = new Map();
    // Read fraction owners and their stored selections in one indexed join.
    // Keep owner objects and first-owner ordering identical to the legacy report.
    for (const row of db.prepare("SELECT w.id,w.sampleId,w.analysis,w.status,s.id AS storedSampleId,s.requiredAnalyses FROM WorkItem w LEFT JOIN Sample s ON s.id=w.sampleId WHERE w.analysis IN ('SAND','SILT','CLAY') AND w.status<>'WAIVED' ORDER BY w.id").iterate()) {
        const { storedSampleId, requiredAnalyses, ...item } = row;
        if (!ownersBySample.has(item.sampleId)) {
            ownersBySample.set(item.sampleId, []);
            sampleTargets.set(item.sampleId, storedSampleId === null ? undefined : { requiredAnalyses });
        }
        ownersBySample.get(item.sampleId).push(item);
    }
    const incompleteTextureOwners = [], invalidStoredAnalyses = [];
    for (const [sampleId, owners] of ownersBySample) {
        const raw = sampleTargets.get(sampleId).requiredAnalyses;
'''
normal=text.replace('\r\n','\n');assert normal.count(old)==1;normal=normal.replace(old,new)
legacyimpact=legacy[legacy.index('function impact(db) {'):legacy.index('\nfunction snapshot(db, prior = null)')].strip()+'\n'
fixture=R/'server/tests/fixtures/order_revision_impact_before_set_query.txt';assert not fixture.exists();fixture.write_bytes(legacyimpact.encode())
p.write_bytes(normal.encode())
(D/'source-preparation-record.json').write_text(json.dumps({'status':'SOURCE_ONLY_DRAFT_NO_RUNTIME_PROOF','scopeDirection':6189025975,'changedPath':p.relative_to(R).as_posix(),'beforeSha256':hashlib.sha256(before).hexdigest(),'afterSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'legacyImpactFixturePath':fixture.relative_to(R).as_posix(),'legacyImpactSha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'productionOperations':0,'sameOwnerFieldsAndIterationOrder':True,'leftJoinPreservesMissingSampleFailure':True},indent=2),encoding='utf-8')
print(json.dumps({'status':'SOURCE_QUERY_DRAFT_PREPARED','newRuntimeProof':False,'productionOperations':0}))
