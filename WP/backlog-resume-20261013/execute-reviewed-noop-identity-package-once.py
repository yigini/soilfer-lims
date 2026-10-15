"""One approved local package preparation only; no production copy or SSH launch."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-noop-identity-cde8-20261015';DEST=SOURCE/'first-proof-050000-package-once'
require=lambda ok,m:None if ok else (_ for _ in ()).throw(RuntimeError(m))
require(not DEST.exists(),'Package boundary consumed');DEST.mkdir()
intent={'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':'09d7e537d90bc8ed17e9d162fd6868a7c34a8e15','actualSourcePass':6183890910,'scope':'LOCAL_APPROVED_PACKAGE_ONLY','neverReplay':True,'productionCopies':0}
(DEST/'intent.json').write_text(json.dumps(intent,indent=2)+'\n',encoding='utf-8')
args=[sys.executable,'-X','utf8','-B',str(SOURCE/'prepare_proof.py'),'--tooling-commit',intent['toolingCommit'],'--source-review-id',str(intent['actualSourcePass'])]
r=subprocess.run(args,cwd=REPO,capture_output=True,timeout=180)
(DEST/'stdout-original.json').write_bytes(r.stdout);(DEST/'stderr-original.log').write_bytes(r.stderr)
(DEST/'exit-original.json').write_text(json.dumps({**intent,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'productionCopies':0},indent=2)+'\n',encoding='utf-8')
require(r.returncode==0,'Retain original preparation refusal; never replay');print(r.stdout.decode())
