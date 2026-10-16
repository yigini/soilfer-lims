"""Retain closed controller-forward063000 originals once, no mutation of the host or SQL/du/replay."""
import base64,datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-controller-forward-step2-be837974-20261016';DEST=SOURCE/'controller-forward063000-closed-complete-originals-once'
assert not DEST.exists();DEST.mkdir()
script=REPO/'WP/backlog-resume-20261013/read-controller-forward063000-closed-refusal-readonly-once.py'
with (DEST/'remote-reader-source.py').open('xb') as f:f.write(script.read_bytes())
with (DEST/'command-original.json').open('x',encoding='utf-8') as f:json.dump({'argv':['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()},f)
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script.read_bytes(),capture_output=True,timeout=360)
with (DEST/'stdout-original.json').open('xb') as f:f.write(r.stdout)
with (DEST/'stderr-original.log').open('xb') as f:f.write(r.stderr)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:json.dump({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readonlyRetainer':True,'proofReplays':0,'newPhysicalDuMeasurements':0},f)
assert r.returncode==0,'Retain original diagnostic refusal; never replay'
sys.path.insert(0,str(SOURCE));from proof_contract import exact_json,canonical,sha
value=exact_json(r.stdout)
for group,folder in [('artifacts','remote-originals'),('freshClosedDiagnosticArtifacts','fresh-closed-diagnostics')]:
 for row in value[group]:
    rel=pathlib.PurePosixPath(row['path']);assert not rel.is_absolute() and '..' not in rel.parts
    raw=base64.b64decode(row.pop('data'));assert len(raw)==row['bytes'] and sha(raw)==row['sha256']
    p=DEST/folder/str(rel);p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('xb') as f:f.write(raw)
with (DEST/'closed-retention-record.json').open('xb') as f:f.write(canonical(value)+b'\n')
print(json.dumps({k:value[k] for k in ['status','observedUtc','originalTerminalName','producerRecordedSuccess','packageFileCount','rootFileCount','rootPhysicalAllocatedBytes','selectedOriginalContentBytes','allHistoricalStoppedContainersPreserved','currentFreeBytes']}))
print(json.dumps({'ownedStoppedContainers':len(value['newOwnedContainersStoppedRetained']),'bothOwnedActuallyStopped':value['bothOwnedActuallyStopped'],'privateFileBytesFetched':value['privateFileBytesFetched'],'closedStates':{k:{n:v.get(n) for n in ['Status','Running','OOMKilled','ExitCode','StartedAt','FinishedAt']} for k,v in value['newOwnedContainerClosedStates'].items()},'artifactCount':len(value['artifacts']),'freshDiagnosticCount':len(value['freshClosedDiagnosticArtifacts'])}))
