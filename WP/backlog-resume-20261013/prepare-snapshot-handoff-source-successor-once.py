"""Prepare only NEW local source from frozen raw624a Git; never execute operators."""
import json,pathlib,sys
REPO=pathlib.Path(__file__).resolve().parents[2];OLD=REPO/'WP/batch-proof-name-inventory-cde8-20261015';NEW=REPO/'WP/batch-proof-snapshot-handoff-cde8-20261015';HEAD='624aab7b9219bc7b9986396ce63915c91ad80502'
sys.path.insert(0,str(OLD));from proof_contract import FILES,canonical,require
from prepare_proof import raw_git
require(not NEW.exists(),'Successor source preparation consumed')
raws={};index={}
for n in sorted(FILES):raws[n],index[n]=raw_git(HEAD,'WP/batch-proof-name-inventory-cde8-20261015/'+n)
NEW.mkdir()
for n,raw in raws.items():
    if n=='proof_contract.py':raw=raw.replace(b'20261015T060000Z',b'20261015T070000Z')
    if n=='prepare_proof.py':raw=raw.replace(b'batch-proof-name-inventory-cde8-20261015',b'batch-proof-snapshot-handoff-cde8-20261015')
    with (NEW/n).open('xb') as f:f.write(raw)
with (NEW/'predecessor-source-index.json').open('xb') as f:f.write(canonical({'sourceCommit':HEAD,'files':index,'scope':'NEW_LOCAL_SOURCE_PREPARATION_ONLY','operatorsExecuted':0,'newRootCreated':False})+b'\n')
print(json.dumps({'status':'NEW_LOCAL_SOURCE_PREPARED_NOT_APPROVED_OR_EXECUTED','folder':str(NEW),'files':len(raws),'proposedRoot':'/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T070000Z'}))
