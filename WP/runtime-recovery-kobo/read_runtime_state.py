"""Read-only live runtime observation; no full env/token/payload output."""
import subprocess
import sys

code = '''import contextlib,datetime,hashlib,json,pathlib,shutil,sqlite3,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','soilfer-lims'],text=True,timeout=15))[0]
env=dict(value.split('=',1) for value in c['Config']['Env'])
r=pathlib.Path('/opt/lims/releases/forward-ae64f169-release-20261011T150800Z/production-receipt.json')
out={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'image':c['Image'],
 'running':c['State']['Running'],'health':c['State'].get('Health',{}).get('Status'),
 'restartCount':c['RestartCount'],'oomKilled':c['State']['OOMKilled'],
 'memoryLimitBytes':c['HostConfig']['Memory'],'nodeOptions':env.get('NODE_OPTIONS'),
 'jobsDisabled':env.get('DISABLE_BACKGROUND_JOBS'),'autoPush':env.get('ALLOW_PRISMA_DB_PUSH'),
 'autoSeed':env.get('ALLOW_AUTO_SEED'),
 'volumes':[{'destination':m['Destination'],'name':m.get('Name'),'type':m['Type']} for m in c['Mounts']],
 'historicalReceiptSha256':hashlib.sha256(r.read_bytes()).hexdigest(),'receiptMode':oct(r.stat().st_mode&0o777),
 'freeBytes':shutil.disk_usage('/opt/lims').free,'productionMutations':0}
response=subprocess.run(['curl','-sS','--max-time','6','-w','\\n%{http_code}',
 'https://lims.yigini.net/api/health'],text=True,capture_output=True,timeout=8)
body,_,status=response.stdout.rpartition('\\n');out['publicHttpStatus']=status
try:
 health=json.loads(body);out['publicHealth']={k:health[k] for k in ['status','version','uptime'] if k in health}
except ValueError:out['publicHealth']=None
with contextlib.closing(sqlite3.connect('file:/var/lib/docker/volumes/lims_lims-data/_data/dev.db?mode=ro',uri=True)) as db:
 db.execute('PRAGMA query_only=ON');db.execute('BEGIN')
 out['countsOnlyNotFullPreservation']={t:db.execute('SELECT count(*) FROM "'+t+'"').fetchone()[0]
  for t in ['Sample','Result','WorkAttempt','WorkItem','ReviewDecision','Report','_schema_migrations']}
print(json.dumps(out))
'''
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
    'python3', '-B', '-'], input=code, text=True, capture_output=True, timeout=40)
sys.stdout.write(result.stdout)
sys.stderr.write(result.stderr)
sys.exit(result.returncode)
