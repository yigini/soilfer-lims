"""Preserve the local publication refusal and create a new metadata-exact successor."""
import datetime,hashlib,json,pathlib
W=pathlib.Path(__file__).resolve().parents[2];H=W/'WP/backlog-resume-20261013';B=W/'WP/jobs-row-diagnostic-private-be837974-20261016'
old=H/'publish-private-diagnostic023000-first-opening-once.py';new=H/'publish-private-diagnostic023000-complete-opening-once.py';D=B/'first-opening-local-pin-path-refusal-once'
assert not new.exists() and not D.exists() and not (B/'first-diagnostic023000-opening-publication-once').exists()
raw=old.read_bytes();text=raw.decode()
needle=" for k,v in pin.items():require(observed[n][k]==v,'Runtime input pin differs')"
assert text.count(needle)==1
text=text.replace(needle," require(pin['path']==n,'Exact selected path pin differs')\n for k,v in pin.items():\n  if k!='path':require(observed[n][k]==v,'Runtime input pin differs')")
text=text.replace("D=B/'first-diagnostic023000-opening-publication-once'","D=B/'first-diagnostic023000-complete-opening-publication-once'")
needle2="paths=sorted([p for folder in [O,L,E,D] for p in folder.rglob('*') if p.is_file()])+helpers+readmes"
assert text.count(needle2)==1
text=text.replace(needle2,"paths=sorted([p for folder in [O,L,E,D,B/'first-opening-local-pin-path-refusal-once'] for p in folder.rglob('*') if p.is_file()])+helpers+readmes+[W/'WP/backlog-resume-20261013/publish-private-diagnostic023000-first-opening-once.py',W/'WP/backlog-resume-20261013/prepare-private-diagnostic-opening-pin-complete-successor-once.py']")
compile(text,str(new),'exec');D.mkdir()
note={'recordedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'LOCAL_PUBLICATION_PIN_PATH_FIELD_REFUSAL_BEFORE_OUTPUT_STAGE_COMMIT_OR_HOST','originalHelper':old.relative_to(W).as_posix(),'originalHelperSha256':hashlib.sha256(raw).hexdigest(),'actualSession':21646,'exitCode':1,'actualError':"KeyError: 'path'",'reason':'Source pin includes path while runtime record uses its enclosing map key; six input data pins remain exact. New successor checks path against map key and compares every runtime pin field.','originalsUntouched':True,'reviewedSourceChanged':False,'remoteDiagnosticReplayed':False,'oldHelperMustNeverReplay':True}
with (D/'refusal-derived.json').open('xb') as f:f.write((json.dumps(note,indent=2)+'\n').encode())
with new.open('xb') as f:f.write(text.encode())
print(json.dumps({'created':new.relative_to(W).as_posix(),'originalPreserved':True,'diagnosticOperators':0}))
