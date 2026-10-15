"""Dispatch the approved guarded cleanup once; never replay an unknown outcome."""
import datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-approved-safe-set-cleanup-20261015';O=D/'actual-execution-once';assert not O.exists()
def cmd(*a):return subprocess.check_output(a,cwd=R)
HEAD=cmd('git','rev-parse','HEAD').decode().strip();assert cmd('git','branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==HEAD
summary=json.loads((D/'platform-guard-successor-once/summary.json').read_bytes());plan=json.loads((D/'approved-plan.json').read_bytes());source=(D/'cleanup_exact_safe_set.py').read_bytes()
assert summary['status']=='PASS' and summary['allSourceUnchanged'] and hashlib.sha256(source).hexdigest()==summary['operatorSha256'] and hashlib.sha256((D/'approved-plan.json').read_bytes()).hexdigest()==summary['planSha256']
for name in ['cleanup_exact_safe_set.py','approved-plan.json','authority-and-source-index.json']:
 assert cmd('git','show',HEAD+':'+(D/name).relative_to(R).as_posix())==(D/name).read_bytes()
v=json.loads(cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6189633644'));assert v['id']==6189633644 and v['updated_at']=='2026-10-15T10:10:04Z' and v['performed_via_github_app']['slug']=='claude' and hashlib.sha256(v['body'].encode()).hexdigest()==plan['authorityBodySha256']
native=json.loads((D/'native-approval-readonly-record.json').read_bytes());assert native['actualHumanDecision']=='Safe set only' and native['humanCardsDraftsUntouched'] if 'humanCardsDraftsUntouched' in native else native['inputActions']==0
O.mkdir();history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100&since=2026-10-15T10:10:04Z');(O/'fresh-comments-before-dispatch-original.json').write_bytes(history)
program='import json\nPLAN=json.loads('+repr(json.dumps(plan))+')\n'+source.decode('utf-8');compile(program,'actual-cleanup-program.py','exec')
(O/'actual-cleanup-program.py').write_text(program,encoding='utf-8')
(O/'dispatch-intent.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'authorityId':6189633644,'sourceCommit':HEAD,'operatorSha256':summary['operatorSha256'],'programSha256':hashlib.sha256(program.encode()).hexdigest(),'oneDispatchOnly':True,'noReplayUnknownOutcome':True},indent=2),encoding='utf-8')
p=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=program.encode(),cwd=R,capture_output=True,timeout=1200)
for name,b in [('stdout-original.json',p.stdout),('stderr-original.log',p.stderr)]:
 with (O/name).open('xb') as f:f.write(b)
(O/'exit-original.json').write_text(json.dumps({'exitCode':p.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'neverReplay':True},indent=2),encoding='utf-8')
assert p.returncode==0,'Retain actual failed or partial receipt; never replay'
receipt=json.loads(p.stdout);counts={}
for x in receipt['items']:counts[x['category']+':'+x['status']]=counts.get(x['category']+':'+x['status'],0)+1
print(json.dumps({'status':receipt['status'],'startedUtc':receipt['startedUtc'],'closedUtc':receipt['closedUtc'],'itemResults':counts,'sameContainerIds':receipt['sameContainerIds'],'observedFreeIncreaseBytes':receipt['observedFreeIncreaseBytes'],'freeAfter':receipt['dfAfter']['availableBytes']}))
