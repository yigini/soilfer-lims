"""Retain actual209 historical/schema decisions before its implementation; no duplicate acknowledgement."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-actual-decisions-6163271808'
assert not dest.exists()
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
audit=git('rev-parse','HEAD').decode().strip();assert audit=='f738f01e2e159b37ad04961ef6e3e22e917af03e'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
raw={name:command('gh','api',path) for name,path in [
 ('answer-original.json','repos/yigini/soilfer-lims/issues/comments/6163271808'),
 ('issue209-original.json','repos/yigini/soilfer-lims/issues/209'),
 ('main-original.json','repos/yigini/soilfer-lims/git/ref/heads/main'),
 ('merged-commit-original.json','repos/yigini/soilfer-lims/git/commits/2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8')]}
answer=json.loads(raw['answer-original.json']);assert answer['performed_via_github_app']['slug']=='claude'
assert answer['id']==6163271808 and answer['created_at']==answer['updated_at']=='2026-10-14T07:31:44Z'
assert 'answering 6163178638' in answer['body'] and 'legacy resolution before refusal' in answer['body']
assert json.loads(raw['main-original.json'])['object']['sha']=='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
assert json.loads(raw['merged-commit-original.json'])['tree']['sha']=='f2152e240b355cd141612b783c6ccf04f5c8383a'
dest.mkdir()
for name,data in raw.items():(dest/name).write_bytes(data)
(dest/'answer-original.md').write_bytes(answer['body'].encode())
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'ACTUAL_SCOPE_ACCEPTED_IMPLEMENTATION_STARTING',
 'issue':209,'comment':6163271808,'commentUrl':answer['html_url'],'createdUtc':answer['created_at'],
 'priorQuestion':6163178638,'main':'2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8',
 'installerHistoricalRowChanges':0,'historicalAttemptRelinks':0,'productionOperations':0,
 'nativeAcknowledgementSent':False,'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in raw.items()}}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 actual historical/data-model decisions6163271808 accepted; implementation starting

ActualClaude app answer6163271808 at07:31:44UTC answers question6163178638 under YY delegated authority. FULL answer retained issue209-actual-decisions-6163271808. NO installer cleanup/backfill/revision-row changes; readonlydry counts allsampleswithmultipleACTIVE+IDs forkit. Explicitreasonedcommand requiresfulltargetifmultipleACTIVE, reconcilesactualWorkItems, supersedesALLpriorACTIVEs/linesvaluesretained, auditsallIDs+priorActiveCount, createsoneACTIVE; useinsert/activationtrigger (notpartialuniqueindexagainsthistoricalduplicates). NullableOrderLine.workItemId NEWrowsONLY/immutableafterinsert; newattempt INSERT resolves linkedline first, otherwiseexactlyonelegacyNULLline matchingnormalisedanalysis/samplewithinexactlyoneACTIVErevision. NO blanketlegacyworkrefusal; refuseORDER_LINE_REQUIRED onlyzero/multiplematches/multipleACTIVEs, reasonedrevision guidance. Retainedattempt/lineidentityunchanged; historicalOPENfirstfillkeepsoriginalNULL. Repeat+scientificamendmentreservation insertlinks. Kitreadonlycount openWorkItemsrefusedbycause+noline/ambiguous/multipleACTIVE,YYseeslistbeforegateifnonzero. Mandatoryreasonchangedorder/normalisedcodes/bothroutes+initialgenerationoneorderService; finalsampleamendment409guardunchanged. ScopeacceptanceNOTfinalauditPASS. Currentmain2242/treeauditedf215 independentlyread; SAMEauditwriter/branch. Beginindependentrequest-validationdraft/tests now, no productioncollection/operation. PR296sourcePASS+merge/nativeackcomplete/mainCI38528593695active; #214+#206undeployed/open. Humancontent/103noapply/owner no normalization/kit/science/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir()]+readmes+[Path(__file__).relative_to(root).as_posix()]
pins={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in owned if path not in readmes}
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,digest in pins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==digest,path
git('commit','-m','audit(209): retain actual historical order and new-attempt link decisions')
retained=git('rev-parse','HEAD').decode().strip()
for path,digest in pins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==digest,path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'comment':6163271808,'verifiedBlobs':len(pins),'schemaHistoryChanges':0,'productionOperations':0}))
