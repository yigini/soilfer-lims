"""Retain one closed refusal and bounded metadata diagnostic without mutation or replay."""
import base64,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';DEST=SOURCE/'first-proof-023000-closed-reserve-stop'
assert not DEST.exists();DEST.mkdir()
script=REPO/'WP/backlog-resume-20261013/read-closed-023000-reserve-evidence-remote-once.py'
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script.read_bytes(),capture_output=True,timeout=55)
with (DEST/'stdout-original.json').open('xb') as f:f.write(r.stdout)
with (DEST/'stderr-original.log').open('xb') as f:f.write(r.stderr)
assert r.returncode==0,'Retain original diagnostic refusal; never replay'
sys.path.insert(0,str(SOURCE));from proof_contract import exact_json,canonical,sha
value=exact_json(r.stdout)
for row in value['files']:
    rel=pathlib.PurePosixPath(row['path']);assert not rel.is_absolute() and '..' not in rel.parts
    raw=base64.b64decode(row.pop('data'));assert len(raw)==row['bytes'] and sha(raw)==row['sha256']
    p=DEST/'remote-originals'/str(rel);p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('xb') as f:f.write(raw)
with (DEST/'closed-retention-record.json').open('xb') as f:f.write(canonical(value)+b'\n')
print(json.dumps({k:value[k] for k in ['status','observedUtc','originalRefusal','systemctlOriginal','postFailureMetadataOnly','newOwnedContainers','allHistoricalStoppedContainersPreserved']}))
