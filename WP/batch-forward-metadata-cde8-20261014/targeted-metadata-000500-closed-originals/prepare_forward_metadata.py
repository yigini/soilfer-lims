"""Prepare a new exact-source-approved metadata-only package from raw Git. No SSH or adoption."""
import argparse,datetime,json,pathlib,subprocess,sys
from forward_metadata_contract import *
REPO=pathlib.Path(__file__).resolve().parents[2]
REL='WP/batch-forward-metadata-cde8-20261014/'
def command(*args):return subprocess.check_output(args,cwd=REPO)
def gh(path):return command('gh','api',path)
def raw_git(head,path):
    listing=command('git','ls-tree','-z',head,'--',path);meta,returned=listing.rstrip(b'\0').split(b'\t',1)
    mode,kind,oid=meta.decode().split();require(kind=='blob' and returned.decode()==path and mode in ['100644','100755'],'Wrong raw source object')
    raw=command('git','cat-file','blob',oid);require(hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==oid,'Raw Git identity differs')
    return raw,{'path':path,'mode':mode,'blob':oid,'bytes':len(raw),'sha256':sha(raw)}
def fresh_authority(review,index):
    result={'current-main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),'main-ci-original.json':gh('repos/yigini/soilfer-lims/actions/runs/38636615469')}
    require(exact_json(result['current-main-original.json'])['object']['sha']==CANDIDATE,'Current main moved')
    ci=exact_json(result['main-ci-original.json']);require(ci['id']==38636615469 and ci['head_sha']==CANDIDATE and ci['run_attempt']==1 and ci['status']=='completed' and ci['conclusion']=='success','Exact closed main CI missing')
    current=exact_json(gh('repos/yigini/soilfer-lims/issues/comments/'+str(review['id'])));source_review(current,index)
    require(canonical(current)==canonical(review),'Actual source review changed')
    for n,identity in [('scope-direction-original.json',6180234041),('reference-direction-original.json',6180335648)]:result[n]=gh('repos/yigini/soilfer-lims/issues/comments/'+str(identity))
    directions(exact_json(result['scope-direction-original.json']),exact_json(result['reference-direction-original.json']))
    pages=exact_json(command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'))
    for v in [v for p in pages for v in p]:
        if v.get('created_at','')>review['created_at'] and index['head'] in v.get('body','') and any(x in v['body'].lower() for x in ['source review: failed','source review: changes required','audit failed']):raise RuntimeError('Later exact-source rejection')
    return result
def prepare(tooling,review_id):
    require(sys.flags.optimize==0,'Plain Python required')
    index={'head':tooling,'files':{}};raws={}
    for n in sorted(SOURCE_FILES):raws[n],index['files'][n]=raw_git(tooling,REL+n)
    graph(index)
    for p in [pathlib.Path(__file__),pathlib.Path(sys.modules['forward_metadata_contract'].__file__)]:require(p.read_bytes()==raws[p.name],'Executed preparation source differs')
    review_raw=gh('repos/yigini/soilfer-lims/issues/comments/'+str(review_id));review=exact_json(review_raw);source_review(review,index)
    authority=fresh_authority(review,index)
    for n,row in REFS.items():
        raw,_=raw_git(REFERENCE_AUDIT,REFERENCE_PREFIX+n);require(len(raw)==row['bytes'] and sha(raw)==row['sha256'],'Original retained reference differs');raws[n]=raw
    for dest,original in [('original-closed-index.json','remote-closed-original-index.json'),('original-failure.json','build-terminal-failure.json'),('original-build-intent.json','build-intent.json')]:raws[dest]=raw_git(REFERENCE_AUDIT,REFERENCE_PREFIX+original)[0]
    closed=exact_json(raws['original-closed-index.json']);require('image-inspect-original.json' not in closed['ownedInventory'],'Original inspect absence differs')
    require(exact_json(raws['original-failure.json'])['status']=='FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL','Original failure status differs')
    require(raws['candidate-image.id'].decode().strip()==IMAGE,'Candidate reference ID differs');exported_image(raws['docker-build.log'].decode())
    reference=exact_json(raws['candidate-image-fresh-inspect-original.json'])[0];require(reference['Id']==IMAGE,'Forensic reference image differs')
    dest=REPO/REL/('metadata-package-'+ROOT_NAME);require(not dest.exists() and not dest.is_symlink(),'Prepared metadata package consumed')
    spec={'status':'PREPARED_READONLY_METADATA_NOT_LAUNCHED','scope':SCOPE,'candidate':CANDIDATE,'tree':TREE,'image':IMAGE,'rootName':ROOT_NAME,'toolingCommit':tooling,'toolingIndexSha256':sha(canonical(index)),'sourceReviewId':review_id,'sourceReviewSha256':sha(canonical(review)),
        'scopeDirectionSha256':sha(canonical(exact_json(authority['scope-direction-original.json']))),'referenceDirectionSha256':sha(canonical(exact_json(authority['reference-direction-original.json']))),'originalRefs':REFS,'originalFailedRoot':OLD_ROOT,'originalInspectAbsent':True,
        'imageEligibility':False,'imageAdoptionReceipts':0,'newBuilds':0,'retags':0,'containerStarts':0,'databaseConnections':0,'volumeMounts':0,'filesystemDuCalls':0,'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED','preparedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    validate_spec(spec,index,review,exact_json(authority['scope-direction-original.json']),exact_json(authority['reference-direction-original.json']))
    files={**raws,**authority,'metadata-input.json':(json.dumps(spec,indent=2)+'\n').encode(),'tooling-source-index.json':(json.dumps(index,indent=2)+'\n').encode(),'source-review-original.json':review_raw}
    require(set(files)==REQUIRED,'Complete metadata package inventory required')
    dest.mkdir()
    for n,raw in files.items():
        with (dest/n).open('xb') as f:f.write(raw)
        (dest/n).chmod(0o400)
    print(json.dumps({'status':spec['status'],'package':str(dest),'root':str(safe_root(ROOT_NAME)),'imageEligibility':False,'newReceipts':0,'productionOperations':0}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--tooling-commit',required=True);p.add_argument('--source-review-id',required=True,type=int);a=p.parse_args();prepare(a.tooling_commit,a.source_review_id)
