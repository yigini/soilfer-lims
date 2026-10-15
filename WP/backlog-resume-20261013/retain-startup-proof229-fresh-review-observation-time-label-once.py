"""Fresh waiting-review observation and explicit drafting-time label correction."""
import datetime,hashlib,json,pathlib,subprocess,sys
repo=pathlib.Path(__file__).resolve().parents[2];source=repo/'WP/batch-proof-startup-be837974-20261015';sys.path.insert(0,str(source))
from proof_contract import *
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true','-c','core.autocrlf=false',*a],cwd=repo)
base=git('rev-parse','HEAD').decode().strip();assert base=='51f1939126eb40e0593fd240199c2c7046979137' and not git('diff','--cached','--name-only')
d=source/'fresh-source-review-observation-and-time-label-once';assert not d.exists();d.mkdir()
raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T21:39:24Z&per_page=100'],cwd=repo);comments=exact_json(raw);observed=datetime.datetime.now(datetime.timezone.utc).isoformat()
(d/'fresh-overlap-original.json').write_bytes(raw)
(d/'delivery-publication-commit-time-original.txt').write_bytes(git('show','-s','--format=%H%n%aI%n%cI',base))
index=exact_json((source/'exact-source-review-29fa0007-once/tooling-source-index.json').read_bytes());assert graph(index)=={n:sha((source/n).read_bytes()) for n in FILES}
note={'status':'ACTUAL_FRESH_SOURCE_REVIEW_OBSERVATION_NOT_APPROVAL','observedUtc':observed,'sourceCommit':index['head'],'requestId':6202838614,'commentsObserved':[{k:c[k] for k in ['id','created_at','updated_at']} for c in comments],'actualReviewNotInferred':True,'all14SourceHashesUnchanged':True,'prior51f19391Readme2144Label':'DRAFTING_TIME_LABEL_NOT_PRODUCER_OBSERVATION_UTC','actualPrimaryRequestCreatedUtc':'2026-10-15T21:39:25Z','actualPrimaryRequestRetainedClosedUtc':'2026-10-15T21:39:26.853776+00:00','originalCommittedPrimaryArtifactsUntouched':True,'operatorsExecuted':0}
(d/'observation-and-label-correction-derived.json').write_bytes(canonical(note)+b'\n')
lead='LATEST ACTUAL REVIEW OBSERVATION — '+observed+'. New exact proof source29fa000751f25447f1ff8c129b0dfcc5d2b67445/all14hashes UNCHANGED;ONErequest6202838614 posted21:39:25UTC/deliverypublication51f1939126eb40e0593fd240199c2c7046979137/full45rawOID-SHA-lenverified. Fresh actual#162overlap observed IDs '+','.join(str(c['id']) for c in comments)+'. NoSourcePASSinferred. Priorlead21:44UTC was a drafting-time label, NOTproducer observation; actualprimaryrequestcreated21:39:25/retainedclosed21:39:26.853776UTC remainunchanged; correctionrecord+actualGitcommittimesretained. NEWSourcePASS pending unlessactualnewfullreview isread;full112tokens/14SHA/630rawsourcebindings/229local229ACTUALhost required. Nooperator/package/root/unit/proof/defaultstartup. NativefallbackONLY~21:59ifanswerstillmissing/freshactualtargetEMPTYcomposer/preservehumans/no duplicate. Allpostrebootresizealreadyvisible/nohostgrowth/newR4reference41.768GBvs109.578GB/EXACTfreshpackageR4future/YYpins/science/history/mainmergeHOLD remain.\\n\\n'
# Actual newline bytes, not literal escape text.
lead=lead.replace('\\n','\n')
readmes=[repo/'WP/audit-release-eb6de2e8/README.md',repo/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
files=list(d.iterdir())+readmes+[pathlib.Path(__file__)]
def meta(p):
 b=p.read_bytes();return {'path':p.relative_to(repo).as_posix(),'length':len(b),'sha256':sha(b),'gitBlobOid':hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()}
rows=[meta(p) for p in files];ip=d/'publication-index.json';ip.write_bytes(canonical({'status':'ACTUAL_WAITING_OBSERVATION_AND_DRAFT_TIME_LABEL_CORRECTION','files':rows})+b'\n');files.append(ip);rows.append(meta(ip))
git('add','-f','--',*[p.relative_to(repo).as_posix() for p in files])
assert set(git('diff','--cached','--name-only','-z').decode().split('\0'))-{''}=={r['path'] for r in rows}
for r in rows:
 b=git('show',':'+r['path']);assert len(b)==r['length'] and sha(b)==r['sha256']
git('commit','-m','audit: retain fresh proof review observation and timestamp clarification')
head=git('rev-parse','HEAD').decode().strip()
for r in rows:
 b=git('show',head+':'+r['path']);assert len(b)==r['length'] and sha(b)==r['sha256'] and hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==r['gitBlobOid']
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'head':head,'rawsVerified':len(rows),'observedUtc':observed,'commentIds':[c['id'] for c in comments],'sourceUnchanged':True,'operatorsExecuted':0}))

