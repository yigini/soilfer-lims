"""Real readonly WAL open on an owned tiny fixture, never an installer/production DB.

Retains both the expected failed readonly-mount container and successful
separate-copy container. Uses the exact committed arguments() mount/resource
code and the already retained predecessor image; no new image build/cleanup.
"""
import base64
import json
import pathlib
import re
import subprocess
import sys


def main():
    source, root, destination = sys.argv[1:]
    assert re.fullmatch('[a-f0-9]{40}', source)
    remote = pathlib.PurePosixPath(root)
    assert remote.parent == pathlib.PurePosixPath('/opt/lims/releases')
    assert re.fullmatch('instrument-import-mount-guard-[A-Za-z0-9_-]+', remote.name)
    output = pathlib.Path(destination); assert not output.exists()
    graph = {}; raw = subprocess.check_output(['git', 'show', source + ':WP/pr284-release/import_source_graph.py'])
    exec(compile(raw, '/owned-mount-graph.py', 'exec'), graph)
    files, index = graph['git_source'](source, lambda *args: subprocess.check_output(['git', *args]))
    payload = base64.b64encode(json.dumps({'root': root, 'source': source, 'index': index,
        'files': {name: base64.b64encode(value).decode() for name, value in files.items()}}).encode()).decode()
    code = '''import base64,datetime,hashlib,json,pathlib,shutil,sqlite3,subprocess,sys,time
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root']);assert not r.exists()
r.mkdir(mode=0o700)
for name,value in p['files'].items():
 raw=base64.b64decode(value);assert hashlib.sha256(raw).hexdigest()==p['index']['files'][name]['sha256']
 (r/name).write_bytes(raw);(r/name).chmod(0o400)
sys.path.insert(0,str(r));import import_installation as i
image='sha256:d4eb9b498022078b1853013f2fbbb52f42c8c903dad7d222171c9eabd419869f'
inspected=json.loads(subprocess.check_output(['docker','image','inspect',image],text=True))[0]
assert inspected['Config']['Labels']['org.opencontainers.image.revision']=='51f6798806f630773786a08432290c1b21a841da'
fixture=r/'fixture-source.db';source=sqlite3.connect(fixture)
assert source.execute('PRAGMA journal_mode=WAL').fetchone()[0]=='wal'
source.execute('CREATE TABLE mount_guard (id INTEGER PRIMARY KEY,value TEXT)');source.execute("INSERT INTO mount_guard VALUES(1,'owned-only')");source.commit()
directory=r/'import-dry-database';directory.mkdir(mode=0o700);database=directory/'dev.db'
target=sqlite3.connect(database);source.backup(target);target.close();source.close();database.chmod(0o400)
assert database.read_bytes()[18:20]==bytes([2,2])
assert not pathlib.Path(str(database)+'-wal').exists() and not pathlib.Path(str(database)+'-shm').exists()
original=r/'untouched-apply-target';original.mkdir();original_db=original/'dev.db';shutil.copyfile(database,original_db)
def physical(path):
 result={}
 for suffix in ['', '-wal','-shm']:
  f=pathlib.Path(str(path)+suffix)
  result[suffix]=None if not f.exists() else {'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size,'mtimeNs':f.stat().st_mtime_ns,'inode':f.stat().st_ino}
 return result
before=physical(original_db);main_sha=hashlib.sha256(database.read_bytes()).hexdigest();rows=[]
script="const D=require('better-sqlite3');const d=new D('/app/server/prisma/dev.db',{readonly:true});console.log(JSON.stringify({rows:d.prepare('SELECT * FROM mount_guard').all(),integrity:d.pragma('integrity_check',{simple:true}),sqliteVersion:d.prepare('select sqlite_version() as v').get().v}));d.close();"
for label,readonly in [('wal-readonly-negative',True),('wal-separate-copy-positive',False)]:
 name,owner,args=i.arguments(r,image,directory,'--dry-run',label,'/unrelated-live')
 if readonly:args[args.index('--mount')+1]+=',readonly'
 args=args[:args.index('--entrypoint')+2]+[image,'-e',script]
 start=time.monotonic();result=subprocess.run(args,capture_output=True,text=True,timeout=60);elapsed=time.monotonic()-start
 for suffix,value in [('stdout',result.stdout),('stderr',result.stderr)]:
  file=r/(label+'.'+suffix);file.write_text(value);file.chmod(0o400)
 c=json.loads(subprocess.check_output(['docker','inspect',name],text=True))[0]
 assert not c['State']['Running'] and not c['State']['OOMKilled'] and c['RestartCount']==0 and c['Image']==image
 assert c['HostConfig']['Memory']==c['HostConfig']['MemorySwap']==i.LIMIT and c['HostConfig']['NetworkMode']=='none'
 assert c['Config']['Labels']['io.soilfer.release-owned']==owner
 env=dict(value.split('=',1) for value in c['Config']['Env']);assert env['NODE_OPTIONS']==''
 mounts={value['Destination']:value for value in c['Mounts']};mount=mounts['/app/server/prisma']
 assert mount['Source']==str(directory) and mount['Type']=='bind' and mount['RW'] is (not readonly)
 if readonly:
  assert result.returncode!=0 and ('unable to open database' in result.stderr.lower() or 'readonly' in result.stderr.lower()),result.stderr
 else:
  assert result.returncode==0,result.stderr
  value=json.loads(result.stdout);assert value['rows']==[{'id':1,'value':'owned-only'}] and value['integrity']=='ok'
 assert physical(original_db)==before and hashlib.sha256(database.read_bytes()).hexdigest()==main_sha
 rows.append({'containerName':name,'readonlyMount':readonly,'exitCode':result.returncode,'elapsedSeconds':elapsed,'memoryBytes':i.LIMIT,'memorySwapBytes':i.LIMIT,'networkMode':'none','retained':True,'stdoutSha256':hashlib.sha256(result.stdout.encode()).hexdigest(),'stderrSha256':hashlib.sha256(result.stderr.encode()).hexdigest()})
after=physical(database)
assert after['']['sha256']==main_sha and (after['-wal'] is None or after['-wal']['bytes']==0)
assert after['-shm'] is None or after['-shm']['bytes']==32768
for file in directory.iterdir():file.chmod(0o400)
receipt={'status':'REAL_OWNED_WAL_MOUNT_GUARD_PASS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':p['source'],'importInstallationSha256':p['index']['files']['import_installation.py']['sha256'],'root':str(r),'image':image,'walHeader':[2,2],'mainSha256BeforeAfter':main_sha,'applyTargetPhysicalTripleUnchanged':True,'containers':rows,'readonlyOpen':value,'dryCopyPolicy':i.DRY_COPY_POLICY,'productionDatabaseAccess':False,'installerAttempts':0,'productionMutations':0,'freeBytes':shutil.disk_usage(r).free}
file=r/'mount-guard-receipt.json';file.write_text(json.dumps(receipt,indent=2));file.chmod(0o400)
print(json.dumps(receipt))
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
        'root@46.19.33.37', 'python3', '-B', '-'], input=code, text=True,
        encoding='utf-8', capture_output=True, timeout=160)
    with output.open('xb') as stream:
        stream.write((json.dumps({'returnCode': result.returncode, 'stdout': result.stdout,
            'stderr': result.stderr, 'sourceCommit': source, 'root': root}, indent=2) + '\n').encode())
    assert result.returncode == 0, result.stderr
    print(result.stdout, end='')


if __name__ == '__main__': main()
