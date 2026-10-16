"""Retain ONE source request/fresh boundary and preserve all prior README bytes."""
import pathlib,json,subprocess,sys,hashlib,datetime
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/controller063000-prechecks-be837974-20261016'
D=B/'exact-source-review94-handoff-once';Q=B/'exact-source-review94-once';HEAD='a6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1'
sys.dont_write_bytecode=True;sys.path.insert(0,str(B));import diagnostic_contract as c
assert not D.exists();D.mkdir()
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==HEAD and not git('diff','--cached','--name-only').strip()
delivery=json.loads((Q/'delivery-record.json').read_bytes());assert delivery['commentId']==6209870952
captures=[]
def gh(path,paginated=False):
    args=['gh','api']+(['--paginate','--slurp'] if paginated else [])+[path]
    r=subprocess.run(args,capture_output=True,timeout=90);name='fresh-api-'+str(len(captures)).zfill(2)
    (D/(name+'.json')).write_bytes(r.stdout);(D/(name+'-stderr.log')).write_bytes(r.stderr);(D/(name+'-exit.json')).write_bytes(c.canonical({'exitCode':r.returncode}));captures.append({'file':name+'.json','argv':args,'sha256':c.sha(r.stdout),'length':len(r.stdout)})
    assert r.returncode==0,'Network failure is not no answer'
    return json.loads(r.stdout)
fresh=gh('repos/yigini/soilfer-lims/issues/comments/6209870952');request=json.loads((Q/'post-request.json').read_bytes())
assert fresh['created_at']==fresh['updated_at']=='2026-10-16T06:52:31Z' and fresh['body']==request['body'] and c.sha(fresh['body'].encode())==delivery['bodySha256']
comments=[v for page in gh('repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T06:52:30Z&per_page=100',True) for v in page]
later=[v for v in comments if v['id']!=6209870952 and (v.get('performed_via_github_app') or {}).get('id')==1236702]
main=gh('repos/yigini/soilfer-lims/commits/main');ci=gh('repos/yigini/soilfer-lims/actions/runs/38772398721');issue=gh('repos/yigini/soilfer-lims/issues/191')
assert main['sha']=='be8379745bdfae52ce46496ff26514dc7d729640' and ci['head_sha']==main['sha'] and ci['status']=='completed' and ci['conclusion']=='success' and ci['run_attempt']==1 and issue['state']=='closed'
record={**delivery,'freshObservedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'laterActualCommentIds':[v['id'] for v in later],'actualNewExactSourcePassPending':not later,'mainCiStillClosedSuccess':True,'issue191':'CLOSED','requestBodyUneditedEqual':True,'sourceFilesFrozen':True,'operatorCalls':0}
index=json.loads((Q/'source-index.json').read_bytes())
for name,pin in index['files'].items():assert c.sha((B/name).read_bytes())==pin['sha256']
(D/'delivery-record.json').write_bytes(c.canonical(record)+b'\n');(D/'fresh-command-index.json').write_bytes(c.canonical(captures)+b'\n')
lead=f"""LATEST ACTUAL NEW063000 PRECHECK EXACT SOURCE REVIEW6209870952 POSTED - 2026-10-16T06:52:31Z.
Complete NEW sourcea6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1/18Python1JS7data=26bindings/143rawGitOID-SHA-length verified/final94LOCAL+94ACTUALhostPython3.9.23 PASS/sourceunchanged. ONE@claude162 SourceReview6209870952 https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6209870952 markercontroller063000-prechecks94-a6d8c5d5-accepted6208837867/bodySHAc71de3e847816b01e111426545642065a30d8eb3e21bdcbccd90e2f8e189004a/ALL26SHA+ALL41tokens. Actual6208837867ACK bundledONLYhere/requestJSON==actualresponse==freshuneditedreadback. Full old063000result6208657786 ANSWERED;05:38:06nativefallbackCANCELLED/NEVERrepeat. Fresh actual new review IDs after request: {[v['id'] for v in later]}; when EMPTY exactSourcePASS PENDING at {record['freshObservedUtc']}. No duplicateACK/GH/native/source request. NEWnativefallbackONLYifTHISsourceanswerstillmissingabout20min/NOEARLIER2026-10-16T07:12:31UTC/freshactualtargetEMPTYcomposer/preservehumans/no duplicates.
Graph/README/source94-publication-once/publication-index.json and exact97predicatewriter-map at WP/controller063000-prechecks-be837974-20261016/. Exact16lowerhexfingerprint vsapp357; actualunpatchedLOCALwholecontroller Node output345bfa7727c61604 throughchecked_cross; hostPythonusesretainedactualLOCALNodeoutput/nohostNodeexecutionclaim. Otherstrictpredicatesunchanged; in-place existing-conflict985-1014 deliberately Oldmetadataarraychanged refusal/explicitmaplimitation/no silentallowance. Hook phase/staticliteralorHMAC afterkey/EACHcallmetadataBEFOREpredicates/ALLrawstreamsHOST0400inspectENV-JWT NEVERfetch/empty-stderr unchanged/readonlywrapperPSINSPECTONLY.
NEWprepare/launch/runtime UNEXECUTED exceptimportcompileclosedFAKEguards. ProposedsoleNEW080000diagnosticroot/2units uncreatedbyus/no operationalpackage/check. Final94LOCAL94hostINMEMORY/realDocker0/productionSQL0/newsyntheticSQLonly/numericreaderunpatched. FAKEdispatched:true stdout is closedrendered-templatefixture, NOTactualrootunit. Earliermissingdependency/VMmodule/bootstraprender/localrequestgeneratorrefusals retainedhonestly/nooperatorreplay.
NEXT FULL actualNEW exact26SHA+41tokenSourcePASS/findings; id>6208837867/created>05:33:23Z/uneditedClaudeapp1236702slugclaude/firstlineSource review: PASS/own diagnostic_contract.approval. Retainraw/currentauthorities/all143sourcebindings/all26+old31+1333 BEFOREONElocalpackage/publish/launcherfreshR4+10GB beforeROOTimmediatelyUNIT/runtime+unusedrootBOTHunits. C1two063000mainscopiedNEWroot/open ONLYcopiesROimmutable/original6SHAstatbeforeafter/exactverify_copy181/fetch/all11242/zeroRefusals/allholdauditsconsumed/newprivateHMACHOST/publiccountsclassificationskeyedonly vs186/22logs. C2unpatchednewstop_exact+realcall BOTHalreadySTOPPED063000owners Typeexec805Swap0UMask0077journal/PSINSPECTONLY/noactualstopstart/percallrawHOSTONLY. ONErunEACH/noretry/sequential/checkresultsrequireactualClacceptance THENdistinctattemptgraphbindsacceptance+ownNEWexactSourcePASS/freshR4unusedrootunit/ONEattempt. No qualificationattempt/kit/gate/deployauthority yet.
Allold063000source572d/PASS620818/rootunit/package/operators/oncehelpersimmutableCONSUMED NEVERpatchretryreplaycleanup. MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/YY320GiBvisible/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Futurekit186/22LOGONLYuntilvalidated/countsmaydiff+9to10minrestart/exact600failure. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

"""
(D/'checkpoint-prefix.txt').write_bytes(lead.encode())
readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for p in readmes:
    prior=p.read_bytes();p.write_bytes(lead.encode()+prior);assert p.read_bytes()[len(lead.encode()):]==prior
paths=sorted(p for p in Q.rglob('*') if p.is_file())+sorted(p for p in D.rglob('*') if p.is_file())+[pathlib.Path(__file__),W/'WP/backlog-resume-20261013/request-controller063000-prechecks94-source-once.py',*readmes]
rows=[{'path':p.relative_to(W).as_posix(),'length':len(p.read_bytes()),'sha256':c.sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]
pub=D/'publication-index.json';pub.write_bytes(c.canonical({'baseAudit':HEAD,'actualComment':6209870952,'bindings':rows})+b'\n');paths.append(pub);names=[p.relative_to(W).as_posix() for p in paths]
git('-c','core.autocrlf=false','add','-f','--pathspec-from-file=-','--pathspec-file-nul',input=b'\0'.join(n.encode() for n in names)+b'\0')
assert {v.decode() for v in git('diff','--cached','--name-only','-z').split(b'\0') if v}==set(names)
def verify(prefix):
    raw=git('cat-file','--batch',input=('\n'.join(prefix+n for n in names)+'\n').encode());at=0
    for p in paths:
        end=raw.index(b'\n',at);given,kind,length=raw[at:end].decode().split();length=int(length);at=end+1;data=raw[at:at+length];at+=length
        assert kind=='blob' and data==p.read_bytes() and given==oid(data) and raw[at:at+1]==b'\n';at+=1
    assert at==len(raw)
verify(':');git('commit','-m','Retain exact precheck source review6209870952 and fresh handoff');head=git('rev-parse','HEAD').decode().strip();verify(head+':');git('push','origin','HEAD:audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
print(json.dumps({'audit':head,'rawGitOidShaLengthFilesVerified':len(paths),'actualSourceRequest':6209870952,'laterActualComments':record['laterActualCommentIds'],'sourceBindingsFrozen':26,'hostOperations':0}))
