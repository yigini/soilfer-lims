"""Publish actual single GitHub source request and fresh read-back authority."""
import datetime,hashlib,json,os,pathlib,subprocess,sys,tempfile
W=pathlib.Path(__file__).resolve().parents[2];R='WP/batch-proof-jobs-intake-be837974-20261016';B=W/R;D=B/'exact-source-review323-once'
P=B/'exact-source-review323-publication-once';assert not P.exists()
def cmd(*a,input=None):return subprocess.check_output(a,cwd=W,input=input)
def enc(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()+b'\n'
assert not cmd('git','diff','--cached','--name-only').strip()
delivery=json.loads((D/'delivery-record.json').read_bytes());request=json.loads((D/'request-original.json').read_bytes())
raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(delivery['commentId']));v=json.loads(raw)
assert v['body']==request['body'] and v['created_at']==v['updated_at']==delivery['createdAt']
assert hashlib.sha256(v['body'].encode()).hexdigest()==delivery['bodySha256']
P.mkdir();(P/'fresh-own-request-original.json').write_bytes(raw)
since='2026-10-15T23:56:29Z';comments=cmd('gh','api','repos/yigini/soilfer-lims/issues/162/comments?since='+since+'&per_page=100');values=json.loads(comments);assert len(values)<100
(P/'fresh-overlap-comments-original.json').write_bytes(comments)
sys.path.insert(0,str(B))
from proof_contract import FILES
index=json.loads((D/'tooling-source-index.json').read_bytes())
for n,p in index['files'].items():assert hashlib.sha256((B/n).read_bytes()).hexdigest()==p['sha256']
frozen=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
for n,d in frozen.items():assert hashlib.sha256((W/n).read_bytes()).hexdigest()==d
prefix=f'''LATEST COMPLETE NEW JOBS-INTAKE SOURCE + ACTUAL EXACT SOURCE REVIEW - {v['created_at']}.
ActualCl6204518776/23:36:01 ACCEPTED closed233000 startup-only jobsOFF PASS; scopeonly/notnewSourcePASS/jobsONkitgatedeploy. Rawacceptance+all8328rawGitentries/index+8326immutablelocals verified, two laterREADME leads separately currentHEAD, at oldmemoryfolder/actual-result-accepted6204518776-complete-once. HISpagecachechargeexplanation remains HIS inference/no independently proved oldcause/no retroPASS.233000 remains latestpassingKEEPIT untilpostdeploy.

COMPLETE NEW26-file source04c99271e761198937aa798131075f199e86b679 at {R}/README.md. All717 sourcepublication rawGitOID/SHA256/length files verified including source-publication-index323.json and separate source323-publication-completion-index.json. Final323LOCAL+323ACTUALhostPython3.9.23 guards CLOSEDPASS23:52:56.327798/sourceall26unchanged/all1333frozen appunchanged/old15dd14unchanged. Host sourcesINMEMORY/real subprocessDockercacheoperatorBLOCKED/0productionSQLite. OriginalLOCALharnessparsefailure0tests,301of311sourcegenerationNameErrorfailure,316bothPASS and318bothPASS retained. Originalpublicationignoredlogstagingexit1/ownedsubsetstaged/nocommit retained; NEWcompletion force-addedONLYowned717paths andverifiedALLstagedrawbytes beforecommitpush. No source/test/host replay. Exactproofoperators prepare/launch/run UNEXECUTED exceptimportcompileclosedfakeguards; no newoperationalpackage/root/unit/container/copy.

ONE@claude162 exact SourceReview{v['id']} POSTED{v['created_at']} {v['html_url']} marker{delivery['marker']}. ALL26SHA+ALL149literalbindings/source04c/323both/complete717raw. ACKactual6204518776 bundledONLYHERE. requestJSON==actualresponse==freshuneditedreadback/bodySHA{delivery['bodySha256']}. No duplicateACK/native/result/request. ActualNEWSourcePASS PENDING at this publication; nativefallbackONLYifmissingabout20min after23:56:30=>NOEARLIER00:16:30UTC/freshactualtargetEMPTYcomposer/preservehumans.

Graph: ONEjobsOFF/networknone defaultstartup+broad31API+6exacthistoricalreadonlyprobes/fullstopped112tables42receipts equality; ONEindependentjobsON/defaultbridge/nohostports defaultstartup+2NATURALtargetZMB-LAB1/SOILFER-USsyncs. Originalcopiedcursor/interval/clocks unchanged/no manualtrigger/sync/cursorrewind/configsubstitution/inventedintake/oldinputSQL/newproductionsnapshot/standaloneinstallerpolicyreplay. Intervalbounded<=30minwithoutchangingit;firstcompletion600safterready/secondafteractualinterval/watch>=interval+2minAND660healthysecs. Emptyactualpendingvalid. ALL4exactrefusalsprotected/each2natural1to1pairedrefusals/unknownerrorSTOP. OriginalschemaALL112tablesrows+42receipts preserved; onlyenumerated provenance-boundSampleAuditLogHoldNotification+activeconfigcursorclock changes, fullsecondIDsdepth/audit/notification/monotoniccursor/integrityFKguards. Copiedassets unchangedafterstop. All214209science/refusalCODESCONDITIONS/fullreportsimpacts/nonzeroYYapprovedSTOP/separateforwardremedy unchanged.

Memory EVERYactualcontainer:805306368memory=memory+swap/hostswap0/blankheap/600HTTP+finalmemoryguardunchanged/exacthostCIDPIDstartownerlimitscgroupdeviceinodemembershipwithinandbetweensamples/oom=oom_kill0/seven-field samplednonreclaimable<=603979776. PeakmaxhighreclaimOBSERVATIONONLY/notcontinuouspeak.4096samplesmax/container, SAME256MiBevidencecap/container INSIDE4GiBlogs. releaseCliPeakBytesgateREMOVED/standaloneDocker.cli UNCONDITIONALLYREFUSED; postflightchildren sharemonitoredappcgroup/nonblockingboundedstdin/SIGTERMownedstoprefusalpath. AllownedSTOPPEDretained/allhistoricalidentitiesunorderedMountsstarttimesprotected.

Budget ASTsource458appbindings:OFF12+ON13(firstsyncconsistentbackup)=N25/25percent/MINIMUM64RETAINEDforNEWjobsgraph/3assets/schema89556+markers32dirs7assetsdirs/allremainingclaimsphysicalstagecaps/floor10556150894+4GiBlogs+ADDITIONAL10GB. MetadataONLYREFERENCE23:50:57.758441 req60921981038/free95864037376EACH3canonical4096/SAMEFSnotadditive/rootABSENT/unitnot-found; NOTlaunchfit. SoleNEW /opt/lims/releases/workflow-batch-jobs-intake-be837974-20261016T003000Z/unitlims-workflow-batch-jobs-intake-be837974-20261016t003000z UNUSEDattreference. NEWexactfuturepackageallocationbeforeROOTONLY/alreadyoccupiedbeforeUNIT-runtime/freshR4beforeROOTimmediatelybeforeUNITruntime/allsourcecurrentauthoritiesunusedrootunit mandatoryAFTERactualNEWexactSourcePASS. Prior233000originalreceiptfullSHA/modeboundatruntime;080000rawreaderbackup070000assetsremainHASHSTATONLY/noSQL. Futurekit/gate MUSTdiscloseexpectedseveralminutesrestartdowntime/priorhealthy333392s/600unchanged. MainMERGEHOLDuntilactualbeDEPLOYED+ClpostdeployPASS; sourcecannotgate/deploy.

NEXT FULLactualNEWsourceverdict/findings exact04c/all26SHA/149tokens. Ownproof_contract.approval requires id>6204518776/time>23:36:01/uneditedapp1236702slugclaude/literals. IfPASS retainNEWrawactualPASS/all717sourcebindings+26source+1333app/currentbeCI38772398721attempt1pushCLOSEDSUCCESS/4appaudits6rules2postreboot+memorydirection+acceptedjobsScope/R2accepted/nolaterfailure beforeONEpackage/publish/launchfreshR4unusedrootunit. If findings retain/correctNEWsource+meaningfuluniqueguards+newreview; NOoldhelperretry. Unknownoperatoroutcome inspectSAMEnewrootunitneverredispatch. Oneattempt/no rerun/afterANYinstallerentrypointfailure separatelyauditedforwardfixONLY. AlloldproofsoperatorshelpersimmutableCONSUMED. JobsONnaturalqualificationstillUNEXECUTED/exactkitreviewfreshsingleusegatedeploylater. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClpostdeployPASS; R2COMPLETE/no moreprune/YY320GiBalreadyvisible/nohostgrowrestart/scienceR1-R5/forwardonly/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humanfilesdraftcards held. PreserveALLolderhistoryverbatim.

'''
(P/'checkpoint-prefix.txt').write_bytes(prefix.encode())
for rel in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
 p=W/rel;p.write_bytes(prefix.encode()+p.read_bytes())
paths=[p.relative_to(W).as_posix() for p in D.iterdir() if p.is_file()]+[p.relative_to(W).as_posix() for p in P.iterdir() if p.is_file()]+['WP/backlog-resume-20261013/request-jobs-intake323-exact-source-review-once.py','WP/backlog-resume-20261013/'+pathlib.Path(__file__).name,'WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
rows=[]
for n in sorted(paths):
 b=(W/n).read_bytes();rows.append({'path':n,'length':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gitBlobOid':hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()})
(P/'publication-index.json').write_bytes(enc({'sourceHead':index['head'],'actualReviewRequest':v['id'],'bodySha256':delivery['bodySha256'],'files':rows}));paths.append(P.relative_to(W).as_posix()+'/publication-index.json')
fd,p=tempfile.mkstemp(prefix='lims-jobs-handoff-',suffix='.paths');os.close(fd);pathlib.Path(p).write_bytes(b'\0'.join(n.encode() for n in paths)+b'\0')
cmd('git','-c','core.longpaths=true','-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+p,'--pathspec-file-nul')
assert {n.decode() for n in cmd('git','diff','--cached','--name-only','-z').split(b'\0') if n}==set(paths)
raw=cmd('git','cat-file','--batch',input=('\n'.join(':'+n for n in paths)+'\n').encode());at=0
for n in paths:
 end=raw.index(b'\n',at);oid,kind,sz=raw[at:end].decode().split();sz=int(sz);at=end+1;b=raw[at:at+sz];at+=sz
 assert kind=='blob' and raw[at:at+1]==b'\n' and b==(W/n).read_bytes();at+=1
 assert hashlib.sha1(('blob '+str(sz)+'\0').encode()+b).hexdigest()==oid
assert at==len(raw)
cmd('git','commit','-m','Retain exact jobs qualification source review request and handoff')
head=cmd('git','rev-parse','HEAD').decode().strip();cmd('git','push','origin','HEAD:audit/release-eb6de2e8')
assert not cmd('git','diff','--cached','--name-only').strip()
print(json.dumps({'status':'PUBLISHED','head':head,'rawGitFilesVerified':len(paths),'actualRequestId':v['id'],'newOverlapIds':[c['id'] for c in values if c['id']!=v['id']],'prefixChars':len(prefix),'sourceFilesUnchanged':len(FILES),'frozenAppUnchanged':len(frozen)},ensure_ascii=True))
