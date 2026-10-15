"""Retain closed originals once; read-only host operations, no SQL or consumed execution."""
import base64,datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-snapshot-handoff-cde8-20261015';DEST=SOURCE/'first-proof-070000-closed-repeat-identity-stop'
assert not DEST.exists();DEST.mkdir()
script=REPO/'WP/backlog-resume-20261013/read-070000-closed-repeat-identity-stop-readonly-once.py'
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script.read_bytes(),capture_output=True,timeout=180)
with (DEST/'stdout-original.json').open('xb') as f:f.write(r.stdout)
with (DEST/'stderr-original.log').open('xb') as f:f.write(r.stderr)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:json.dump({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readonlyRetainer':True,'proofReplays':0},f)
assert r.returncode==0,'Retain original diagnostic refusal; never replay'
sys.path.insert(0,str(SOURCE));from proof_contract import exact_json,canonical,sha
value=exact_json(r.stdout)
for row in value['artifacts']:
    rel=pathlib.PurePosixPath(row['path']);assert not rel.is_absolute() and '..' not in rel.parts
    raw=base64.b64decode(row.pop('data'));assert len(raw)==row['bytes'] and sha(raw)==row['sha256']
    p=DEST/'remote-originals'/str(rel);p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('xb') as f:f.write(raw)
with (DEST/'closed-retention-record.json').open('xb') as f:f.write(canonical(value)+b'\n')
print(json.dumps({k:value[k] for k in ['status','observedUtc','originalRefusal','rootFileCount','rootPhysicalAllocatedBytes','selectedOriginalContentBytes','allHistoricalStoppedContainersPreserved','currentFreeBytes','actualBaseline','installed206Seal','preservation206','actualRepeat206Result','currentClosedTargetTripleNotOriginalComparisonSample','normalPredecessorSelectedDerived']}))
