"""Retain actual exact Step 2 approval and current authorities, without host operations."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, tempfile
W = pathlib.Path(__file__).resolve().parents[2]
REL = 'WP/batch-proof-controller-forward-step2-be837974-20261016/'
B = W / REL
D = B / 'actual-result-accepted6208837867-once'
BASE = 'b68aaee6e9576e3f96bb6fac3b24e1f543fbd195'
SOURCE = '572d8cc94ee5a98c29392f556a57133cedd13128'
sys.dont_write_bytecode = True
sys.path.insert(0, str(B))
from proof_contract import *
import prepare_proof as prep

def git(*args, input=None):
    return subprocess.check_output(['git', '-c', 'core.longpaths=true', *args], cwd=W, input=input)

def oid(raw):
    return hashlib.sha1(('blob ' + str(len(raw)) + '\0').encode() + raw).hexdigest()

require(git('rev-parse', 'HEAD').decode().strip() == BASE and git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8' and not git('diff', '--cached', '--name-only').strip() and not D.exists(), 'Same writer/base/one retention required')
index = exact_json((B / 'exact-source-review420-once/source-index.json').read_bytes())
require(index['head'] == SOURCE and len(index['files']) == 31 and len(tokens(index)) == 179, 'Exact31source/179bindings required')
pubraw = git('show', SOURCE + ':' + REL + 'source420-publication-once/publication-index.json')
pub = exact_json(pubraw)
require(len(pub['bindings']) == 658, 'Complete658 indexed originals required')
raws = prep.raw_git_many(SOURCE, [r['path'] for r in pub['bindings']])
for row in pub['bindings']:
    data = raws[row['path']]
    require(len(data) == row['bytes'] and sha(data) == row['sha256'] and oid(data) == row['gitBlobOid'], 'Published raw identity differs ' + row['path'])
for name, pin in index['files'].items():
    data = raws[REL + name]
    require(data == (B / name).read_bytes() and len(data) == pin['bytes'] and sha(data) == pin['sha256'] and oid(data) == pin['blob'], 'Source changed ' + name)
frozen = exact_json((W / 'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
require(len(frozen) == 1333, 'App inventory differs')
for name, digest in frozen.items():
    require(sha((W / name).read_bytes()) == digest, 'App changed ' + name)
old_graphs = [
    ('04c99271e761198937aa798131075f199e86b679', 'WP/batch-proof-jobs-intake-be837974-20261016/', 'exact-source-review323-once/tooling-source-index.json', 26, []),
    ('46338c544e44e56091eb3b18edc515ece5d44095', 'WP/jobs-row-diagnostic-private-be837974-20261016/', 'exact-source-review105-private-once/source-index.json', 8, ['diagnostic-pins.json', 'first-fetch-original.json', 'baseline-logical-original.json']),
    ('bb2d337dc4e39021bf413dbe31c2749bb02da65a', 'WP/jobs-row-diagnostic-be837974-20261016/', 'exact-source-review80-git-aware-once/source-index.json', 8, ['diagnostic-pins.json', 'first-fetch-original.json', 'baseline-logical-original.json']),
]
old_verified = []
for head, rel, idxpath, count, data_names in old_graphs:
    old = exact_json((W / rel / idxpath).read_bytes())
    require(len(old['files']) == count and old['head'] == head, 'Old immutable graph differs')
    names = list(old['files']) + data_names
    originals = prep.raw_git_many(head, [rel + n for n in names])
    for name in names:
        data = (W / rel / name).read_bytes()
        require(data == originals[rel + name], 'Old immutable bytes differ ' + rel + name)
        if name in old['files']:
            require(sha(data) == old['files'][name]['sha256'], 'Old source pin differs ' + name)
    old_verified.append({'head': head, 'sourceFiles': count, 'metadataFiles': len(data_names)})
captures = []
original = prep.command
def capture(*args):
    raw = original(*args)
    if args[:2] == ('gh', 'api'):
        captures.append((list(args), raw))
    return raw
prep.command = capture
review_raw = capture('gh','api','repos/yigini/soilfer-lims/issues/comments/6208837867')
review=exact_json(review_raw)
require(review['id']==6208837867 and review['created_at']==review['updated_at']=='2026-10-16T05:33:23Z' and (review.get('performed_via_github_app') or {}).get('id')==1236702 and review['performed_via_github_app']['slug']=='claude','Actual unedited Claude direction required')
require(first_line(review['body'])=='Result review: 063000 closed failure accepted as reported, not release qualified. Forward scope below.' and sha(review['body'].encode())=='aa67bdb4236ae9e59063ff530ac84405694cc43b8d3ade498c196ab0e21d569a' and sha(canonical(authority_projection(review)))=='f260602d431018eacf632a04fc331515ed53746e9d08b8a2ba938e5d2650927d','Exact new full direction changed')
evidence = prep.current_evidence()
require(exact_json(capture('gh', 'api', 'repos/yigini/soilfer-lims/issues/191'))['state'] == 'closed', 'Issue191 changed')
receipt = prep.raw_git(BUILD_EVIDENCE, prep.BUILD_REL + 'build-receipt.json')[0]
inspection = prep.raw_git(BUILD_EVIDENCE, prep.BUILD_REL + 'image-inspect-original.json')[0]
qualified(exact_json(receipt), receipt, exact_json(inspection)[0])
accepted_publications=[]
for head,relpath,expected in [
 ('96bad20b3bcb7195f9112572b5c5075124cdada1',REL+'controller-forward063000-closed-refusal-publication-once/publication-index.json',9731),
 ('b68aaee6e9576e3f96bb6fac3b24e1f543fbd195',REL+'controller-forward063000-closed-refusal-handoff-once/publication-index.json',175)]:
 raw_index=git('show',head+':'+relpath); publication=exact_json(raw_index); entries=publication.get('files',publication.get('bindings',[]))
 require(len(entries)==expected,'Accepted publication inventory differs')
 bound=prep.raw_git_many(head,[r['path'] for r in entries])
 for row in entries:
  data=bound[row['path']]; require(len(data)==row.get('length',row.get('bytes')) and sha(data)==row['sha256'] and oid(data)==row['gitBlobOid'],'Accepted raw publication identity differs')
 accepted_publications.append({'head':head,'indexPath':relpath,'indexSha256':sha(raw_index),'verifiedRawFiles':expected+1})
D.mkdir()
def save(name, data):
    with (D / name).open('xb') as handle:
        handle.write(data)
save('actual-result-acceptance-original.json', review_raw)
save('acceptance-semantic-projection.json', canonical(authority_projection(review))+b'\n')
save('actual-result-acceptance-readable.txt', review['body'].encode())
save('tooling-source-index.json', canonical(index) + b'\n')
save('source-publication-index398-original.json', pubraw)
save('current-authority-evidence.json', canonical(evidence) + b'\n')
for i, (_, raw) in enumerate(captures):
    save('api-original-' + str(i).zfill(2) + '.json', raw)
save('api-command-index.json', canonical([{'file': 'api-original-' + str(i).zfill(2) + '.json', 'argv': argv, 'length': len(raw), 'sha256': sha(raw), 'gitBlobOid': oid(raw)} for i, (argv, raw) in enumerate(captures)]) + b'\n')
record={'status':'ACTUAL_CLOSED063000_FAILURE_ACCEPTED_NEW_PRE_ATTEMPT_CHECK_SCOPE_ONLY','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualAcceptanceId':review['id'],'bodySha256':sha(review['body'].encode()),'semanticSha256':sha(canonical(authority_projection(review))),'acceptedPublications':accepted_publications,'sourceHead':SOURCE,'all659SourceRawGitOidShaLengthVerified':True,'all31SourceUnchanged':True,'all1333AppInputsUnchanged':True,'oldImmutableGraphsVerified':old_verified,'currentAuthoritiesVerified':True,'newSourceGraphExists':False,'newSourcePassExists':False,'hostOperations':0,'productionSqliteConnections':0,'privateBytesFetched':0,'old063000ConsumedNeverReplay':True,'nativeFallbackCancelledAnswered':True,'acknowledgementPendingOnlyConcreteNewSourceRequest':True}
save('independent-acceptance-validation.json', canonical(record) + b'\n')
lead = 'LATEST ACTUAL CLOSED063000 FAILURE ACCEPTANCE6208837867 - 2026-10-16T05:33:23Z.\nFULL actual unedited Claude app1236702/slugclaude accepts CLOSED063000 FAILURE as reported, NOT_RELEASE_QUALIFIED. BodySHAaa67bdb4236ae9e59063ff530ac84405694cc43b8d3ade498c196ab0e21d569a/semanticf260602d431018eacf632a04fc331515ed53746e9d08b8a2ba938e5d2650927d. All9732 closed96bad20b and176 handoffb68aaee6 rawGitOID-SHA-length verified/all659source/31source/1333app/currentmainbeCI38772398721attempt1pushSUCCESS/191CLOSED verified. Actualresult6208657786 ANSWERED;05:38:06nativefallbackCANCELLED/NEVERrepeat/no duplicateACK/GH/native.\nNEW separately audited scope: comparator fingerprint EXACT16lowerhex per bound app writer, reject64/upper/15/17/nonstring; guard uses actual unpatched bound computeEvidenceFingerprint Node output. Writer map EVERY format/shape predicate of classify_sample/marker_expected/paired/checked_cross/validate_added_and_changed/kobo_copy_preservation including in-place revision985-1014: fix newly mirrored differences or explain conservatively. recordedAt/all strict other predicates stay. Stop hook per-owner phase/public_failure after key; static sites; EACHdocker call raw stdoutstderr HOSTONLY0400+publicargv/returncode/elapsed/SHA/length BEFORE predicates. RawinspectENV/JWT_SECRET NEVERfetchpublish; stderr only after contentreview. StopsFIRST/exactowners/alreadystoppedretained/everyerrorFAIL/empty-stderr remains. HookcauseUNKNOWN; Clfake-replay/command-interface conjectures HIS evidence/inferences, no actualcause inferred.\nORDER new complete reviewed diagnostic graph/NEWexactSourcePASS -> TWO one-run/no-retry checks -> actualClresultacceptance -> distinct attemptgraph bindsacceptance + ownNEWexactSourcePASS/freshR4+10GB/unusedrootunit/ONEattempt. Check1 copies retained063000boundinputbackup+first-sync.db into NEWroot/open ONLYcopiesRO/retainedupstream-first-completion/full11242 verify_copy/no productionDBcontainersnetwork/newprivateHMACHOST/publicclassificationcountsliteralkeyedhashONLY/originalSHAstatbeforeafter/controller805Swap0OOM0/floor+10GB/500MB. Wholefirstcomparison zero refusals/allholdauditsconsumed/countsnextto186/22reported. Check2 unpatchednewstop_exact+realcall against BOTHalreadySTOPPED063000owners insideTypeexec805Swap0UMask0077journalunit; wrapperrefusesANYdockerverbexceptpsinspect; B2hostonlyrawrecords mandatory/noactualstopstart. Eitherresultuseful, not inferredPASS.\nNOnew diagnostic graph/sourcePASS/package/root/check/attempt exists atacceptance. NEXT ACTUALLYimplement completeNEWauthorizedgraph/meaningfulactualwriter+hostcommandguards/publish/NEWexactallhashSourceReview; ACK620883 bundledONLYconcreteNEWrequest. Old063000source572d/PASS620818/rootunit/package/operators/helpers CONSUMED immutableNEVERpatchretryreplaycleanup. NOdiagnosticSQL/productionmemory/du/stop/sourceeditoldgraph now. Allstrictpairing/fullpreservation/memory600 unchanged. MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Futurekitimpact186/22REPORTONLYuntilvalidated/countsmaydiff+9to10minrestart/exact600failure. Nothing forYY. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.\n\n'
save('checkpoint-prefix.txt', lead.encode())
readmes = [W / 'WP/audit-release-eb6de2e8/README.md', W / 'WP/runtime-recovery-kobo/README.md']
for path in readmes:
    prior = path.read_bytes(); path.write_bytes(lead.encode() + prior)
    require(path.read_bytes()[len(lead.encode()):] == prior, 'Prior history changed')
paths = sorted(p for p in D.iterdir() if p.is_file()) + [pathlib.Path(__file__), *readmes]
save('publication-index.json', canonical({'baseAudit': BASE, 'sourceReviewId': review['id'], 'files': [{'path': p.relative_to(W).as_posix(), 'length': len(p.read_bytes()), 'sha256': sha(p.read_bytes()), 'gitBlobOid': oid(p.read_bytes())} for p in paths]}) + b'\n')
paths.append(D / 'publication-index.json')
names = [p.relative_to(W).as_posix() for p in paths]
fd, path_file = tempfile.mkstemp(prefix='lims-step2-pass620762-', suffix='.paths'); os.close(fd)
pathlib.Path(path_file).write_bytes(b'\0'.join(n.encode() for n in names) + b'\0')
git('-c', 'core.autocrlf=false', '--literal-pathspecs', 'add', '-f', '--pathspec-from-file=' + path_file, '--pathspec-file-nul')
require({n.decode() for n in git('diff', '--cached', '--name-only', '-z').split(b'\0') if n} == set(names), 'Staged ownership differs')
def verify(ref):
    data = git('cat-file', '--batch', input=('\n'.join(ref + n for n in names) + '\n').encode()); at = 0
    for path in paths:
        end = data.index(b'\n', at); given, kind, length = data[at:end].decode().split(); length = int(length); at = end + 1
        raw = data[at:at+length]; at += length
        require(kind == 'blob' and raw == path.read_bytes() and oid(raw) == given and data[at:at+1] == b'\n', 'Raw publication differs'); at += 1
    require(at == len(data), 'Expanded publication')
verify(':')
git('commit', '-m', 'Retain accepted closed063000 failure and new check scope6208837867')
head = git('rev-parse', 'HEAD').decode().strip(); verify(head + ':')
git('push', 'origin', 'HEAD:audit/release-eb6de2e8')
require(git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == head, 'Remote publication differs')
require(not git('diff', '--cached', '--name-only').strip(), 'Staged output remains')
print(json.dumps({'audit': head, 'actualPass': review['id'], 'sourceOriginalsVerified': 659, 'literalBindings': 179, 'sourceFilesVerified': 31, 'appInputsVerified': 1333, 'rawGitFilesVerified': len(paths), 'serverOperations': 0}))
