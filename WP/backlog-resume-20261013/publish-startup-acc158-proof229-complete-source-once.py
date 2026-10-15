"""Publish complete source and evidence only. No proof operator."""
import ast,datetime,hashlib,json,pathlib,subprocess,sys
repo=pathlib.Path(__file__).resolve().parents[2];source=repo/'WP/batch-proof-startup-be837974-20261015';sys.path.insert(0,str(source))
from proof_contract import *
from proof_app_sources import APP_PINS,validate_sources
import prepare_proof
def git(*args,input=None):return subprocess.check_output(['git','-c','core.longpaths=true','-c','core.autocrlf=false',*args],cwd=repo,input=input)
base=git('rev-parse','HEAD').decode().strip();branch=git('branch','--show-current').decode().strip()
assert base=='773c334bbf035fe200b3b6b908574feb099b7aa9' and branch=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
record=exact_json((source/'source-local-host229-complete-once/exit-original.json').read_bytes());assert record['status']=='PASS' and record['localExitCode']==record['hostExitCode']==0 and record['sourceUnchanged'] and record['expectedTests']==229
expected=record['sourceSha256After'];assert set(expected)==FILES and expected=={n:sha((source/n).read_bytes()) for n in FILES}
host=exact_json((source/'source-local-host229-complete-once/host-stdout-original.json').read_bytes());assert host['testsRun']==229 and host['status']=='PASS' and host['sourceSha256']==expected and host['sourceFilesWritten']==host['actualDockerCalls']==host['productionSqliteConnections']==0
freeze=exact_json((repo/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(freeze)==1333
for n,d in freeze.items():assert sha((repo/n).read_bytes())==d,'Frozen application changed '+n
raws={n:(source/'application-source-fixtures'/n).read_bytes() for n in APP_PINS};manifest=exact_json((source/'new-authority-fixtures/source-index.json').read_bytes());derivation=validate_sources(raws,{r['path']:r for r in manifest['entries']})
assert sha((source/'new-authority-fixtures/source-index.json').read_bytes())=='c7ee2de3e0cbad7aad9be99b8a74f5ddc070f033b70b9595b7f7c754e99156db'
post=exact_json((source/'post-reboot-readonly-preflight-once/stdout-original.json').read_bytes())
for key in ['lsblk','df','findmnt','dockerPs']:assert post[key]['exitCode']==0 and not post[key]['stderr']
devices=exact_json(post['lsblk']['stdout'])['blockdevices'];disk=next(d for d in devices if d['name']=='vda');assert disk['type']=='disk' and disk['size']==343597383680 and len(disk['children'])==1
part=disk['children'][0];assert part['path']=='/dev/vda1' and part['type']=='part' and part['fstype']=='ext4' and part['size']>343000000000 and part['mountpoints']==['/']
for line in post['df']['stdout'].splitlines()[1:]:
    f=line.split();assert f[0]=='/dev/vda1' and f[1]=='ext4' and int(f[2])==338094891008 and int(f[4])==109582163968
for v in post['production']:
    assert v['id']==PREDECESSOR_ID and v['image']==PREDECESSOR_IMAGE and v['revision']==PREDECESSOR and v['state']['Running'] and v['state']['Health']['Status']=='healthy' and not v['state']['OOMKilled'] and not v['state'].get('Restarting') and not v['state'].get('Dead') and v['restartCount']==0 and v['http']['exitCode']==0 and exact_json(v['http']['stdout'])['status']==200
    assert v['memory']==MEMORY and v['swap']==1610612736 and v['flags']=={'NODE_OPTIONS':'','DISABLE_BACKGROUND_JOBS':'false','ALLOW_PRISMA_DB_PUSH':'false','ALLOW_AUTO_SEED':'false'}
r4=exact_json((source/'post-reboot-r4-stat-reference-once/independent-derived-validation.json').read_bytes());assert r4['newRootAbsent'] and r4['newUnitUnused'] and r4['operations']==0
fresh=source/'fresh-source-publication-authorities-once';assert not fresh.exists();fresh.mkdir();calls=[];original_command=prepare_proof.command
def capture(*args):
    raw=original_command(*args)
    if args[0]=='gh':
        name='api-'+str(len(calls)+1).zfill(3)+'-original.json';(fresh/name).write_bytes(raw);calls.append({'path':name,'argv':list(args),'bytes':len(raw),'sha256':sha(raw)})
    return raw
prepare_proof.command=capture;evidence=prepare_proof.current_evidence()
(fresh/'current-evidence-derived.json').write_bytes(canonical(evidence)+b'\n')
issue=prepare_proof.gh('repos/yigini/soilfer-lims/issues/191');assert issue['state']=='closed'
(fresh/'api-command-index.json').write_bytes(canonical(calls)+b'\n')
def batch(refs):
    output=git('cat-file','--batch',input=('\n'.join(refs)+'\n').encode());offset=0;values=[]
    for ref in refs:
        end=output.index(b'\n',offset);oid,kind,size=output[offset:end].decode().split();size=int(size);offset=end+1;b=output[offset:offset+size];offset+=size
        assert kind=='blob' and len(b)==size and output[offset:offset+1]==b'\n' and hashlib.sha1(('blob '+str(size)+'\0').encode()+b).hexdigest()==oid;offset+=1;values.append((oid,b))
    assert offset==len(output);return values
oldnames=[p.name for p in (source/'source-preparation-before').iterdir()]
for name,(oid,b) in zip(oldnames,batch(['a748b9dc5d3e5309fe3ef2b5cf4a6c5e7d796ef2:WP/batch-proof-health-transitions-cde8-20261015/'+n for n in oldnames])):assert b==(source/'source-preparation-before'/name).read_bytes()
assert expected=={n:sha((source/n).read_bytes()) for n in FILES}
for n,d in freeze.items():assert sha((repo/n).read_bytes())==d
readme="""# New acc158/cd3a startup proof source — 2026-10-15

Complete14-file source graph. 229 local +229 ACTUAL-host Python3.9.23 guards PASS; all14 source hashes unchanged. Host sources loaded in memory, only retained synthetic fixtures written, zero real Docker/cache/production SQLite/operator calls. Original217 run retained216PASS+1obsolete hardware fixture error; corrected223local and complete229both successors preserved.

Qualified application be8379745bdfae52ce46496ff26514dc7d729640/tree676b01e71211786d1aeace50f19a0b2c9f9c482e; image acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a/414683521B. Original0400 receipt cd3a2757d8ecb0bf933f49231031eb7fb61eb5abaac17d05f3585c1baaf89f0a, status NEW_STARTUP_APP_IMAGE_BUILT_NOT_PROVED_OR_DEPLOYED; source4de3e334d8e498783a4cf20df4a5f93acfdbeb21/PASS6200145007/evidence5f86a1966af536f83a345ebdb02983bbe2a166ad; app index c7ee2de3e0cbad7aad9be99b8a74f5ddc070f033b70b9595b7f7c754e99156db.

Historical080000 installed209 inputs keep separate cde8/tree638/B5 authority.20 bound raw records, every retained raw/reader/backup hash-stat identity and070000 assets remain protected. No historical SQLite connection, new production snapshot or installer/policy replay. Scope: two ordinary jobs-OFF startups from accepted installed209 inputs; later jobs-ON proof, exact-kit audit, fresh single-use gate and deployment still required.

457 raw-Git application files bind all26READY scripts, all entrypoint CLI/migration scripts, utilities/context and literal relative dependencies. Conservative maximum per startup:4entrypoint+4READY policy snapshots, never assume cache hit. Python clone1+seal triples2+backup1+policy8=12;two startupsN24->30equivalents with25% margin. Two asset copies/3xasset reserve,89556B schema per startup, seed/secret markers,32directory blocks per startup including7pinnedassetdirs are explicit. Scope-specific dropped64minimum remains explicit for new review. Stage copy maxima/remaining-budget/physical-growth caps/full science/refusal/hash/race guards/600s/805306368B unchanged.

Fresh R4 includes ADDITIONAL10000000000B plus existing10556150894floor,4GiBlogs,copy/assets/fixedfiles. Exact rounded package lengths+2MiB directory reserve charged BEFORE ROOT; already occupied before UNIT/runtime so never double counted. All3canonical paths/allancestors/device/integerstatvfs/4096blocks guarded, sameFSfree never added. All actual remote capacity/preflight/create/unit templates use one-pass whole-token rendering and compile BEFORE ANYSSH. One proof attempt/no retry.

Actual6202483884 held server during YYreboot;6202595120 relayed YYback/resume,6202615241 conditional existing-partition/filesystem growth authority; both new comments semantically pinned. Fresh21:29:30UTC read-only checks show disk343597383680B(320GiB), existing ext4/dev/vda1 filesystem338094891008B/free109582163968B. Three production samples healthy/HTTP200/restarts0; new startedAt21:20:08.458770409Z is the observed reboot start, not our restart. Space already visible: NOgrowpart/resize2fs/xfs_growfs/host mutation performed.

Fresh21:32:31 stat-only reference required41768863854B INCLUDING10GB, EXCLUDING future unprepared exactpackage; free109577981952B at each SAMEFS path/notadditive. Proposed230000root absent/unitnot-found. This reference is NOT launch authority. NEW exact-source PASS, fresh all current authority/1333application/source hashes, unused root/unit and fresh exact-package R4 BEFORE ROOT/UNIT/runtime copies remain mandatory.

R2 COMPLETE: actualCl6202252017 accepted8badd08/c9e4e8ba;zero removed/cache unchanged/no reclaim credit/NOmoreR2. Bundle acceptance ACK only in this next concrete new source handoff.

Operators prepare_proof/launch_proof/run_stopped_proof UNEXECUTED outside imports/compile/closed fake guards. No package/upload/proof root/unit/default startup/cleanup/deployment. Proposed /opt/lims/releases/workflow-batch-startup-be837974-20261015T230000Z and unit lims-workflow-batch-startup-be837974-20261015t230000z. Actual new source review still required; old passes authorize nothing. Main merges held until be deployment+actualClpostcheck. No app edits/newagents/chats/worktrees/concurrent writer.

"""
(source/'README.md').write_text(readme,encoding='utf-8')
lead="""LATEST SOURCE CHECKPOINT — 2026-10-15 21:34 UTC. COMPLETE NEW14-file acc158/cd3a-bound startup graph WP/batch-proof-startup-be837974-20261015/README.md;229LOCAL+229ACTUALhostPython3.9.23 guards PASS/14hashunchanged/hostinmemory/0realDocker-cache-productionSQLite/operator. Original217fixtureerror+223local preserved. SPLITold080000cde8/tree638/B5INPUTauthority fromNEWbe/tree676/acc158.457apprawGitpins/all26READY+allCLI/context/closeddependencies;conservative8policy snapshots/start/N24->30equiv+schema89556/markers/32dirs+7assetsdirs/packagefuture/ADDITIONAL10GB/realpath-device4096integerstatvfs/nonadditivephasedgates;ALLactualremote templates collision-safe rendercompileBEFORESSH/ONEattemptNORETRY. ACTUAL6202483884 serverhold supersededby6202595120YYback/resume+6202615241conditionalgrow FULLREAD. Fresh21:29 readonly disk343597383680B/existingext4FS338094891008B/free109582163968B/prod3healthyHTTP200/restarts0. SpaceALREADYvisible/NOgrowpart-resize2fs-xfs_growfs-hostchange. Fresh21:32STATONLYnewR4ref req41768863854B INCLUDING10GB EXCLUDINGfutureunpreparedexactpackage vsfree109577981952B EACH SAMEFS/notadditive;230000rootABSENT/unitnot-found. ReferenceNOTlaunchauthority. NEWexactall14hashClSourcePASS stillREQUIRED plusfreshcurrentmainCI4audits6rules2postrebootpins/nolaterfailure/unusedrootunit/EXACTpackageR4beforeROOT-unit-runtime. No operationalpackage/root/unit/proof/defaultstartup/cleanup/deploy. R2accepted6202252017 COMPLETE/no moreR2/ACKbundleONLYnewsourcehandoff. MainbeMERGEHOLDuntilDEPLOYED+actualpostcheck. Allscience/history/R1-R5/humans guards remain.

"""
readmes=[repo/'WP/audit-release-eb6de2e8/README.md',repo/'WP/runtime-recovery-kobo/README.md']
for path in readmes:path.write_bytes(lead.encode()+path.read_bytes())
(source/'source-preparation-tool-output-transcriptions.json').write_bytes(canonical({'kind':'DERIVED_TOOL_OUTPUT_TRANSCRIPTIONS','events':['Local cp1252 console read failure printing Dockerfile after successful reads;no host operation','One invalid apply_patch hunk refused before helper file creation;successor created once','First217run216PASS1obsolete hardware fixture error;originals retained then223and229 successors','First publisher tool input had JS template syntax refusal BEFORE helper file creation or any execution;this successor created directly'],'notClaimedAsOriginalProcessLogs':True})+b'\n')
helpers=['prepare-startup-acc158-proof-source-complete-once.py','complete-startup-acc158-proof-authority-launcher-source-once.py','prepare-startup-acc158-proof-new-guard-tests-once.py','verify-startup-acc158-proof217-local-reboot-held-once.py','verify-startup-acc158-proof223-local-complete-once.py','read-post-reboot-resize-production-layout-once.py','bind-startup-proof-post-reboot-authorities-source-once.py','verify-startup-acc158-proof229-local-host-complete-once.py','read-startup-acc158-post-reboot-r4-stat-reference-once.py',pathlib.Path(__file__).name]
owned=[p for p in source.rglob('*') if p.is_file()];assert not any('__pycache__' in str(p) or p.suffix=='.pyc' for p in owned)
owned+=readmes+[repo/'WP/backlog-resume-20261013'/n for n in helpers]
def metadata(path):
    b=path.read_bytes();return {'path':path.relative_to(repo).as_posix(),'length':len(b),'sha256':sha(b),'gitBlobOid':hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()}
rows=[metadata(p) for p in sorted(owned,key=lambda p:p.as_posix())]
indexpath=source/'source-publication-index.json';assert not indexpath.exists()
index={'status':'COMPLETE_NEW_PROOF_SOURCE_229_LOCAL_AND_ACTUAL_HOST_GUARDS_NOT_PROOF_EXECUTION','baseAudit':base,'sourceFiles':{n:metadata(source/n) for n in sorted(FILES)},'applicationSourceFiles':len(APP_PINS),'applicationCopyDerivation':derivation,'sourceHashesUnchangedFromBothTests':True,'localActualHostGuards':229,'hostPython':'3.9.23','all1333ApplicationInputsUnchanged':True,'postRebootHostChangePerformed':False,'actualReferenceRequiredBytes':r4['requiredExcludingFuturePackageBytes'],'futureExactPackageR4StillRequired':True,'files':rows}
indexpath.write_bytes(canonical(index)+b'\n');owned.append(indexpath);rows.append(metadata(indexpath))
assert not git('diff','--cached','--name-only') and git('rev-parse','HEAD').decode().strip()==base
paths=[p.relative_to(repo).as_posix() for p in owned]
for i in range(0,len(paths),20):git('add','-f','--',*paths[i:i+20])
staged=set(git('diff','--cached','--name-only','-z').decode().split('\0'))-{''};assert staged==set(paths),'Staged inventory differs'
for row,(oid,b) in zip(rows,batch([':'+x['path'] for x in rows])):assert oid==row['gitBlobOid'] and len(b)==row['length'] and sha(b)==row['sha256'],'Raw staged bytes differ '+row['path']
git('commit','-m','audit: publish acc158 startup proof source and229 guard evidence')
head=git('rev-parse','HEAD').decode().strip()
for row,(oid,b) in zip(rows,batch([head+':'+x['path'] for x in rows])):assert oid==row['gitBlobOid'] and len(b)==row['length'] and sha(b)==row['sha256']
git('push','origin','HEAD:refs/heads/'+branch)
remote=git('ls-remote','origin','refs/heads/'+branch).decode().split()[0];assert remote==head and not git('diff','--cached','--name-only')
print(json.dumps({'status':'PUBLISHED_COMPLETE_NEW_SOURCE','head':head,'filesVerifiedOidShaLength':len(rows),'applicationSources':len(APP_PINS),'sourceFiles':len(FILES),'localTests':229,'actualHostTests':229,'branch':branch,'operatorsExecuted':0,'newSourceReviewStillRequired':True}))

