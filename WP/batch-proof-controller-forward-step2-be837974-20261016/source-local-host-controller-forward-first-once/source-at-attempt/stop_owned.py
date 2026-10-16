"""ExecStopPost: stop and retain only this reviewed root's exact two owners.

Runs on normal exit, failure, timeout and SIGKILL. No reserve guard or memory
read is allowed to prevent the actual bounded stop of an owned writer.
"""
import hashlib,json,pathlib,re,subprocess
from proof_contract import ROOT,IMAGE,require,canonical,graph,approval
from controller_guard import own_snapshot
OWNERS={str(ROOT)+':'+label for label in ['startup-1','startup-2']}
LABEL='io.soilfer.release-owned'
def selected(v,owner):
    require(owner in OWNERS and v.get('Id') and re.fullmatch('[a-f0-9]{64}',v['Id']),'Exact root owner and full ID required')
    label=owner.rsplit(':',1)[1];name='/lims-owned-batch-'+hashlib.sha256(owner.encode()).hexdigest()[:24]
    require(v.get('Name')==name and v.get('Image')==IMAGE and v.get('Config',{}).get('Labels',{}).get(LABEL)==owner,'Stop identity differs')
    require(v['HostConfig']['RestartPolicy']['Name']=='no','Stop restart policy differs')
    require(v['Mounts'] and all(m.get('Type')=='bind' and m.get('RW') is True and pathlib.PurePosixPath(str(ROOT)) in pathlib.PurePosixPath(m.get('Source','')).parents for m in v['Mounts']),'Stop mount ownership differs')
    expected={'/app/server/prisma':str(ROOT/(label+'-database')),'/app/server/uploads':str(ROOT/(label+'-assets')),'/tmp':str(ROOT/(label+'-retained-temp'))}
    require(len(v['Mounts'])==3 and {m['Destination']:m['Source'] for m in v['Mounts']}==expected,'Stop exact mount inventory differs')
    return {'id':v['Id'],'owner':owner,'name':v['Name'],'image':v['Image'],'running':v['State']['Running'],'startedAt':v['State']['StartedAt'],'mounts':v['Mounts']}
def call(args):
    r=subprocess.run(args,capture_output=True,timeout=30)
    require(r.returncode==0 and len(r.stdout)<=4*1024**2 and len(r.stderr)<=65536 and not r.stderr,'Bounded exact-owner stop interface failed');return r.stdout
def stop_exact(call_interface=call):
    out=[];errors=[]
    for owner in sorted(OWNERS):
        try:
            raw=call_interface(['docker','ps','-aq','--no-trunc','--filter','label='+LABEL+'='+owner]);ids=raw.decode('ascii').splitlines()
            require(len(ids)<=1 and len(ids)==len(set(ids)) and all(re.fullmatch('[a-f0-9]{64}',x) for x in ids),'Exact-owner inventory malformed or duplicated')
            for id in ids:
                rows=json.loads(call_interface(['docker','inspect',id]));require(len(rows)==1,'Single owned inspect required');before=selected(rows[0],owner)
                if before['running']:call_interface(['docker','stop','-t','10',id])
                rows=json.loads(call_interface(['docker','inspect',id]));require(len(rows)==1,'Single stopped inspect required');after=selected(rows[0],owner)
                require(after['running'] is False and all(after[k]==before[k] for k in ['id','owner','name','image','startedAt','mounts']),'Exact owned container remains running or changed')
                out.append({'before':before,'after':after,'retained':True})
        except BaseException as e:errors.append({'owner':owner,'errorType':type(e).__name__})
    return {'stoppedAndRetained':out,'errors':errors,'allExactOwnedStopped':not errors,'productionActions':0,'foreignContainersStopped':0}
def verify_retained_graph(root):
 spec=json.loads((root/'proof-input.json').read_bytes());index=json.loads((root/'tooling-source-index.json').read_bytes());review=json.loads((root/'source-review-original.json').read_bytes());approval(review,index)
 require(spec['toolingCommit']==index['head'] and spec['sourceReviewId']==review['id'],'Stop-post specification binding differs')
 for n,d in graph(index).items():require(hashlib.sha256((root/n).read_bytes()).hexdigest()==d,'Stop-post source changed')

def post_stop(root,stopper=None,verifier=None,memory_reader=None):
 result=(stopper or stop_exact)();errors=[]
 try:(verifier or verify_retained_graph)(root)
 except BaseException as e:errors.append(('verification',e))
 try:memory=(memory_reader or own_snapshot)()
 except BaseException as e:memory=None;errors.append(('memory',e))
 result.update({'controllerMemory':memory,'controllerMemoryErrorType':next((type(e).__name__ for kind,e in errors if kind=='memory'),None),'execStopPost':True})
 return result,errors

def main():
 root=pathlib.Path(__file__).resolve().parent;require(str(root)==str(ROOT),'Exact stop-post root required')
 result,errors=post_stop(root)
 from provenance_privacy import initialize_private_key,public_failure
 initialize_private_key(root,'private-stop-post-hmac-key.json')
 result['postStopErrors']=[{'phase':kind,**public_failure(error)} for kind,error in errors]
 p=root/'stop-post-result.json'
 with p.open('xb') as f:f.write(canonical(result)+b'\n')
 p.chmod(0o400)
 require(result['allExactOwnedStopped'] and not errors,'Stop-post or controller memory refused; inspect same retained root')
if __name__=='__main__':main()
