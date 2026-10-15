"""Publish actual sole startup-pass result handoff request, response and exact fresh readback."""
import hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';D=S/'proof233000-closed-memory-events-handoff-once';BASE='4007ee6117c5e084e502cb174137de2ac5cc4c8a';BRANCH='audit/release-eb6de2e8'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,FILES
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip() and git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE
d=json.loads((D/'delivery-record.json').read_bytes());request=json.loads((D/'post-request.json').read_bytes());posted=json.loads((D/'actual-post-response.json').read_bytes());readback=json.loads((D/'actual-fresh-readback.json').read_bytes())
body=(D/'actual-handoff-body-utf8.txt').read_bytes();assert body.decode()==request['body']==posted['body']==readback['body'] and sha(body)==d['bodySha256'] and posted['id']==readback['id']==d['id']
assert d['sourcePublication']==BASE and d['freshReadbackBodyExact'] and d['sourcePassAcknowledgedOnlyHere']==6203833517 and d['newServerOperations']==0
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
for n in FILES:assert (S/n).read_bytes()==(S/'proof233000-closed-memory-events-complete-originals-once/remote-originals'/n).read_bytes()
lead=f'''LATEST ACTUAL CLOSED233000 STARTUP-ONLY RESULT HANDOFF - {d['createdUtc']}. ONE@claude162 actualclosedstartup-onlyPASS result{d['id']} POSTED{d['url']} andfreshreadbackBODYEXACT. BundlesactualSourcePASS6203833517ACKONLYHERE/full8329rawGitOID-SHA-lengthverified4007ee6117c5e084e502cb174137de2ac5cc4c8a/independentresultd67473493481afa4203434fa2aa11dc13a8ffd80a69258da658dc5c1dfb43d84/original0400receiptf9478dd0082a708167ef4569d4496cd50b29995b0e1f610b43517d38701def93. Closed2026-10-15T23:15:10.989124+00:00/same3eb684645431481ea98912210f972d99. BOTHjobsOFFstarts27NOOPinteger0+26READYinteger0/healthy332.77019714499966s+392.4748328019996s/HTTP200200401/fullstopped11242EXACTpriorstate. ALL625health/627memory/5016kernelraws independentlyverified/zeroOOMevery/sampledsummax118587600+110393056<=603979776; peakOBSERVATIONSONLY/notcontinuouspeakclaim. 9190stablehashedrootfiles/8166smallnonDBnonasset originals/all43package/690sourcebindings/15+1333unchanged/457appcopybindings/489assetsEACH preserved. All77historical+2newownedSTOPPED/NORMAL/qualifiedcd3aENTIREacc158/old080000rawreaderbackup070000assets unchanged/hashstatonly/noSQLDBfetchnewdu. Wholephysicalgrowth10205564928/drop10206208000/unexplained643072<500MB/terminalfree95937847296EACH3sameFSnotadditive/remaining0req24851118190incl10GB; allR4originals+stagecapsretained. Actualrequest/response/freshreadback/currentauthority at proof233000-closed-memory-events-handoff-once/publication-index.json. LocalretainerfirstjournalFIELDrefusal retained/correctednewreadonlycapture succeeded/no proofreplay; alloriginalhelperbytesimmutable. Noactiveproof/localrunnerretainer. All233000rootunitPASSpackageoperatorshelpersCONSUMEDNEVERretryreplaycleanup.

ActualClclosed-resultreview PENDINGATTHISPUBLICATION. NextNEWjobsONnaturalintake+broadpostflight sourcegraph NOTYETIMPLEMENTED/NOnewoperator orSourceReviewexists; preparecompleteconcretesource/meaningfulguards/exactallhashreview/freshR4+unusedrootunit beforeANYnextoperation. ThisPASSjobsOFFONLY/NOT_RELEASE_QUALIFIED/no jobsONkitgatedeployauthority. NativefallbackONLYifactualresultanswerstillmissingabout20min after{d['createdUtc']}/freshactualtargetEMPTYcomposer/preservehumans/no duplicates. NeverduplicateACK/native/result/source-request. MainMERGEHOLD/heartbeat2min restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS/R2COMPLETE/no moreprune/YY320GiBalreadyvisible/nohostgrowrestart/old230000FAILEDimmutable/scienceR1-R5/600/805blankheap/forwardonly/no103/historyhumansheld.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
fixed=[pathlib.Path(__file__),R/'WP/backlog-resume-20261013/post-startup233000-closed-memory-events-result-once.py',*readmes];paths=sorted(p for p in D.rglob('*') if p.is_file())+fixed
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
verify(git('write-tree').decode().strip());git('commit','-m','Retain actual closed233000 startup-only PASS handoff to Claudio');head=git('rev-parse','HEAD').decode().strip();verify(head);git('push','origin',BRANCH)
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
print(json.dumps({'head':head,'commentId':d['id'],'commentUrl':d['url'],'verifiedRawOidShaLengthFiles':len(paths),'sourceAnd1333InputsUnchanged':True},ensure_ascii=True))
