"""SOURCE ONLY: retain a new old-head raw Git startup derivation; no host action."""
import sys
sys.dont_write_bytecode=True
import pathlib,subprocess,re,posixpath
W=pathlib.Path(__file__).resolve().parents[2]
K=W/'WP/batch-release-kit-be837974-20261016'
sys.path.insert(0,str(K))
from prepare_release import raw_git
from kit_recovery_copy import HEAD,ANCILLARY,derive
from kit_contract import canonical
out=K/'predecessor-copy-source-binding.json'
assert not out.exists()
paths=set(subprocess.check_output(['git','ls-tree','-r','--name-only',HEAD],cwd=W).decode().splitlines())
base={n:r[0] for n,r in raw_git(HEAD,ANCILLARY).items()}
entry=base['docker-entrypoint.sh'].decode();index=base['server/index.js'].decode()
pending=list({'server/scripts/'+n for n in re.findall(r'^\s*node scripts/([A-Za-z0-9_]+\.js)\b',entry,re.M)}|
    {'server/scripts/'+n+'.js' for n in re.findall(r"require\(['\"]\./scripts/([^'\"]+)['\"]\)\.assert[A-Za-z]+StartupReady\(dbPath\)",index)})
seen={}
while pending:
    batch=sorted(set(pending)-set(seen));pending=[]
    if not batch:break
    values=raw_git(HEAD,batch)
    for name,(raw,_) in values.items():
        seen[name]=raw
        if not name.endswith(('.js','.cjs')):continue
        for item in re.findall(r"\brequire\(['\"]([^'\"]+)['\"]\)",raw.decode()):
            if not item.startswith('.'):continue
            basepath=posixpath.normpath(posixpath.join(posixpath.dirname(name),item))
            if basepath=='server/prisma_client':continue
            matches=[p for p in (basepath,basepath+'.js',basepath+'.cjs',basepath+'.json',basepath+'/index.js') if p in paths]
            assert len(matches)==1,(name,item,matches)
            pending.append(matches[0])
profile=derive({**base,**seen})
with out.open('xb') as stream:stream.write(canonical(profile)+b'\n')
print({'files':len(profile['files']),'roots':len(profile['startupRoots']),
    'databaseCopies':profile['maximumStartupDatabaseCopies'],'fixedBytes':profile['fixedAllocationBytesIncludingMarkersAndDirectories']})
