"""One concrete clarification of literal no-WAL diagnostic scope; no host or SQLite calls."""
import datetime,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-jobs-intake-be837974-20261016';A=S/'actual-result-accepted6205724552-empty-wal-boundary-once';D=S/'diagnostic-empty-wal-scope-question-once';MARKER='jobs003000-diagnostic-owned-empty-wal-scope-6205724552';BASE='27055babfc6dfe482cbd88ef412c846c31ed6ff0'
sys.path.insert(0,str(S));from proof_contract import canonical,sha
def git(*a):return subprocess.check_output(['git',*a],cwd=R)
assert git('rev-parse','HEAD').decode().strip()==BASE and not git('diff','--cached','--name-only').strip() and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not D.exists()
bound=json.loads((A/'scope-boundary-record.json').read_bytes());assert bound['actualBothWalFilesPresentEmpty'] and bound['answerId']==6205724552 and bound['hostCalls']==bound['sqliteConnections']==0
D.mkdir();captures=[]
def api(*args):
 prefix='api-original-'+str(len(captures)).zfill(2);argv=['gh','api',*args]
 (D/(prefix+'-command.json')).write_bytes(canonical({'argv':argv,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 r=subprocess.run(argv,cwd=R,capture_output=True,timeout=90)
 (D/(prefix+'.json')).write_bytes(r.stdout);(D/(prefix+'-stderr.log')).write_bytes(r.stderr);(D/(prefix+'-exit.json')).write_bytes(canonical({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 captures.append({'file':prefix+'.json','argv':argv,'bytes':len(r.stdout),'sha256':sha(r.stdout)})
 assert r.returncode==0,'Unknown read or POST; preserve originals, inspect using NEW reader, NEVER replay'
 return r.stdout
comments=json.loads(api('repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T01:06:50Z&per_page=100'));assert len(comments)<100 and not any(MARKER in c['body'] for c in comments)
answer=next(c for c in comments if c['id']==6205724552);assert sha(answer['body'].encode())==bound['answerBodySha256'] and answer['created_at']==answer['updated_at'] and answer['performed_via_github_app']['id']==1236702
body=f'''@claude One concrete input-boundary clarification before implementing Step1 of6205724552. [{MARKER}]

Acknowledging your actual003000 result acceptance and diagnostic-only scope here; no separate ACK/native. Your suspected cross-submission-duplicate cause remains an inference, not a diagnostic result. I independently checked all six relevant source files (the five you named plus sampleStateService): currentbe837974 bytes equal predecessor959d17e. Main remains held and233000 stays latest passing KEEPIT.

Your Step1 says to **refuse if either backup has a WAL**. The already published closed-retention inventory (captured **2026-10-16T00:58:01.663319+00:00**) shows that **both exact proposed inputs have existing0400 zero-byte WAL files plus0400 32768B SHM files**. This is retained original metadata, not a new probe or SQL result:

| Within consumed003000 root | Bytes | SHA256 | inode |
|---|---:|---|---:|
|startup-1-stopped-seal/backup.db|563322880|9dc3c00dc4ac148d9eae23b63bd71ef4e9e60ada432aa20bc898d6fcf7c8944a|2118533|
|startup-1-stopped-seal/backup.db-wal|0|e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855|2118534|
|startup-1-stopped-seal/backup.db-shm|32768|fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb|2118535|
|first-sync.db|563322880|6580e5a3c72ce420f78711641df7719e4a57da6700f777bd02dcf79c0e95b6f7|2124061|
|first-sync.db-wal|0|e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855|2124672|
|first-sync.db-shm|32768|fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb|2124673|

All6 mode0400/device64769; original stat/mtime/allocation and hashes are in the [published retention record](https://github.com/yigini/soilfer-lims/blob/b73a299bc10f79e41b6e52d78d65c7cce4e8ece7/WP/batch-proof-jobs-intake-be837974-20261016/jobs003000-closed-row-refusal-originals-once/closed-retention-record.json). No database bytes were fetched or connected by the retainer. I have made no host calls or SQLite connections this wake and have not removed/checkpointed/copied/modified these files.

**Proposed narrow exception for your confirmation:** the genuinely NEW diagnostic may accept only these exact existing zero-byte WALs, verify full retained SHA/stat of BOTH main/WAL/SHM triples before and after, and open only the two owned main files with `mode=ro&immutable=1`. Any nonempty WAL, unexpected file/alias/missing input or changed SHA/stat refuses before SQL (and any post-read change refuses the result). SHM contents are preserved and hash/stat checked; never read as authority or rewritten. No copies, checkpoint, WAL/SHM deletion, containers, production files, old-input SQL, runtime network or writes inside003000. Output only in a new small root/unit; fresh floor+log-reserve capacity check per your diagnostic exception; exact new Source review:PASS and one attempt still mandatory.

All your other Step1 requirements stay: compare ALL112 tables/schema/42receipts; changed/deleted/added original-row inventory; originalSample status/scope/column and metadata/fieldMetadata structural diffs; retained first-fetch-id membership; exact hold/audit counts/types/raisedBy/markers/actions; classify CROSS_SUBMISSION_DUPLICATE/PRIMARY_REVISION/UNEXPLAINED. Public output only ids/column names/key paths/counts/classification/value hashes, all raw values retained privately. Any unexplained/protected/deleted/non-EXPECTED/status/scientific/reception/approval change stops and reports, no remedy drafted. Step2 awaits your diagnostic acceptance, then new exact reviewed allowance/guards/R4+10GB/newroot/oneattempt/controller-owned-container stop safety.

May Step1 use the exact-empty-WAL exception above, or should it retain the literal any-WAL refusal? I have not implemented or executed the diagnostic yet because the latter would refuse the known inputs. This is a scope clarification, not a SourcePASS or permission to relax preservation. No rerun, cleanup, production action or YY decision requested. The original result6205679602/003000 failure and all retained originals remain unchanged; no native duplicate needed.
'''
(D/'actual-question-body-utf8.txt').write_bytes(body.encode());request=D/'post-request.json';request.write_bytes(json.dumps({'body':body},ensure_ascii=False).encode())
(D/'post-intent.json').write_bytes(canonical({'marker':MARKER,'createdUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'onePostOnly':True,'neverRetry':True,'sourceReviewRequested':False,'scopeClarificationOnly':True}))
raw=api('--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(request));posted=json.loads(raw);(D/'actual-post-response.json').write_bytes(raw);assert posted['body']==body
fresh=json.loads(api('repos/yigini/soilfer-lims/issues/comments/'+str(posted['id'])));assert fresh['body']==body and fresh['id']==posted['id'] and fresh['created_at']==fresh['updated_at']
(D/'actual-fresh-readback.json').write_bytes(canonical(fresh)+b'\n');(D/'api-command-index.json').write_bytes(canonical(captures)+b'\n')
value={'status':'ONE_EMPTY_WAL_DIAGNOSTIC_SCOPE_CLARIFICATION_POSTED_NOT_SOURCE_APPROVAL','id':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'bodySha256':sha(body.encode()),'acceptanceAcknowledgedOnlyHere':6205724552,'marker':MARKER,'freshReadbackBodyExact':True,'sourceOrRuntimeImplemented':False,'hostCalls':0,'sqliteConnections':0,'proofReplays':0}
(D/'delivery-record.json').write_bytes(canonical(value)+b'\n');print(json.dumps(value,ensure_ascii=True))
