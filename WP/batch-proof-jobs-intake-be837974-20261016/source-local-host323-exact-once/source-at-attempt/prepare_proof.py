"""Prepare only from NEW exact approved raw Git. No SSH, snapshot or proof execution."""
import argparse,pathlib,subprocess,sys
from proof_contract import *
from proof_files import write_new
from proof_app_sources import APP_PINS,validate_sources

REPO=pathlib.Path(__file__).resolve().parents[2]
REL='WP/batch-proof-jobs-intake-be837974-20261016/'
BUILD_REL='WP/batch-build-stable-accounting-be837974-20261015/first-build-190000-closed-originals-once/'
BUILD_INDEX='WP/batch-build-stable-accounting-be837974-20261015/build-package-workflow-batch-build-be837974-20261015T190000Z/source-index.json'
def command(*argv):return subprocess.check_output(argv,cwd=REPO)
def gh(path):return exact_json(command('gh','api',path))
def raw_git(head,path):
    row=command('git','ls-tree','-z',head,'--',path).rstrip(b'\0');meta,returned=row.split(b'\t',1);mode,kind,oid=meta.decode().split();require(kind=='blob' and mode in ['100644','100755'] and returned.decode()==path,'Raw regular Git blob required')
    data=command('git','cat-file','blob',oid);require(hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==oid,'Git identity mismatch');return data,{'bytes':len(data),'sha256':sha(data),'blob':oid}
def raw_git_many(head,paths):
    rows=command('git','ls-tree','-rz',head).split(b'\0');inventory={r.split(b'\t')[1].decode():r.split(b'\t')[0].decode().split() for r in rows if r}
    require(all(n in inventory and inventory[n][0] in ['100644','100755'] and inventory[n][1]=='blob' for n in paths),'Complete regular application source graph required')
    ids=[inventory[n][2] for n in paths];raw=subprocess.check_output(['git','cat-file','--batch'],cwd=REPO,input=('\n'.join(ids)+'\n').encode());offset=0;out={}
    for name,oid in zip(paths,ids):
        end=raw.index(b'\n',offset);given,kind,size=raw[offset:end].decode().split();size=int(size);offset=end+1;data=raw[offset:offset+size];offset+=size
        require(given==oid and kind=='blob' and len(data)==size and raw[offset:offset+1]==b'\n' and hashlib.sha1(('blob '+str(size)+'\0').encode()+data).hexdigest()==oid,'Raw Git application source identity differs');offset+=1;out[name]=data
    require(offset==len(raw),'Expanded raw Git response');return out
def current_evidence(review=None,index=None):
    out={'main':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),'ci':gh('repos/yigini/soilfer-lims/actions/runs/'+str(MAIN_CI)),'prs':{},'verdicts':{},'comments':{}}
    for pr,id,head,merge in AUDITS:
        out['prs'][str(pr)]=gh('repos/yigini/soilfer-lims/pulls/'+str(pr));out['verdicts'][str(pr)]=gh('repos/yigini/soilfer-lims/issues/comments/'+str(id));pages=exact_json(command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/'+str(pr)+'/comments?per_page=100'));out['comments'][str(pr)]=[c for p in pages for c in p]
    out['rules']={i:gh('repos/yigini/soilfer-lims/issues/comments/'+i) for i in RULE_AUTHORITY_PINS};out['r2Accepted']=gh('repos/yigini/soilfer-lims/issues/comments/6202252017');rule_authorities(out['rules'],out['r2Accepted'])
    out['postRebootAuthorities']={i:gh('repos/yigini/soilfer-lims/issues/comments/'+i) for i in POST_REBOOT_PINS};post_reboot_authorities(out['postRebootAuthorities'])
    out['memoryDirection']=gh('repos/yigini/soilfer-lims/issues/comments/6203416404');memory_authority(out['memoryDirection'])
    out['jobsScope']=gh('repos/yigini/soilfer-lims/issues/comments/6204518776');jobs_scope_authority(out['jobsScope'])
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
        raw,_=raw_git(BUILD_EVIDENCE,BUILD_INDEX if n=='source-index.json' else BUILD_REL+n);files['qualified-image-inspect-original.json' if n=='image-inspect-original.json' else n]=raw
    receipt=exact_json(files['build-receipt.json']);qualified(receipt,files['build-receipt.json'],exact_json(files['qualified-image-inspect-original.json'])[0])
    compose,meta=raw_git(CANDIDATE,COMPOSE_PIN['path']);require(meta=={k:COMPOSE_PIN[k] for k in ['bytes','sha256','blob']},'Pinned Compose source changed');files['compose-source.yml']=compose
    manifest=exact_json(files['source-index.json']);require(sha(files['source-index.json'])==receipt['applicationIndexSha256'],'Qualified manifest binding differs')
    application=sorted(APP_PINS);appraw=raw_git_many(CANDIDATE,application);derivation=validate_sources(appraw,{r['path']:r for r in manifest['entries']})
    index_source=raw_git(CANDIDATE,'server/index.js')[0].decode();events=re.findall(r"event\s*:\s*'([^']+_STARTUP_READY)'",index_source);require(len(events)==len(set(events))==26,'Current pinned READY inventory differs')
    dest=REPO/REL/('proof-package-'+ROOT_NAME);require(not dest.exists() and not dest.is_symlink(),'Package consumed; never replay');dest.mkdir(mode=0o700)
    for name,pin in PRIOR_FILES.items():
        raw,meta=raw_git(PRIOR_EVIDENCE,pin['path']);require(meta=={k:pin[k] for k in ['bytes','sha256','blob']},'Pinned prior evidence differs '+name);files[name]=raw
    files['tooling-source-index.json']=canonical(index)+b'\n';files['source-review-original.json']=canonical(review)+b'\n';files['current-evidence.json']=canonical(evidence)+b'\n'
    for name,raw in files.items():
        with (dest/name).open('xb') as f:f.write(raw)
        (dest/name).chmod(0o400)
    spec={'status':'PREPARED_NOT_LAUNCHED','scope':SCOPE,'root':str(ROOT),'head':CANDIDATE,'tree':TREE,'image':IMAGE,'toolingCommit':tooling,'sourceReviewId':review_id,'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED','packageHashes':{n:sha(b) for n,b in files.items()},'applicationSourceFiles':application,'applicationCopyDerivation':derivation,'retryAllowed':False,'expectedReadyEvents':events,'expectedEntrypointVerifiers':27,'jobsOnQualificationStillRequired':True,'productionSqliteConnections':0,'priorEvidenceCommit':PRIOR_EVIDENCE,'priorEvidenceIndexSha256':PRIOR_FILES_SHA,'forwardDirection':FORWARD_DIRECTION,'releaseKit':None,'gate':None,'deployments':0}
    write_new(dest/'proof-input.json',spec);print(json.dumps({'status':spec['status'],'package':str(dest),'root':str(ROOT),'sourceReviewId':review_id,'operationalExecutions':0}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--tooling-commit',required=True);p.add_argument('--source-review-id',required=True,type=int);a=p.parse_args();prepare(a.tooling_commit,a.source_review_id)
