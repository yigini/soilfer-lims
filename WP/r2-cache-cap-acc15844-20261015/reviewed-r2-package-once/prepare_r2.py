"""Prepare exact reviewed raw Git R2 source; no SSH, cache or production operation."""
import argparse,datetime,pathlib,subprocess,sys
from r2_contract import *
REPO=pathlib.Path(__file__).resolve().parents[2]
REL='WP/r2-cache-cap-acc15844-20261015/'
def command(*args):return subprocess.check_output(args,cwd=REPO)
def gh(path):return command('gh','api',path)
def raw_git(head,path):
    metadata,returned=command('git','ls-tree','-z',head,'--',path).rstrip(b'\0').split(b'\t',1)
    mode,kind,blob=metadata.decode().split();require(kind=='blob' and mode in ['100644','100755'] and returned.decode()==path,'Exact regular raw Git file required')
    raw=command('git','cat-file','blob',blob);require(oid(raw)==blob,'Raw Git identity differs')
    return raw,{'path':path,'mode':mode,'blob':blob,'bytes':len(raw),'sha256':sha(raw)}
def current_evidence():
    raw={'main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),'main-ci-original.json':gh('repos/yigini/soilfer-lims/actions/runs/'+str(MAIN_CI))}
    prs={};verdicts={};comments={}
    for a in AUDITS:
        n=str(a['pr']);raw['pr'+n+'-original.json']=gh('repos/yigini/soilfer-lims/pulls/'+n);prs[n]=json_exact(raw['pr'+n+'-original.json'])
        raw['pr'+n+'-actual-pass.json']=gh('repos/yigini/soilfer-lims/issues/comments/'+str(a['comment']));verdicts[n]=json_exact(raw['pr'+n+'-actual-pass.json'])
        pages=json_exact(command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/'+n+'/comments?per_page=100'))
        comments[n]=[v for p in pages for v in p];raw['pr'+n+'-comments.json']=canonical(comments[n])
    validate_current(json_exact(raw['main-original.json']),json_exact(raw['main-ci-original.json']),prs,verdicts,comments)
    for ident in RULE_AUTHORITY_PINS:raw['authority-'+ident+'-original.json']=gh('repos/yigini/soilfer-lims/issues/comments/'+ident)
    validate_rule_authorities(raw)
    pages=json_exact(command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'))
    history=[v for p in pages for v in p];raw['coordination-history.json']=canonical(history)
    return raw,history
def prepare(head,review_id):
    require(sys.flags.optimize==0,'Plain Python required');files={};index={'head':head,'files':{}}
    for n in sorted(SOURCE_FILES):files[n],index['files'][n]=raw_git(head,REL+n)
    graph(index)
    for p in [pathlib.Path(__file__),pathlib.Path(sys.modules['r2_contract'].__file__)]:require(p.read_bytes()==files[p.name],'Actually executing source differs')
    review_raw=gh('repos/yigini/soilfer-lims/issues/comments/'+str(review_id));review=json_exact(review_raw);validate_source_review(review,head,index)
    evidence,history=current_evidence();no_later_source_failure(history,review,head)
    files.update(evidence)
    files['qualified-build-receipt.json']=raw_git(BUILD_AUDIT,BUILD_REL+'build-receipt.json')[0]
    files['qualified-image-inspect.json']=raw_git(BUILD_AUDIT,BUILD_REL+'image-inspect-original.json')[0]
    validate_build(files['qualified-build-receipt.json'],files['qualified-image-inspect.json'])
    files['source-index.json']=canonical(index)+b'\n';files['source-review.json']=review_raw
    dest=REPO/REL/'reviewed-r2-package-once';require(not dest.exists() and not dest.is_symlink(),'Package already consumed; never replay')
    spec={'scope':SCOPE,'root':ROOT,'unit':UNIT,'sourceHead':head,'sourceReviewId':review_id,'maxUsedSpaceBytes':CAP,'maximumPruneInvocations':MAX_ITEMS,
        'buildImage':IMAGE,'qualifiedBuildReceiptSha256':BUILD_RECEIPT_SHA,'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED',
        'preparedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':{n:{'sha256':sha(v),'bytes':len(v)} for n,v in files.items()},'retryAllowed':False}
    files['package-input.json']=canonical(spec)+b'\n';require(sum(len(v) for v in files.values())<16*1024**2,'Bounded R2 package required')
    dest.mkdir(mode=0o700)
    for n,v in files.items():
        with (dest/n).open('xb') as f:f.write(v)
        (dest/n).chmod(0o400)
    print(json.dumps({'status':'REVIEWED_R2_PACKAGE_PREPARED_NOT_LAUNCHED','package':str(dest),'files':len(files),'sourceHead':head,'cacheOperations':0}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source-head',required=True);p.add_argument('--source-review-id',required=True,type=int);a=p.parse_args();prepare(a.source_head,a.source_review_id)
