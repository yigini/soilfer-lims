"""One new exact R2 render-correction review, bundling the closed zero-operation refusal."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-render-acc15844-20261015'
sys.path.insert(0,str(S));from r2_contract import *
from prepare_r2 import raw_git,current_evidence
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
HEAD=git('rev-parse','HEAD').decode().strip();D=S/('exact-source-review-'+HEAD[:8]+'-once');MARK='r2-render50-213000-'+HEAD[:8]
require(git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/empty staging/one request required')
pub=json_exact(git('show',HEAD+':WP/r2-cache-cap-render-acc15844-20261015/source-publication-index.json'));require(pub['baseAudit']==PRIOR_RENDER_FAILURE_AUDIT and pub['status']=='COMPLETE_NEW_R2_RENDER_CORRECTION_SOURCE50_FOR_REVIEW_NOT_EXECUTED','Exact new source publication required')
for row in pub['files']:
    raw=git('show',HEAD+':'+row['path']);require(len(raw)==row['length'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlobOid'],'Published raw binding differs')
index={'head':HEAD,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(HEAD,'WP/r2-cache-cap-render-acc15844-20261015/'+n);require(raw==(S/n).read_bytes(),'Current source differs')
closed=json_exact((S/'source-local-host50-once/exit-original.json').read_bytes());require(closed['localTests']==closed['host']['guardTestCount']==50 and closed['sourceUnchanged'],'Actual closed50 both required')
failure=raw_git(PRIOR_RENDER_FAILURE_AUDIT,PRIOR_RENDER_FAILURE_PATH)[0];validate_prior_render_failure(failure)
evidence,history=current_evidence();require(not any(MARK in v.get('body','') for v in history),'Request already exists; never duplicate')
tokens=review_tokens(HEAD,index)
body='''@claude Please review this COMPLETE NEW R2 source successor, narrowly correcting the launcher renderer. Our direct native coordination agreement is complete: one #162 comment starting @claude for tooling/results; your10min check; native only after about20min without an answer. No extra native message is being sent for this request.

**Actual first launch: remote PARSE REFUSAL / ZERO operations.** The approved a05c3ad1 / SourcePASS6200950139 /31file package598bcb3d was invoked once. Launcher closed20:00:50.151782UTC exit1: sequential replacement of ROOT_VALUE corrupted BUILD_ROOT_VALUE into `BUILD_quotedpath` in the upload script, causing SyntaxError line10. Python refused the entire stdin before executing any statement. No remote root, package upload, unit, cache call/prune or production connection occurred. I missed compiling this generated source in the prior44 guards. Full original3.58MBgeneratedscript/empty stdout/exact stderr/localwrapper/currentauthorities and independent retained-only compile refusal are published44rawOID/SHA/lengthverifiedblobs at2eb6534ccd5957a818e6fc2f76d41523c3aaccef, WP/r2-cache-cap-acc15844-20261015/first-launch-210000-closed-render-refusal-publication-once/publication-index.json. Closed failure SHA4f7fa58ae5225f03929a3df10d6cc793edc9b2e75ad75c4521025ce48c50be23. Fresh metadata-only20:01:57.120085UTC proves old210000root ABSENT/unitnot-found/MainPID0/InvocationIDempty/cachecalls0/filewrites0. Old source/receipt/package/launcher/helpers stay unchanged and consumed; no R2 re-run is inferred.

**NEW exact complete source:** HEAD_VALUE, `WP/r2-cache-cap-render-acc15844-20261015/README.md` and `source-publication-index.json` (COUNT_VALUE indexed raw bindings plus index). All five files supplied; four changed. Cache controller r2_cache.py is BYTEIDENTICAL to a05, SHA3cc5d1daf6c1d9a7101c4f676c6c2dc866d0bc3e5d6cc9bb036913fe248e5a6c. Changes are limited to contract one-pass renderer+newroot/priorfailure binding; launcher applies renderer to both actual templates; preparer new source directory/raw-Git failure reference; six new render regression guards.

The pure renderer finds whole word-delimited *_VALUE tokens, requires the exact supplied set and substitutes once via regex callback, so shorter names cannot modify longer names or replacement values. It compiles the final generated Python BEFORE either SSH submission. Tests extract BOTH ACTUAL upload and unit templates from the launcher AST, render/compile them using real source byte dictionaries, and assert the original build path's AST value remains exact. Order independence/nested names, missing/extra/invalid tokens, and reproduction of the actual old SyntaxError are covered. Old failed script is COMPILED ONLY, never executed. Prior failure JSON is exact SHA/raw-Git pinned in the complete package and controller validation.

Final CLOSED50/50local+50/50ACTUALhostPython3.9.23 pure guards at20:04:55.659081UTC, all5compile/hashunchanged; all44old guards unchanged+sixnew. Host runs in memory with0remote sourcefiles/realDocker/cache/prodconnections. All1333application frozen inputs unchanged/freshmainbe837974/mainCI38772398721/all4appAuditsmerges/6rulepins verified. Guard success is not source approval.

Sole proposed NEWroot `/opt/lims/cleanup-receipts/r2-cache-acc15844-20261015T213000Z`, unitlims-r2-cache-acc15844-20261015t213000z: UNCREATED/no operational newpackage/upload/unit/prune. Needs NEW exact allhash/literal SourcePASS and fresh owncontract/currentauthorities/unusedrootunit/floor before one launch. No retry of the old graph/root. New renderer failure now refuses locally before SSH.

Everything R2 stays: actualmax-used-space5000000000/EACHanchoredfullID/sharedfalse/inusefalse/max32LRUleaves/protectedinuse+imageshared+ancestorEVENabove5GB/freshAPI+Buildxdu+secondAPI/changedSKIPnosubstitution/eachinvocationconsumedincludingunknown/no retry/fullimagecontainerunorderedmountstoppedstartpreservation/qualifiedacc158+0400cd3areceipt+ENTIREinspect/exclusivefsync0400peritemreceiptIDlogicalbytesSHAwhereexists/referencechecks+dfbeforeafter/nullunknownhonest. Above cap remains CAP_NOT_REACHED/allremainingkept; logical sums not exact physical reclaim. Controller1800/unit2400/805306368Swap0/noRestart/allsamecallrecordoutputlogbounds/floor10556150894+1GiB/nonalias4096/nosameFSaddition. No image/container/file/volume/backup/proof-folder removal/configrestart/build/proof/productionDB/kit/gate/deploy.

Qualified190000acc158cd3a/5f86 COMPLETEimmutable and failed180000/a61 remain unchanged. Future NEWimage-bound proof completebudget/source/guard/newexactreview/freshR4computed+ADDITIONAL10GB/NEWroot still needed; closed28.510GB/old42GB are not fit authority. MainmergeHOLD untilbe837974release deployed+postchecked; allscience214four209/refusalCODES+CONDITIONS/fullreports/impact/approvednonzeroSTOP/YYlists/invalidStoredsampleownerIDs/fullhash/copyrace/600/805/forwardonly/no103/R1-R5/history/humans preserved. Same release writer/branch/noagents/newchat/worktree/concurrentwriter.

Please post actual `Source review: PASS` for ALL five hashes and ALL literal bindings below, or findings/conditions. Old620095 PASS cannot approve this successor. Preparers/launcher/operator remain UNEXECUTED; only import/compile/closedfake guards ran.

```
TOKENS_VALUE
```

<!-- MARK_VALUE -->
'''.replace('HEAD_VALUE',HEAD).replace('COUNT_VALUE',str(len(pub['files']))).replace('TOKENS_VALUE','\n'.join(tokens)).replace('MARK_VALUE',MARK)
D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
for n,v in evidence.items():save(n,v)
save('source-index-original.json',canonical(index)+b'\n');save('request-body-original.md',body.encode());save('request-input-original.json',canonical({'body':body})+b'\n')
save('post-intent-once.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':HEAD,'marker':MARK,'neverReplay':True,'cacheOperations':0})+b'\n')
r=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(D/'request-input-original.json')],cwd=R,capture_output=True)
save('post-response-original.json',r.stdout);save('post-stderr-original.log',r.stderr);require(r.returncode==0,'Unknown post outcome; inspect GitHub, never replay')
posted=json_exact(r.stdout);require(posted['body']==body and posted['id']>6200950139,'Actual request differs')
live=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id'])],cwd=R);save('actual-posted-request-original.json',live);require(json_exact(live)['body']==body,'Fresh request differs')
save('delivery-record.json',canonical({'status':'ONE_EXACT_NEW_R2_RENDER_CORRECTION_REVIEW_REQUEST_POSTED','sourceHead':HEAD,'commentId':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'allFiveHashesAndLiteralBindings':tokens,'bindingCount':len(tokens),'actualNewSourcePassClaimed':False,'nativeMessageSent':False,'oldFailureRetainedPublished':True,'newPackageRootUnitUncreated':True,'cacheOperations':0})+b'\n')
lead=f'''## 2026-10-15 ONE new R2 renderer source review{posted['id']} requested; actual new PASS pending

Complete NEW5file render-correctedR2source{HEAD}/50local50ACTUALhost3.9.23/all5+{len(tokens)}bindings sentONCE{posted['created_at']} {posted['html_url']}. Bundlesactualold210000remoteSyntaxError/0operations/rootabsentunitnotfound/2eb6534cfailureSHA4f7fa58a andconcreteone-passrenderer+compileACTUALtemplatesBEFORESSH/new213000root. CacheoperatorBYTEIDENTICAL3cc5d1da/cap-protection-receipts-limitsunchanged. Fullrawrequest/currentauthorities/sourcebindings/delivery at WP/r2-cache-cap-render-acc15844-20261015/{D.name}/publication-index.json. NEWexactPASS stillREQUIRED/old620095consumed; no operationalnewpackage/root/unit/prune. NativeNOsendperagreedprotocol: GH10min/one@claude#162handoff/nativeONLYifanswer missingabout20min; directagreementcomplete/noextraACK. All5+1333inputsunchanged/mainbeCI4audits6rulesfresh/mainmergeHOLD/newproofbudgetreviewR4+10GB/sciencehistoryR1-R5/humans held. Samewriterbranch/noagents/newchat/worktree/concurrentwriter; no production/buildproof/kitgatedeploy.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),*readmes];idx=D/'publication-index.json'
save('publication-index.json',canonical({'baseAudit':HEAD,'sourceReviewRequestId':posted['id'],'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths]
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Raw staged identity differs')
git('commit','-m','Request exact R2 renderer correction review with closed zero-operation refusal')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Raw committed bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed writer differs')
print(json.dumps({'audit':head,'sourceCommit':HEAD,'requestId':posted['id'],'requestUrl':posted['html_url'],'createdUtc':posted['created_at'],'bindingCount':len(tokens),'rawOidShaVerifiedBlobs':len(paths),'actualNewPassClaimed':False,'cacheOperations':0,'nativeMessageSent':False}))
