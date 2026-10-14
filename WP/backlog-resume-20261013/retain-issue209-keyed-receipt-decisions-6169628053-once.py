"""Retain the FULL actual scope answer before implementation, once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-keyed-receipt-decisions-6169628053'
assert not dest.exists()
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
assert git('rev-parse','HEAD').decode().strip()=='681ee6d2b6400cfeef7a64883d2b7210fba50f52' and git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
answer=command('gh','api','repos/yigini/soilfer-lims/issues/comments/6169628053');actual=json.loads(answer)
assert actual['id']==6169628053 and actual['created_at']=='2026-10-14T13:35:54Z' and 'answering 6169593044' in actual['body'] and 'across the two modes' in actual['body']
dest.mkdir()
files={'answer-original.json':answer,'answer-original.md':actual['body'].encode(),'current-issue-original.json':command('gh','api','repos/yigini/soilfer-lims/issues/209'),'current-comments-original.json':command('gh','api','repos/yigini/soilfer-lims/issues/209/comments?per_page=100'),'main-original.json':command('gh','api','repos/yigini/soilfer-lims/git/ref/heads/main')}
assert json.loads(files['main-original.json'])['object']['sha']=='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
files['native-reply-visual-transcription.txt']=b"Fresh Claude7867734 / LIMS Audit / Lab workflow audit and plan: actual reply says the idempotency question was answered on209; supplied key recorded once, identical retry changes nothing, different request under samekey refused, only one old expectation changes. It repeats320of650resolved/330remaining thenfullrun/PR/audit. Right composerEMPTY; centre human draft 'can you go and ask Pip' preserved. No additional native send or acknowledgement.\n"
files['decision-record.json']=(json.dumps({'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'comment':6169628053,'url':actual['html_url'],'answers':6169593044,'fullAnswerRead':True,'scope':'Exactlyone sameTX scoped receipt for either keyed mode; samepayload originalresponse/0write; differentpayload409/0write; crossmode409 evenidenticalparameters; nokey0receipts; changeonlyonelegacyexpectation0to1; addreplay/conflict/crossmode/nokey tests; listchangedlegacyexpectationinfinalaudit','currentRuntimeGap':'Mode not yet explicitly included in current payload hash, so exact identical normalized request across modes can replay. Correct under actual answer before claiming proof.','sourceChangesAtRetention':0,'nativeAcknowledgementSent':False,'finalAuditPass':False,'productionOperations':0},indent=2)+'\n').encode()
for name,raw in files.items():(dest/name).write_bytes(raw)
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'rawFiles':pins,'comment':6169628053,'fullAnswerRead':True,'implementationPending':True,'productionOperations':0},indent=2)+'\n').encode())
lead='## 2026-10-14 #209 actual keyed-receipt direction6169628053 retained before implementation\n\nFULLClanswer13:35:54UTC answersONCE6169593044: suppliedkey neverignored, exactlyone scoped receipt in sameTX onbothmodes; identicalsamekey originalresponse0writes; differingpayload4090writes; CROSSMODE409evenidenticalparameters (scope includesmode+sample+normalizedhash); nokey0receipts. ChangeONLYonelegacyreceipt0expectationto1; addexplicitreplay/differentpayload/crossmode/nokey cases/listchangedlegacyexpectationinfinalaudit. Currentmodeabsentfrompayloadhash is an implementationgap; correctunderactualanswer next, no weakeningorhiddenfixturefix.7rawblobs at issue209-keyed-receipt-decisions-6169628053/index.json; sourceunchangedatretention/nativeactualreplyread/rightEMPTY/centreHumanDraft preserved/no newack. Prior320original650casesverified/330unresolved/all78appdraftpaths/sequential7/437+unchanged63/36=9focused536; no full209PASS/PR/ready/audit/merge/kit/gate/productionoperation. Gitshow pathlimitaftercommit28d resolvedbyobjectid56verifiedblobs/sourcesequality/pushed681; rawfailure/oldhelperimmutable neverreplay. No runner. Samewriter/approvedorphanSTOP/noamendmentorderstep/backfill/relink/readonlylists/103noapply/214+206sourcegreenundeployed/historyguards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in pins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
git('commit','-m','audit(209): retain actual keyed receipt mode-scope direction');head=git('rev-parse','HEAD').decode().strip()
for path,pin in pins.items():assert hashlib.sha256(git('show',head+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'actualComment':6169628053,'rawGitBlobsVerified':len(pins),'fullAnswerRead':True,'implementationPending':True,'productionOperations':0}))
