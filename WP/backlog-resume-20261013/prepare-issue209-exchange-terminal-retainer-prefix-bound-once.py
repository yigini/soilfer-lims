"""Unique successor: account for filenames already changed by the context prefix, once."""
import datetime,hashlib,json,sys
from pathlib import Path
wp=Path(__file__).parent;target=wp/'retain-issue209-exchange-spectral-context-terminal-once.py';assert not target.exists()
prior=wp/'prepare-issue209-exchange-terminal-retainer-once.py';s=prior.read_text(encoding='utf8')
for part in ["'prepare-issue209-governance-reason-sync-context-once.py':'prepare-issue209-exchange-spectral-context-once.py',","'verify-issue209-governance-reason-sync-context-singles-once.py':'verify-issue209-exchange-spectral-context-singles-once.py',"]:
 assert s.count(part)==1;s=s.replace(part,'',1)
s=s.replace("'prepare-issue209-governance-terminal-retainer-once.py':'prepare-issue209-exchange-terminal-retainer-once.py'","'prepare-issue209-governance-terminal-retainer-once.py':'prepare-issue209-exchange-terminal-retainer-prefix-bound-once.py'")
sys.stdout.reconfigure(encoding='utf8');exec(compile(s,str(__file__),'exec'))
# Preserve the original refused preparer and record its pre-write refusal.
generated=target.read_text(encoding='utf8');anchor="assert all((root / p).exists() for p in owned)"
assert generated.count(anchor)==1;generated=generated.replace(anchor,"owned.append((wp / 'prepare-issue209-exchange-terminal-retainer-once.py').relative_to(root).as_posix())\n"+anchor,1)
target.write_bytes(generated.encode())
record=wp/'issue209-exchange-spectral-context-review/retainer-preparer-refusal-record.json';assert not record.exists()
record.write_bytes((json.dumps({'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'originalHelper':prior.name,'originalHelperSha256':hashlib.sha256(prior.read_bytes()).hexdigest(),'originalExit':1,'refusal':'Expected old prepare filename after context-prefix substitution had already renamed it','originalOutputRetainerWritten':False,'testsStartedByPreparer':False,'oldHelperPreserved':True,'uniqueSuccessor':Path(__file__).name,'productionOperations':0},indent=2)+'\n').encode())
