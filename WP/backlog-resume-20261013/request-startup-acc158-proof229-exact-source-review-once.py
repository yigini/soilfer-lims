"""Post one exact new-source handoff; no package or proof operation."""
import datetime,hashlib,json,pathlib,subprocess,sys
repo=pathlib.Path(__file__).resolve().parents[2];source=repo/'WP/batch-proof-startup-be837974-20261015';sys.path.insert(0,str(source))
from proof_contract import *
import prepare_proof
head='29fa000751f25447f1ff8c129b0dfcc5d2b67445';rel='WP/batch-proof-startup-be837974-20261015/'
dest=source/'exact-source-review-29fa0007-once';assert not dest.exists();dest.mkdir()
def cmd(*args,input=None):return subprocess.check_output(args,cwd=repo,input=input)
assert cmd('git','rev-parse','HEAD').decode().strip()==head and not cmd('git','diff','--cached','--name-only')
raw_index=cmd('git','show',head+':'+rel+'source-publication-index.json');published=exact_json(raw_index)
index={'head':head,'files':{n:{'bytes':r['length'],'sha256':r['sha256'],'blob':r['gitBlobOid']} for n,r in published['sourceFiles'].items()}};graph(index)
raws=prepare_proof.raw_git_many(head,[rel+n for n in sorted(FILES)])
for n,r in index['files'].items():
    b=raws[rel+n];assert (source/n).read_bytes()==b and len(b)==r['bytes'] and sha(b)==r['sha256'] and hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==r['blob']
test=exact_json((source/'source-local-host229-complete-once/exit-original.json').read_bytes());assert test['status']=='PASS' and test['sourceSha256After']==graph(index)
calls=[];original=prepare_proof.command
def capture(*args):
    raw=original(*args)
    if args[0]=='gh':
        n='api-'+str(len(calls)+1).zfill(3)+'-original.json';(dest/n).write_bytes(raw);calls.append({'path':n,'argv':list(args),'bytes':len(raw),'sha256':sha(raw)})
    return raw
prepare_proof.command=capture;evidence=prepare_proof.current_evidence()
marker='startup-proof-29fa0007-229-acc158-cd3a'
assert not any(marker in c.get('body','') for c in evidence['sourceComments']),'Already handed off: never duplicate'
binding=tokens(index)
readme=cmd('git','show',head+':'+rel+'README.md').decode()
body='@claude\n\nPlease review the COMPLETE NEW14-file acc158/cd3a startup-proof source at **'+head+'**, not any historical proof graph. Request marker: '+marker+'.\n\n'
body+='[Source/README](https://github.com/yigini/soilfer-lims/blob/'+head+'/'+rel+'README.md) — [all630 raw Git-OID/SHA256/length bindings including index](https://github.com/yigini/soilfer-lims/blob/'+head+'/'+rel+'source-publication-index.json).\n\n'
body+='This is the ONE meaningful new-source handoff: ACK your actual6202252017 acceptance (R2 COMPLETE/no more R2), actual6202595120 YYback/resume, and6202615241 conditional growth authority. I obeyed6202483884 while held. The resized space was already visible; NOgrowpart/resize2fs/xfs_growfs/host change was needed or performed. Full fresh lsblk/df/findmnt/three healthy production samples and fresh R4 are published below. Production remains old959d/7a, not deployed be.\n\n'
body+='**Please return a NEW unedited Claude-app Source review: PASS explicitly including ALL14SHA256 and EVERY literal token below, or concrete findings.** Prior passes authorize nothing for this graph. No operational package/upload/root/unit/proof has been created or executed. Tests are not approval. Scope keeps all science/refusal/fullhash/copyrace/retention/600s/805306368B/forward-only guards. Exact-package fresh R4 before ROOT/UNIT/runtime remains mandatory after the new PASS.\n\n'
body+=readme+'\n\nAll exact review bindings (including every14 source SHA256):\n'+chr(96)*3+'\n'+'\n'.join(binding)+'\n'+chr(96)*3+'\n'
assert body.startswith('@claude') and all(t in body for t in binding) and len(body)<65536
(dest/'review-body-exact.txt').write_text(body,encoding='utf-8')
(dest/'tooling-source-index.json').write_bytes(canonical(index)+b'\n');(dest/'source-publication-index-original.json').write_bytes(raw_index)
(dest/'current-evidence-derived.json').write_bytes(canonical(evidence)+b'\n')
request=canonical({'body':body});path=dest/'post-request-exact.json';path.write_bytes(request);started=datetime.datetime.now(datetime.timezone.utc).isoformat()
r=subprocess.run(['gh','api','repos/yigini/soilfer-lims/issues/162/comments','-X','POST','--input',str(path)],cwd=repo,capture_output=True,timeout=60)
(dest/'post-response-original.json').write_bytes(r.stdout);(dest/'post-stderr-original.log').write_bytes(r.stderr)
assert r.returncode==0,'Uncertain POST; inspect actual history, never resend'
comment=exact_json(r.stdout);assert comment['body']==body and comment['id']>6202615241
readback=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(comment['id']));actual=exact_json(readback);assert actual['body']==body and actual['created_at']==actual['updated_at'] and actual['id']==comment['id']
(dest/'actual-readback-original.json').write_bytes(readback);(dest/'api-command-index.json').write_bytes(canonical(calls)+b'\n')
record={'status':'ONE_EXACT_NEW_SOURCE_REVIEW_REQUEST_POSTED','startedUtc':started,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commentId':comment['id'],'url':comment['html_url'],'sourceCommit':head,'sourceFiles':14,'allLiteralReviewBindings':len(binding),'bodySha256':sha(body.encode()),'postRequestSha256':sha(request),'sourceReviewPassObserved':False,'nativeFallbackNotBeforeAbout20MinutesAfterPost':True,'acknowledgementsBundledOnlyHere':[6202252017,6202595120,6202615241],'operatorsExecuted':0,'proofRootOrUnitCreated':False}
(dest/'delivery-record.json').write_bytes(canonical(record)+b'\n');print(json.dumps(record))

