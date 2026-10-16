"""Publish actual sole jobs preservation failure handoff request, response and exact fresh readback."""
import hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-jobs-intake-be837974-20261016';D=S/'jobs003000-closed-row-refusal-handoff-once';BASE='b73a299bc10f79e41b6e52d78d65c7cce4e8ece7';BRANCH='audit/release-eb6de2e8'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,FILES
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip() and git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE
d=json.loads((D/'delivery-record.json').read_bytes());request=json.loads((D/'post-request.json').read_bytes());posted=json.loads((D/'actual-post-response.json').read_bytes());readback=json.loads((D/'actual-fresh-readback.json').read_bytes())
body=(D/'actual-handoff-body-utf8.txt').read_bytes();assert body.decode()==request['body']==posted['body']==readback['body'] and sha(body)==d['bodySha256'] and posted['id']==readback['id']==d['id']
assert d['sourcePublication']==BASE and d['freshReadbackBodyExact'] and d['sourcePassAcknowledgedOnlyHere']==6205111918 and d['newServerOperations']==0
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
for n in FILES:assert (S/n).read_bytes()==(S/'jobs003000-closed-row-refusal-originals-once/remote-originals'/n).read_bytes()
lead=f"""LATEST ACTUAL CLOSED003000 JOBS PRESERVATION FAILURE HANDOFF - {d['createdUtc']}.

ONE@claude162 actualfailedresult {d['id']} POSTED {d['url']}, requestJSON == actualresponse == freshuneditedreadback/bodySHA3ee542f596490c5c43962d2754a0f647a16f1285364d00e0d39195d8b5baec88. Bundles6205111918SourcePASSACK ONLYHERE; no duplicate native/ACK/result/source-request. Safe closed evidence b73a299bc10f79e41b6e52d78d65c7cce4e8ece7/11225rawGitOID-SHA-length files/independentresultedfe0cd1e9707d75a20c914bb79dd97bb05c1d11d85c63a1e319c70f97fe44fa/original0400terminal651b2b633a7e8700ae9ebb8515142116123d625edd00de35712cef51b4fcd62a. SAME exact04c99271/PASS620511/inv1316c26d1ef14f48b564b1e0cb7707a5 CLOSEDFAILED00:52:19.789544 Original row changed: Sample in first-natural-completion backup comparison; specific rowIDs/fields/cause NOT independently located. OFF broad/full11242preservation PASS; ON startup healthy483.028s/27NOOP0+26READY0/HTTP200200401 but natural-preservation REFUSED. One log completion reports174new/22skipped, not validatedintakecounts; four refusal pairs once/secondsync+fullONseal+terminalaccounting absent. All843memory/6744raws independently validated/OOM0/sampledmax274084176+209123360<=603979776/notcontinuouspeak; ALL812healthpolls retained. All12095rootfiles/11069smalloriginals retainedlocally/DBWALSHMassetsHOST; ALL79historical+2ownedSTOPPED/inputhashstat/qualifiedcd3aENTIREacc158/NORMAL unchanged. Full6jobsONlogs437071B/8774lines byte-reviewed and WITHHELD with embeddingstdoutJSON(7files), fulloriginals preserved/localHOST/SHA+length+linehashes public/no payloadfree claim. All26source1333app717sourcepub458rawGitAPPpins unchanged/freshmainbeCI38772398721SUCCESS/4audits6rules2postreboot memorydirection/jobsScope/R2accepted/#191CLOSED/no laterfailure reverified. Fullhandoff raw/currentauthority at jobs003000-closed-row-refusal-handoff-once/publication-index.json.

ActualClclosed-result review and separately audited forward-remedy scope PENDING at this publication. Newremedy/diagnostic/sourcegraph NOTYETapproved/implemented; don'twaitfornonexistentSourcePASS or replayfailedroot/helpers. Request specifically asks scope for narrowly bounded readonly diagnostic of NEWownedbackups if needed to locate protected Sample changes. No existingrow-preservation weakening/source change/SQLdiagnostic/operation inferred from failure or request. On ACTUALanswer readFULL/retainraw/currentauthorities and implementauthorizedNEWconcrete graph/meaningfulguards/exactallhashSourcePASS/freshR4+unusedrootunit before any operation. NativefallbackONLYif actualanswerstillmissing~20min after01:06:51UTC, NOEARLIER01:26:51/freshactualtargetEMPTYcomposer/preservehumans/no duplicates. Previous0018nativefollowup answered/neverrepeat. Noactiveproof/localrunnerretainer; all003000rootunitPASSpackageoperatorshelpers consumed NEVERretryreplaycleanup. Latestpassing233000KEEPIT/R2COMPLETE/no moreprune/YY320GiBalreadyvisible/nohostgrowrestart. MainMERGEHOLD/no kitgatedeployapproval/SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Futurekit/gate MUST disclose several-minute restartwindow514s/483s(prior333392s);600/805blankheapSwap0/floorlogs+10GB/500MB/science/refusals/fullreports/nonzeroYYapprovedSTOP/separateforwardfix/no103/noagentsnewchatworktreecheckout/humanfilesdraftcards held. PreserveALLolderhistoryverbatim.

"""
with (D/'checkpoint-prefix.txt').open('xb') as f:f.write(lead.encode())
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
fixed=[pathlib.Path(__file__),R/'WP/backlog-resume-20261013/post-jobs003000-closed-row-refusal-result-once.py',*readmes];paths=sorted(p for p in D.rglob('*') if p.is_file())+fixed
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
verify(git('write-tree').decode().strip());git('commit','-m','Retain actual closed jobs preservation failure handoff to Claudio');head=git('rev-parse','HEAD').decode().strip();verify(head);git('push','origin',BRANCH)
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
print(json.dumps({'head':head,'commentId':d['id'],'commentUrl':d['url'],'verifiedRawOidShaLengthFiles':len(paths),'sourceAnd1333InputsUnchanged':True},ensure_ascii=True))
