"""Retain and independently validate the actual exact startup Source PASS. No SSH."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2]
REL='WP/batch-proof-memory-events-be837974-20261015/'
S=R/REL;D=S/'actual-source-pass6203833517-once'
BASE='51d24a1668ca0f645fcaa6f759c1119f2002c324'
TOOLING='dd14f90814b7994bf06598623dae095b29d04f0b'
sys.path.insert(0,str(S))
from proof_contract import *
import prepare_proof as prep
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one retention required')
index=exact_json((S/'exact-source-review270-once/tooling-source-index.json').read_bytes())
require(index['head']==TOOLING and len(tokens(index))==125,'Exact source graph and125 bindings required')
pubraw=git('show',TOOLING+':'+REL+'source-publication-index270.json');pub=exact_json(pubraw)
require(len(pub['files'])==686,'686 indexed bindings plus index and3completionrecords required')
raws=prep.raw_git_many(TOOLING,[r['path'] for r in pub['files']])
for row in pub['files']:
    raw=raws[row['path']]
    require(len(raw)==row['length'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlobOid'],'Published original identity differs '+row['path'])
completionraw,completionmeta=prep.raw_git(TOOLING,REL+'source270-publication-completion-index.json')
completion=exact_json(completionraw)
require(len(completion['files'])==2 and completion['sourceIndexPath']==REL+'source-publication-index270.json' and completion['sourceIndexSha256']==sha(pubraw),'Completion index binding differs')
completionraws=prep.raw_git_many(TOOLING,[r['path'] for r in completion['files']])
for row in completion['files']:
    raw=completionraws[row['path']]
    require(len(raw)==row['length'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlobOid'],'Completion original identity differs '+row['path'])
require(len(raws)+1+len(completionraws)+1==690,'Complete690sourceoriginals required')
for n,pin in index['files'].items():
    raw=raws[REL+n]
    require(raw==(S/n).read_bytes() and len(raw)==pin['bytes'] and sha(raw)==pin['sha256'] and oid(raw)==pin['blob'],'Reviewed source changed '+n)
frozen=exact_json((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Application input changed '+p)
captures=[];original=prep.command
def capture(*args):
    raw=original(*args)
    if args[:2]==('gh','api'):captures.append((list(args),raw))
    return raw
prep.command=capture
review_raw=capture('gh','api','repos/yigini/soilfer-lims/issues/comments/6203833517')
review=exact_json(review_raw);approval(review,index)
require(review['id']==6203833517 and review['created_at']=='2026-10-15T22:45:11Z','Actual new review identity differs')
evidence=prep.current_evidence(review,index)
issue191=exact_json(capture('gh','api','repos/yigini/soilfer-lims/issues/191'))
require(issue191['state']=='closed','Historical issue191 changed')
receipt=prep.raw_git(BUILD_EVIDENCE,prep.BUILD_REL+'build-receipt.json')[0]
inspection=prep.raw_git(BUILD_EVIDENCE,prep.BUILD_REL+'image-inspect-original.json')[0]
qualified(exact_json(receipt),receipt,exact_json(inspection)[0])
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
save('actual-source-pass-original.json',review_raw)
save('actual-source-pass-readable.txt',review['body'].encode())
save('tooling-source-index.json',canonical(index)+b'\n')
save('source-publication-index270-original.json',pubraw)
save('source270-publication-completion-index-original.json',completionraw)
for row in completion['files']:save('completion-original-'+pathlib.Path(row['path']).name,completionraws[row['path']])
save('current-authority-evidence.json',canonical(evidence)+b'\n')
for i,(_,raw) in enumerate(captures):save('api-original-'+str(i).zfill(2)+'.json',raw)
save('api-command-index.json',canonical([{'file':'api-original-'+str(i).zfill(2)+'.json','argv':argv,'length':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)} for i,(argv,raw) in enumerate(captures)])+b'\n')
record={'status':'ACTUAL_NEW_EXACT_STARTUP_SOURCE_PASS_VALIDATED_NOT_EXECUTED','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':TOOLING,'sourceReviewId':review['id'],'reviewCreatedUtc':review['created_at'],'all15SourceHashes':graph(index),'literalBindings':len(tokens(index)),'all690SourcePublicationOriginalsVerified':True,'sourcePublicationIndexSha256':sha(pubraw),'all1333ApplicationInputsUnchanged':True,'currentMainCiFourAuditsSixRulesTwoPostRebootPinsNewMemoryDirectionAndR2AcceptedVerified':True,'completeSourceOriginalCount':690,'memoryDirection':6203416404,'qualifiedBuildReceiptSha256':sha(receipt),'scope':SCOPE,'root':str(ROOT),'proofAttemptsAllowed':1,'retryAllowed':False,'operationalPackageNotPrepared':True,'serverOperations':0,'productionSqliteConnections':0,'jobsOnQualificationKitGateDeploymentStillRequired':True}
save('independent-pass-validation.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL SOURCE PASS — {record['verifiedUtc']}. Actual uneditedClaudeapp1236702slugclaude6203833517/{review['created_at']} FULLREAD and ownapproval validated exactdd14f90814b7994bf06598623dae095b29d04f0b/all15SHA/125literalbindings. ALL686indexedraws+index687PLUS3completionrecords690 GitOID/SHA/length independently reverified/all1333appinputsUNCHANGED/currentmainbe/mainCI38772398721attempt1pushCLOSEDSUCCESS/all4appaudits6rules2postrebootpins/newmemorydirection/R2accepted/no laterfailure verified. FullrawactualPASS/currentauthorities and independentrecord at {REL}actual-source-pass6203833517-once/publication-index.json. Scope ONE new233000 startup-only jobs-OFF proof, no retry; stillconditional fresh unusedroot/unit and EXACTpackage R4 beforeROOT/beforeUNIT/runtime. No operationalpackage/root/unit/defaultstartup yet. Next ONE approvedlocalpackage/publish/guardedlauncher. No duplicateACK/native/request; bundlePASSACKonly eventual actual result. JobsON/kit/gate/deployment notapproved. MainmergeHOLD/heartbeat2min/science/history/R1-R5/humans held.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),*readmes]
save('publication-index.json',canonical({'baseAudit':BASE,'sourceReviewId':review['id'],'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n')
paths.append(D/'publication-index.json');names=[p.relative_to(R).as_posix() for p in paths]
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain exact startup proof approval6203833517');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8')
require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'sourceReviewId':review['id'],'allLiteralBindings':125,'rawOidShaVerifiedBlobs':len(paths),'sourcePublicationOriginalsVerified':690,'serverOperations':0}))
