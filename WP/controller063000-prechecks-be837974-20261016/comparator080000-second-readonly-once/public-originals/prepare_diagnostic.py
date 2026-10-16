"""Prepare ONE exact reviewed precheck package locally. Never SSH here."""
import argparse,pathlib,subprocess,json
import diagnostic_contract as c
import diagnostic_authority as authority
W=pathlib.Path(__file__).resolve().parents[2]
def git(*args,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=W,input=input)
def source_index(head):
    files={};index={'head':head,'files':{}}
    for n in c.SOURCE_NAMES+c.DATA_NAMES:
        p=c.REL+n;raw=git('show',head+':'+p)
        row=git('ls-tree','-z',head,'--',p).rstrip(b'\0');meta,returned=row.split(b'\t',1);mode,kind,oid=meta.decode().split()
        c.require(kind=='blob' and mode in ('100644','100755') and returned.decode()==p,'Precheck regular raw Git source required')
        c.require((W/p).read_bytes()==raw,'Precheck source checkout changed')
        files[n]=raw;index['files'][n]={'bytes':len(raw),'sha256':c.sha(raw),'blob':oid}
    c.bindings(index)
    for n in c.DATA_NAMES:
        if n.startswith('application-source-fixtures/'):
            c.require(files[n]==git('show','be8379745bdfae52ce46496ff26514dc7d729640:'+n.removeprefix('application-source-fixtures/')),'Bound app writer differs')
    return files,index
def later_comments(evidence,review,index):
    for v in evidence['sourceComments']:
        if v['updated_at']>=review['created_at'] and v['id']!=review['id'] and (v.get('performed_via_github_app') or {}).get('id')==1236702 and index['head'] in v['body']:
            c.require(not any(t in v['body'].lower() for t in ['changes required','source review: fail','do not execute','revoked']),'Later precheck source rejection')
def prepare(head,review_id):
    files,index=source_index(head);review=authority.read('repos/yigini/soilfer-lims/issues/comments/'+str(review_id));c.approval(review,index)
    evidence=authority.current_evidence();later_comments(evidence,review,index)
    d=W/c.REL/('package-'+c.NAME);c.require(not d.exists(),'Precheck package consumed')
    files.update({'diagnostic-source-index.json':c.canonical(index)+b'\n','diagnostic-source-review.json':c.canonical(review)+b'\n','current-authority.json':c.canonical(evidence)+b'\n'})
    d.mkdir()
    for n,raw in files.items():
        p=d/n;p.parent.mkdir(parents=True,exist_ok=True)
        with p.open('xb') as f:f.write(raw)
        p.chmod(0o400)
    future=sum(((len(raw)+4095)//4096)*4096 for raw in files.values())+2*1024**2
    spec={'sourceHead':head,'sourceReviewId':review_id,'root':str(c.ROOT),'fileHashes':{n:c.sha(raw) for n,raw in files.items()},'futurePackageBytes':future+4096,'operationalChecks':0,'oneRunEachNoRetry':True}
    (d/'package-spec.json').write_bytes(c.canonical(spec)+b'\n')
    print(json.dumps({'package':str(d),'sourceHead':head,'sourceReviewId':review_id,'futurePackageBytes':spec['futurePackageBytes'],'hostOperations':0}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source-head',required=True);p.add_argument('--review-id',required=True,type=int);a=p.parse_args();prepare(a.source_head,a.review_id)
