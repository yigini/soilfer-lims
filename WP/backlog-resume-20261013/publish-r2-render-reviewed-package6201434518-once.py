"""Publish approved corrected R2 package byte-for-byte; no SSH or cache calls."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-render-acc15844-20261015';P=S/'reviewed-r2-package-once';D=S/'reviewed-package6201434518-publication-once'
BASE='b899b8ef188a549f82a2da959712f4ddd898af8a'
sys.path.insert(0,str(S));from r2_contract import *
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one publication required')
closed=json_exact((S/'execute-reviewed-package6201434518-once/exit-original.json').read_bytes());require(closed['status']=='APPROVED_R2_LOCAL_PACKAGE_PREPARED' and closed['exitCode']==0,'Actual closed local preparation required')
files={p.name:p.read_bytes() for p in P.iterdir() if p.is_file()};spec=json_exact(files['package-input.json']);index=json_exact(files['source-index.json']);review=json_exact(files['source-review.json']);validate_package(spec,index,review,files)
require(len(files)==32 and review['id']==6201434518 and index['head']=='4eccae1525af20b4d40c7b1cbfbf6c1b931e1e97','Exact32-file corrected package required')
for n,d in graph(index).items():require(sha((S/n).read_bytes())==d,'Source changed after package')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'App input changed '+p)
D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
save('package-publication-validation.json',canonical({'status':'APPROVED_R2_PACKAGE_RAW_BYTES_VERIFIED_NOT_LAUNCHED','preparedUtc':spec['preparedUtc'],'sourceHead':index['head'],'sourceReviewId':review['id'],'packageFileCount':len(files),'packageFileHashes':{n:sha(v) for n,v in files.items()},'all1333ApplicationInputsUnchanged':True,'cacheOperations':0,'remoteRootUnitUncreated':True,'ourExistingHeartbeatNowMinutes':2,'claudioTimerUnchanged':True})+b'\n')
save('tool-preparation-refusal-transcription.txt',b'TOOL_OUTPUT_TRANSCRIPTION, not an original file/process log. An inline python -c helper-file preparation command was rejected by Python with SyntaxError: invalid syntax, before the helper file was created. Shell quoting damaged a replacement expression. The helper was then created directly through apply_patch and executed once. No package preparation, SSH, root, unit or cache operation occurred in the refused inline command.\n')
lead=f'''## 2026-10-15 corrected R2 approved package6201434518 prepared; new root not launched

ONE approved32file corrected package prepared{spec['preparedUtc']}; allrawbytes/spec/all5source/actualNEWPASS6201434518+41bindings/currentmainCI4audits6rules/qualifiedacc158cd3a/priorfailure4f7fa58a validated. Fullpackage/wrapper/rawOID+SHAindex at WP/r2-cache-cap-render-acc15844-20261015/reviewed-package6201434518-publication-once/publication-index.json. SourcePASS retained31rawb899b8ef; source4ecc/all5+1333unchanged. NEXT ONE reviewedcorrectedlauncher conditional freshauthorities/unused213000rootunit/floor. RemoteROOT/unit/cacheoperation UNCREATED atpublication; old210000graphhelpers consumed NEVERreplay/noR2retry. YYtimerfix ACTUALsameheartbeat2min now/restores10min afteractualbe837974deploy+ClpostcheckPASS; Clreported10min unchanged; no duplicateACK/native. No buildproofR1kitgatedeploy/productionconnection/mainmerge; sciencehistoryR1-R5/newproofbudgetR4+10GB/humans guards held.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in P.iterdir() if p.is_file())+sorted(p for p in (S/'execute-reviewed-package6201434518-once').iterdir() if p.is_file())+sorted(p for p in D.iterdir() if p.is_file())+[R/'WP/backlog-resume-20261013/execute-r2-render-reviewed-package6201434518-once.py',pathlib.Path(__file__),*readmes]
idx=D/'publication-index.json';save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths]
require(len(names)==len(set(names)),'Duplicate owned path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Publish exact approved corrected R2 cache package');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'audit':head,'sourceReviewId':review['id'],'packageFiles':len(files),'rawOidShaVerifiedBlobs':len(paths),'cacheOperations':0,'remoteRootUnitUncreated':True}))
