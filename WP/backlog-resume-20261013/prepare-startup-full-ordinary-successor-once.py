"""Prepare local-only physical retention and a new full ordinary runner."""
import hashlib,json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015'
p=D/'local-owned-physical-retention.setup.cjs';assert not p.exists()
source=R/'WP/backlog-resume-20261013/issue209-local-owned-physical-retention-spectral-finalizer.cjs';s=source.read_text(encoding='utf-8');old="path.join(__dirname,'issue209-')";assert s.count(old)==1;s=s.replace(old,"path.join(__dirname,'full-ordinary-once')");p.write_bytes(s.encode())
(D/'full-runner-preparation.json').write_text(json.dumps({'status':'LOCAL_FULL_RUNNER_PREPARED_NOT_DISPATCHED','localRetentionSource':source.relative_to(R).as_posix(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'newLocalSetup':p.relative_to(R).as_posix(),'newSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'onlyChange':'exact local ledger destination prefix; both ordinary setups/assertions unchanged','stockCiHasNoLocalFixtures':True},indent=2),encoding='utf-8')
print(json.dumps({'status':'FULL_LOCAL_RETENTION_PREPARED'}))
