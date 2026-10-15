"""Prepare only from NEW exact approved raw Git. No SSH, snapshot or proof execution."""
import argparse,pathlib,subprocess,sys
from proof_contract import *
from proof_files import write_new

REPO=pathlib.Path(__file__).resolve().parents[2]
REL='WP/batch-proof-snapshot-handoff-cde8-20261015/'
BUILD_REL='WP/batch-build-containerd-cde8-20261015/first-build-010000-closed-success/'
def command(*argv):return subprocess.check_output(argv,cwd=REPO)
def gh(path):return exact_json(command('gh','api',path))
def raw_git(head,path):
    row=command('git','ls-tree','-z',head,'--',path).rstrip(b'\0');meta,returned=row.split(b'\t',1);mode,kind,oid=meta.decode().split();require(kind=='blob' and mode in ['100644','100755'] and returned.decode()==path,'Raw regular Git blob required')
    data=command('git','cat-file','blob',oid);require(hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==oid,'Git identity mismatch');return data,{'bytes':len(data),'sha256':sha(data),'blob':oid}
def current_evidence(review=None,index=None):
    out={'main':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),'ci':gh('repos/yigini/soilfer-lims/actions/runs/'+str(MAIN_CI)),'prs':{},'verdicts':{},'comments':{}}
    for pr,id,head,merge in AUDITS:
        out['prs'][str(pr)]=gh('repos/yigini/soilfer-lims/pulls/'+str(pr));out['verdicts'][str(pr)]=gh('repos/yigini/soilfer-lims/issues/comments/'+str(id));pages=exact_json(command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/'+str(pr)+'/comments?per_page=100'));out['comments'][str(pr)]=[c for p in pages for c in p]
    current(out['main'],out['ci'],out['prs'],out['verdicts'],out['comments'])
    pages=exact_json(command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'));out['sourceComments']=[c for p in pages for c in p]
    if review is not None:
        out['review']=gh('repos/yigini/soilfer-lims/issues/comments/'+str(review['id']));require(out['review']==review,'Source verdict edited');approval(review,index);no_later_failure(out['sourceComments'],review,index)
    return out
def prepare(tooling,review_id):
    files={};index={'head':tooling,'files':{}}
    for name in sorted(FILES):files[name],index['files'][name]=raw_git(tooling,REL+name)
    graph(index)
    for n in FILES:require((REPO/REL/n).read_bytes()==files[n],'Executed preparer graph differs')
    review=gh('repos/yigini/soilfer-lims/issues/comments/'+str(review_id));approval(review,index);evidence=current_evidence(review,index)
    for n in ['build-receipt.json','image-inspect-original.json','source-index.json']:
        raw,_=raw_git(BUILD_EVIDENCE,BUILD_REL+n);files['qualified-image-inspect-original.json' if n=='image-inspect-original.json' else n]=raw
    receipt=exact_json(files['build-receipt.json']);qualified(receipt,files['build-receipt.json'],exact_json(files['qualified-image-inspect-original.json'])[0])
    manifest=exact_json(files['source-index.json']);require(sha(files['source-index.json'])==receipt['applicationIndexSha256'],'Qualified manifest binding differs')
    application=['Dockerfile','docker-entrypoint.sh','server/index.js','server/scripts/install_lab_policy_schema.js',*[('server/scripts/'+r[1]) for r in CHAIN],'server/scripts/order_revision_impact.js','server/scripts/control_chart_prebinding_impact.js','server/routes/workbenchRoutes.js','server/routes/sisV2Routes.js']
    index_source=raw_git(CANDIDATE,'server/index.js')[0].decode();events=re.findall(r"event\s*:\s*'([^']+_STARTUP_READY)'",index_source);require(len(events)==len(set(events))==26,'Current pinned READY inventory differs')
    dest=REPO/REL/('proof-package-'+ROOT_NAME);require(not dest.exists() and not dest.is_symlink(),'Package consumed; never replay');dest.mkdir(mode=0o700)
    files['tooling-source-index.json']=canonical(index)+b'\n';files['source-review-original.json']=canonical(review)+b'\n';files['current-evidence.json']=canonical(evidence)+b'\n'
    for name,raw in files.items():
        with (dest/name).open('xb') as f:f.write(raw)
        (dest/name).chmod(0o400)
    spec={'status':'PREPARED_NOT_LAUNCHED','scope':SCOPE,'root':str(ROOT),'head':CANDIDATE,'tree':TREE,'image':IMAGE,'toolingCommit':tooling,'sourceReviewId':review_id,'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED','packageHashes':{n:sha(b) for n,b in files.items()},'applicationSourceFiles':application,'expectedReadyEvents':events,'expectedEntrypointVerifiers':27,'jobsOnQualificationStillRequired':True,'productionSqliteConnections':0,'releaseKit':None,'gate':None,'deployments':0}
    write_new(dest/'proof-input.json',spec);print(json.dumps({'status':spec['status'],'package':str(dest),'root':str(ROOT),'sourceReviewId':review_id,'operationalExecutions':0}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--tooling-commit',required=True);p.add_argument('--source-review-id',required=True,type=int);a=p.parse_args();prepare(a.tooling_commit,a.source_review_id)
