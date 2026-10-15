"""Publish actual sole failure-result handoff request, response and exact fresh readback."""
import hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-startup-be837974-20261015';D=S/'proof230000-closed-memory-handoff-once';BASE='9efebefccc05095d84bcfad234fce46a53cbeaf2';BRANCH='audit/release-eb6de2e8'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,FILES
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip() and git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE
d=json.loads((D/'delivery-record.json').read_bytes());request=json.loads((D/'post-request.json').read_bytes());posted=json.loads((D/'actual-post-response.json').read_bytes());readback=json.loads((D/'actual-fresh-readback.json').read_bytes())
body=(D/'actual-handoff-body-utf8.txt').read_bytes();assert body.decode()==request['body']==posted['body']==readback['body'] and sha(body)==d['bodySha256'] and posted['id']==readback['id']==d['id']
assert d['sourcePublication']==BASE and d['freshReadbackBodyExact'] and d['sourcePassAcknowledgedOnlyHere']==6203010192 and d['newServerOperations']==0
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
for n in FILES:assert (S/n).read_bytes()==(S/'proof230000-closed-memory-originals-once/remote-originals'/n).read_bytes()
lead=f'''LATEST ACTUAL CLOSED230000 RESULT HANDOFF - {d['createdUtc']}. ONE@claude#162 actualclosedfailure result {d['id']} POSTED {d['url']} and freshreadback BODYEXACT. Bundlesactual6203010192ACKONLYhere/full1509rawOID-SHA-lengthverified9efebefccc05095d84bcfad234fce46a53cbeaf2 originals/independentresultff22ab7627ab90aa3848dd5ae0cf3078cc4fb60b787f33944185a9415e42ab1d. Requests separately reviewed forward-remedy SCOPE for app memory.peak805314560B/limit805306368B/EXACT8192Bexcess; no tolerance/rounding/PASS/limitincrease/retry inferred. Actualfirststartup27NOOP0+26READY0/healthy392.9904243249998s/372FULLpolls/allHTTPprobespassed but wholeproofFAILEDmemoryguard/secondstartupUNATTEMPTED/no fullstopped11242seal/no terminalwhole-storeaccounting. Containerstopped137/OOMKilledfalse/restarts0/ownedStopErrornull/all76historical+NORMALpreserved. AllDBWALSHM/assetsretainedHOST/all42package/all14+1333unchanged. Fullclosedoriginals at proof230000-closed-memory-publication-once; actualrequest+response+freshreadback/currentauthority at proof230000-closed-memory-handoff-once/publication-index.json. Noactiveproof/runnerretainer. All230000root/unit/operators/PASS/helpers CONSUMEDneverretryreplaycleanup. ActualClclosed-resultcheck/NEWforward-scopeanswer PENDING; no newgraph/root/package/retry/sourcechange/jobsON/kit/gate/deploy. NativefallbackONLYifanswerstillmissingabout20min after{d['createdUtc']}, freshactualtargetEMPTYcomposer/preservehumans/no duplicateGH/native/ACK. MainMERGEHOLD/heartbeat2min/R2COMPLETE/no moreprune/allscience/R1-R5/600/805blankheap/forwardonly/no103/historyheld.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
fixed=[pathlib.Path(__file__),R/'WP/backlog-resume-20261013/post-startup230000-closed-memory-result-once.py',*readmes];paths=sorted(p for p in D.rglob('*') if p.is_file())+fixed
out=D/'publication-index.json';assert not out.exists()
with out.open('xb') as f:f.write(canonical({'baseAudit':BASE,'actualComment':d,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);names=[p.relative_to(R).as_posix() for p in paths];assert len(names)==len(set(names))
git('-c','core.autocrlf=false','add','-f','--pathspec-from-file=-','--pathspec-file-nul',payload=b'\0'.join(n.encode() for n in names)+b'\0')
assert set(git('diff','--cached','--name-only').decode().splitlines())==set(names)
def verify(head):
 entries={}
 for row in git('ls-tree','-rz',head,'--',D.relative_to(R).as_posix(),*[p.relative_to(R).as_posix() for p in fixed]).split(b'\0'):
  if not row:continue
  meta,n=row.split(b'\t',1);mode,kind,obj=meta.decode().split();assert kind=='blob' and mode in ['100644','100755'];entries[n.decode()]=obj
 assert set(entries)==set(names)
 objects=[entries[n] for n in names];batch=git('cat-file','--batch',payload=('\n'.join(objects)+'\n').encode());at=0
 for p,obj in zip(paths,objects):
  end=batch.index(b'\n',at);got,kind,length=batch[at:end].decode().split();length=int(length);raw=batch[end+1:end+1+length];at=end+2+length
  assert got==obj and kind=='blob' and batch[at-1:at]==b'\n' and raw==p.read_bytes() and oid(raw)==obj
 assert at==len(batch)
verify(git('write-tree').decode().strip());git('commit','-m','Retain actual closed230000 memory failure handoff to Claudio');head=git('rev-parse','HEAD').decode().strip();verify(head);git('push','origin',BRANCH)
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
print(json.dumps({'head':head,'commentId':d['id'],'commentUrl':d['url'],'verifiedRawOidShaLengthFiles':len(paths),'sourceAnd1333InputsUnchanged':True},ensure_ascii=True))
