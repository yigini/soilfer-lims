"""Freeze only the newly passed forward proof and its exact raw Git source."""
import json, pathlib, shutil, sys
import release_support as s
import startup_common as c
import gates

def main():
    proof=pathlib.Path(__file__).resolve().parent;target=pathlib.Path(sys.argv[1])
    assert target.parent==pathlib.Path('/opt/lims/releases') and target.name.startswith('forward-ae64f169-release-')
    assert not target.exists(), 'Never overwrite a freeze'
    receipt=json.loads((proof/'rehearsal-receipt.json').read_bytes())
    assert receipt['status']=='PASSED_FORWARD_STARTUP'
    source=json.loads((proof/'kit-source-index.json').read_bytes())
    for row in source['files']:assert s.sha(proof/row['name'])==row['sha256']
    assert receipt['sourceFiles']=={p.name:s.sha(p) for p in proof.iterdir() if p.suffix in ['.py','.cjs']}
    c.writers_stopped();failed,physical=c.held_state();c.image_check()
    assert physical==receipt['productionStoppedPhysical']
    expected=json.loads((proof/'protected-state.json').read_bytes())
    assert len(expected['tables'])==104 and expected['tables']['_schema_migrations']['count']==38
    c.exact_state(s.LIVE,expected,immutable=True)
    normal=(c.ORIGIN/'apache-before.conf').read_bytes();held=s.CONF.read_bytes()
    assert b'R=503' not in normal and b'R=503' in held
    files=[row['name'] for row in source['files']]+['kit-source-index.json','protected-state.json','normal-jobs-baseline.json','rehearsal-receipt.json']
    manifest={'status':'PREPARED_FORWARD_ONLY_NOT_EXECUTED','head':s.HEAD,'image':c.IMAGE,
        'preparedUtc':s.utc(),'toolingCommit':source['head'],'proofRoot':str(proof),'originalExecutionRoot':str(c.ORIGIN),
        'originalFailureReceiptSha256':c.FAILURE_SHA,'originalManifestSha256':c.ORIGINAL_MANIFEST_SHA,
        'productionStoppedPhysical':physical,'logicalStateSha256':c.digest(expected),'deadlineSeconds':600,
        'separateInstallerCommands':0,'databaseChangesRequiredBeforeJobs':0,'jobsBoundaryCommentId':c.JOBS_BOUNDARY_COMMENT,'workloadControl':{
            'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED'},
        'files':{name:s.sha(proof/name) for name in files}}
    gates.validate_proof(proof,manifest)
    target.mkdir(mode=0o700)
    for name in files:shutil.copyfile(proof/name,target/name);(target/name).chmod(0o400)
    (target/'apache-before.conf').write_bytes(normal);(target/'apache-before.conf').chmod(0o400)
    (target/'apache-held.conf').write_bytes(held);(target/'apache-held.conf').chmod(0o400)
    for name in ['apache-before.conf','apache-held.conf']:manifest['files'][name]=s.sha(target/name)
    c.write_new(target/'prepared-manifest.json',manifest)
    assert s.sha(proof/'rehearsal-receipt.json')==manifest['files']['rehearsal-receipt.json']
    print(json.dumps({'status':manifest['status'],'root':str(target),'manifestSha256':s.sha(target/'prepared-manifest.json'),
        'coordinatorSha256':manifest['files']['startup-forward.py'],'receiptSha256':manifest['files']['rehearsal-receipt.json'],
        'sharedReadinessSha256':manifest['files']['startup_common.py'],'fileCount':len(manifest['files'])}),flush=True)

if __name__=='__main__':main()
