"""Local preparation after exact new PASS; fresh authority is retained per read."""
import datetime,pathlib,subprocess,sys
from diagnostic_authority import *
from diagnostic_contract import *
REPO=pathlib.Path(__file__).resolve().parents[2]
REL=pathlib.Path('WP/jobs-row-diagnostic-private-be837974-20261016')
def command(*args):return subprocess.check_output(args,cwd=REPO)
def gh(p):return strict(command('gh','api',p))
def current_evidence(review=None,index=None):
    out={'main':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),'ci':gh('repos/yigini/soilfer-lims/actions/runs/'+str(MAIN_CI)),'prs':{},'verdicts':{},'comments':{}}
    for pr,i,head,merge in AUDITS:
        out['prs'][str(pr)]=gh('repos/yigini/soilfer-lims/pulls/'+str(pr));out['verdicts'][str(pr)]=gh('repos/yigini/soilfer-lims/issues/comments/'+str(i));pages=strict(command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/'+str(pr)+'/comments?per_page=100'));out['comments'][str(pr)]=[c for page in pages for c in page]
    current(out['main'],out['ci'],out['prs'],out['verdicts'],out['comments'])
    out['rules']={i:gh('repos/yigini/soilfer-lims/issues/comments/'+i) for i in RULE_AUTHORITY_PINS};out['r2Accepted']=gh('repos/yigini/soilfer-lims/issues/comments/6202252017');rule_authorities(out['rules'],out['r2Accepted'])
    out['postRebootAuthorities']={i:gh('repos/yigini/soilfer-lims/issues/comments/'+i) for i in POST_REBOOT_PINS};post_reboot_authorities(out['postRebootAuthorities'])
    out['memoryDirection']=gh('repos/yigini/soilfer-lims/issues/comments/6203416404');memory_authority(out['memoryDirection'])
    out['jobsScope']=gh('repos/yigini/soilfer-lims/issues/comments/6204518776');jobs_scope_authority(out['jobsScope'])
    out['diagnosticScopes']={i:gh('repos/yigini/soilfer-lims/issues/comments/'+i) for i in DIAGNOSTIC_SCOPE_PINS};diagnostic_scopes(out['diagnosticScopes'])
    out['privacyFindings']=gh('repos/yigini/soilfer-lims/issues/comments/6206214444');privacy_findings_authority(out['privacyFindings'])
    out['issue191']=gh('repos/yigini/soilfer-lims/issues/191');require(out['issue191']['state']=='closed','191 reopened')
    out['sourceComments']=[c for page in strict(command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')) for c in page]
    if review is not None:
        fresh=gh('repos/yigini/soilfer-lims/issues/comments/'+str(review['id']));require(authority_projection(fresh)==authority_projection(review),'Review changed');approval(review,index);out['review']=fresh
        require(not any(max(c['created_at'],c['updated_at'])>review['created_at'] and index['head'] in c['body'] and any(x in c['body'].lower() for x in ['source review: failed','source review: changes required','audit failed']) for c in out['sourceComments']),'Later source rejection')
    out['observedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    return out
def published(index):
    require(set(index['files'])==FILES and set(index['data'])==DATA,'Complete source graph required')
    for n,pin in {**index['files'],**index['data']}.items():
        local=(REPO/REL/n).read_bytes();raw=command('git','show',index['head']+':'+(REL/n).as_posix())
        require(local==raw and len(raw)==pin['bytes'] and sha(raw)==pin['sha256'] and command('git','rev-parse',index['head']+':'+(REL/n).as_posix()).decode().strip()==pin['blob'],'Source publication mismatch')
    frozen=strict((REPO/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333 and all(sha((REPO/n).read_bytes())==h for n,h in frozen.items()),'Frozen application input changed')
    pins=strict((REPO/REL/'diagnostic-pins.json').read_bytes())
    for p in pins['applicationPins']:
        raw=command('git','show',CANDIDATE+':'+p['path']);require(sha(raw)==p['sha256'] and command('git','rev-parse',CANDIDATE+':'+p['path']).decode().strip()==p['candidateGitBlobOid'],'Application provenance writer source changed')
def prepare(index_path,review_path):
    index=strict(pathlib.Path(index_path).read_bytes());review=strict(pathlib.Path(review_path).read_bytes());approval(review,index);published(index);evidence=current_evidence(review,index)
    package=REPO/REL/('package-'+ROOT.name);require(not package.exists(),'Package preparation consumed')
    package.mkdir()
    for n in sorted(FILES|DATA):(package/n).write_bytes((REPO/REL/n).read_bytes())
    for n,v in [('source-index.json',index),('source-review.json',review),('current-evidence.json',evidence),('diagnostic-spec.json',{'root':str(ROOT),'unit':UNIT,'sourceReviewId':review['id'],'retryAllowed':False,'releaseQualified':False})]:(package/n).write_bytes(canonical(v)+b'\n')
    print(canonical({'package':str(package),'files':len(list(package.iterdir())),'noHostCalls':True}).decode())
if __name__=='__main__':prepare(sys.argv[1],sys.argv[2])
