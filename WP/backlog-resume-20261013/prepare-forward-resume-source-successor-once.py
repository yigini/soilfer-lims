"""Prepare genuinely NEW local source only from raw68633 Git; no operators."""
import pathlib,json,sys
REPO=pathlib.Path(__file__).resolve().parents[2];OLD=REPO/'WP/batch-proof-snapshot-handoff-cde8-20261015';NEW=REPO/'WP/batch-proof-forward-resume-cde8-20261015'
sys.path.insert(0,str(OLD));from proof_contract import FILES,require,canonical
from prepare_proof import raw_git
require(not NEW.exists(),'Successor source preparation consumed');raws={};index={}
for n in sorted(FILES):raws[n],index[n]=raw_git('68633fdd8322243a63b0135f3899963525af7fad','WP/batch-proof-snapshot-handoff-cde8-20261015/'+n)
NEW.mkdir()
for n,raw in raws.items():
    with (NEW/n).open('xb') as f:f.write(raw)
with (NEW/'predecessor-source-index.json').open('xb') as f:f.write(canonical({'sourceCommit':'68633fdd8322243a63b0135f3899963525af7fad','files':index,'scope':'NEW_LOCAL_FORWARD_SOURCE_PREPARATION_ONLY','operatorsExecuted':0,'newRootCreated':False})+b'\n')
print(json.dumps({'status':'NEW_LOCAL_SOURCE_PREPARED_NOT_APPROVED_OR_EXECUTED','folder':str(NEW),'predecessorFiles':len(raws)}))
