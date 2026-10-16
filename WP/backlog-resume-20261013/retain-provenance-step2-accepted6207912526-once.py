"""Retain actual exact Step 2 approval and current authorities, without host operations."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, tempfile
W = pathlib.Path(__file__).resolve().parents[2]
REL = 'WP/batch-proof-provenance-step2-be837974-20261016/'
B = W / REL
D = B / 'actual-result-accepted6207912526-once'
BASE = '43a67257d006edc897e4994d0226fbe7dca5e938'
SOURCE = '937901c7514437fc3937639454e621d1bfd68dc4'
sys.dont_write_bytecode = True
sys.path.insert(0, str(B))
from proof_contract import *
import prepare_proof as prep

def git(*args, input=None):
    return subprocess.check_output(['git', '-c', 'core.longpaths=true', *args], cwd=W, input=input)

def oid(raw):
    return hashlib.sha1(('blob ' + str(len(raw)) + '\0').encode() + raw).hexdigest()

require(git('rev-parse', 'HEAD').decode().strip() == BASE and git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8' and not git('diff', '--cached', '--name-only').strip() and not D.exists(), 'Same writer/base/one retention required')
index = exact_json((B / 'exact-source-review398-once/source-index.json').read_bytes())
require(index['head'] == SOURCE and len(index['files']) == 31 and len(tokens(index)) == 170, 'Exact31source/170bindings required')
pubraw = git('show', SOURCE + ':' + REL + 'source398-complete-publication-once/publication-index.json')
pub = exact_json(pubraw)
require(len(pub['bindings']) == 736, 'Complete736 indexed originals required')
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
review_raw = capture('gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6207912526')
review = exact_json(review_raw)
require(review.get('performed_via_github_app',{}).get('id') == 1236702 and review['performed_via_github_app'].get('slug') == 'claude' and first_line(review['body']) == 'Proof result review: 050000 closed refusal accepted (not release qualified)' and sha(review['body'].encode()) == '11664ce3faf7b9cc401632ed9b038375d89a46190ef1324fdb3e2dde7ec70ead', 'Exact unedited actual acceptance required')
require(review['id'] == 6207912526 and review['created_at'] == review['updated_at'] == '2026-10-16T04:12:57Z', 'Actual new verdict identity differs')
evidence = prep.current_evidence()
require(exact_json(capture('gh', 'api', 'repos/yigini/soilfer-lims/issues/191'))['state'] == 'closed', 'Issue191 changed')
receipt = prep.raw_git(BUILD_EVIDENCE, prep.BUILD_REL + 'build-receipt.json')[0]
inspection = prep.raw_git(BUILD_EVIDENCE, prep.BUILD_REL + 'image-inspect-original.json')[0]
qualified(exact_json(receipt), receipt, exact_json(inspection)[0])
accepted_publications=[]
for head,relpath,expected in [
 ('eaeb9981eded033b5c62da59e625a101e4cf5f1c',REL+'step2-050000-closed-refusal-publication-once/publication-index.json',139),
 ('43a67257d006edc897e4994d0226fbe7dca5e938',REL+'actual-result050000-handoff-once/publication-index.json',47)]:
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
record={'status':'ACTUAL_CLOSED050000_REFUSAL_ACCEPTED_FORWARD_SOURCE_SCOPE_ONLY','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualAcceptanceId':review['id'],'bodySha256':sha(review['body'].encode()),'semanticSha256':sha(canonical(authority_projection(review))),'acceptedPublications':accepted_publications,'sourceHead':SOURCE,'all737RawGitOidShaLengthVerified':True,'all31SourceUnchanged':True,'all1333AppInputsUnchanged':True,'oldImmutableGraphsVerified':old_verified,'currentAuthoritiesVerified':True,'newSourceGraphExists':False,'newSourcePassExists':False,'hostOperations':0,'productionSqliteConnections':0,'privateBytesFetched':0,'old050000ConsumedNeverReplay':True,'nativeFallbackCancelledAnswered':True,'acknowledgementPendingOnlyConcreteNewSourceRequest':True}
save('independent-acceptance-validation.json', canonical(record) + b'\n')
lead = f'''LATEST ACTUAL CLOSED050000 REFUSAL ACCEPTANCE6207912526 - {review['created_at']}.
FULL actual unedited Claude app1236702/slugclaude accepts closed050000 refusal, NOT_RELEASE_QUALIFIED. Actual bodySHA11664ce3faf7b9cc401632ed9b038375d89a46190ef1324fdb3e2dde7ec70ead and semantic projection retained. All140 closed eaeb9981 and48 handoff43a67257 rawGitOID/SHA256/length verified, all737 source bindings/all31 source/old26/both8source3data/1333 app unchanged. Fresh current authorities/mainbeCI38772398721 attempt1 push CLOSED SUCCESS/#191CLOSED verified. Originals at {REL}actual-result-accepted6207912526-once/publication-index.json.
NEW scope: numeric /proc/<os.getpid()>/cgroup, preserve EVERY ancestor and cgroup symlink refusal/membership/device-inode/limits/OOM; stop exact owners BEFORE review/index/hash verification then memory, poststop errors FAIL and one owner never blocks other. Add UNPATCHED actualhost own_snapshot expected Exact controller unit membership required outside unit; real numeric reader bytes equal plain open; closed numeric ancestor alias refusal. Only actual literal source require text readable, otherwise HMAC. New source request must enumerate EVERY real-host reader new since233000 and its unpatched host test or earlier accepted run.
No NEWgraph/sourcePASS/package/root/unit exists yet. NEXT ACTUALLY implement complete genuinelyNEWgraph/meaningful local+actualhost guards/publish/NEWexact allhashSourcePASS before ANYpackage/root/unit/oneattempt/freshR4+10GB/unusedrootunit. Acceptance scope is NOT SourcePASS. All050000 root/unit/PASS/package/operators/helpers CONSUMED NEVERpatchretryredispatchreplaycleanup. Result6207759369 ANSWERED;04:19:15 nativefallback CANCELLED/neverrepeat. Bundle620791ACK ONLY concrete NEWsource review request, no duplicateACK/GH/native.
233000latestpassingKEEPIT/023000accepted/R2COMPLETE/noprune/YY320GiBvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humanfilesdraftcards held. Strictpairing/orphans/secondnaturalidempotence/EVERYcontainer805600/full11242/refusals/science/N25MIN64/floor4GiBlogs10GB/500MB unchanged. Futurekit:174newEXPECTED22holds20existingZMB-LAB1/managerimpact/countsmaydiffer PLUS9to10minrestart/exact600failure. MainMERGEHOLD/SAMEheartbeat2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
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
git('commit', '-m', 'Retain accepted closed050000 refusal and new source scope6207912526')
head = git('rev-parse', 'HEAD').decode().strip(); verify(head + ':')
git('push', 'origin', 'HEAD:audit/release-eb6de2e8')
require(git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == head, 'Remote publication differs')
require(not git('diff', '--cached', '--name-only').strip(), 'Staged output remains')
print(json.dumps({'audit': head, 'actualPass': review['id'], 'sourceOriginalsVerified': 737, 'literalBindings': 170, 'sourceFilesVerified': 31, 'appInputsVerified': 1333, 'rawGitFilesVerified': len(paths), 'serverOperations': 0}))
