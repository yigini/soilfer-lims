"""One metadata/du capture, no new host root/files or production operation."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2];DEST=REPO/'WP/batch-proof-forward-resume-cde8-20261015/yy-disk-breakdown-6186928334-once'
assert not DEST.exists();DEST.mkdir()
script=REPO/'WP/backlog-resume-20261013/read-yy-disk-breakdown-6186928334-readonly-once.py'
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=script.read_bytes(),capture_output=True,timeout=2400)
for name,raw in [('stdout-original.json',r.stdout),('stderr-original.log',r.stderr),('collector-source.py',script.read_bytes())]:
 with (DEST/name).open('xb') as f:f.write(raw)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:json.dump({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readonlyMetadataAndDuOnly':True,'neverReplay':True},f)
assert r.returncode==0,'Inspect retained original failure; never replay'
v=json.loads(r.stdout);print(json.dumps({'status':v['status'],'closedUtc':v['closedUtc'],'rootCount':len(v['releaseRootMetadata']),'commands':[{'label':x['label'],'exitCode':x['exitCode'],'error':x['error'],'elapsedSeconds':x['elapsedSeconds']} for x in v['commands']]}))
