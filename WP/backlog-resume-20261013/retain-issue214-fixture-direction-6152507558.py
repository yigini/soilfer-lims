import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];dest=Path(__file__).parent/'issue214-fixture-direction-6152507558'
assert not dest.exists();dest.mkdir()
files={'answer-actual-raw.json':'repos/yigini/soilfer-lims/issues/comments/6152507558','question-actual-raw.json':'repos/yigini/soilfer-lims/issues/comments/6152478199','issue214-current-raw.json':'repos/yigini/soilfer-lims/issues/214'}
for name,endpoint in files.items(): (dest/name).write_bytes(subprocess.check_output(['gh','api',endpoint],cwd=root))
answer=json.loads((dest/'answer-actual-raw.json').read_bytes())
assert answer['performed_via_github_app']['slug']=='claude' and answer['created_at']=='2026-10-13T18:35:16Z'
for phrase in ['yes, with conditions','ordinary policy override path','Every stock assertion stays byte-identical','no override','read-only dry run']:
 assert phrase in answer['body'],phrase
(dest/'answer-actual.txt').write_bytes((answer['body']+'\n').encode())
record={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'ACTUAL_CLAUDIO_FIXTURE_CONTEXT_AND_OPERATIONAL_DIRECTION','answer':6152507558,'question':6152478199,'productionOperations':0,'apply103':False,'files':{}}
for p in dest.iterdir():
 raw=p.read_bytes();record['files'][p.name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode());print(json.dumps({k:v for k,v in record.items() if k!='files'}))
