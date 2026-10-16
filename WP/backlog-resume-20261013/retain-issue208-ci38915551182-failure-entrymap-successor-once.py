"""Retain CLOSED failed CI and exact evidence limits; no CI retry or host action."""
import io,re,zipfile
from prechecks6210209468_boundary_publication import *
D=W/'WP/backlog-resume-20261013/issue208-ci38915551182-failure-parent-successor-once'
P=pathlib.Path('C:/Users/yigin/.codex/worktrees/issue-208-labels/soilfer-lims/server/tests/.tmp_issue208')
assert not D.exists() and not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').decode().strip()=='002a6479e2a8d50ad739ff37ed72d48f986caef7'
index_raw=(P/'pr299-ci-38915551182-closed-evidence-sha256.json').read_bytes()
assert sha(index_raw)=='6a3dc3167e5200baab6d77427878ee1c2a8d3f05390d0bf0413ad87448aa572a'
rows=json.loads(index_raw);assert len(rows)==10
originals={}
for row in rows:
    path=pathlib.Path(row['path']);assert path.parent==P
    raw=path.read_bytes();assert sha(raw)==row['sha256'];originals[path.name]=raw
full=originals['pr299-ci-38915551182.log'];inventory=json.loads(originals['pr299-ci-38915551182-inventory.json'])
local_path=pathlib.Path('C:/Users/yigin/AppData/Local/Temp/soilfer-issue208-correction-d4GZfH/evidence/closed-test-inventory.json')
local_raw=local_path.read_bytes();assert sha(local_raw)=='5a588350ade8997f34d03d244290919df74adbab2e012217008e0e1feebec1cb'
local=json.loads(local_raw);out={};current=None;console=False;excluded=0
for raw in full.decode('utf-8').splitlines():
    parts=raw.split('\t',2)
    if len(parts)!=3 or parts[1]!='Run server test suite':continue
    line=re.sub(r'^\ufeff?[0-9T:.Z-]+ ','',parts[2]);line=re.sub(r'\x1b\[[0-9;]*m','',line)
    if re.match(r'^  console\.[a-z]+$',line):console=True;continue
    if re.match(r'^\s+at ',line):console=False;continue
    match=re.match(r'^PASS\s+(tests/\S+)',line)
    if match:current=match[1];assert current not in out;out[current]=[];console=False
    elif line.lstrip().startswith('\u2713 '):
        if console:excluded+=1
        else:assert current is not None;out[current].append(line)
expected={name.removeprefix('server/') for name in local['files']}
assert len(out)==376 and sum(map(len,out.values()))==5725 and set(out)==expected
assert set(inventory['files'])==set(local['files']) and inventory['suites']==376
assert b'Test Suites: 376 passed, 376 total' in full and b'Tests:       5725 passed, 5725 total' in full
archive=originals['pr299-ci-38915551182-original-logs.zip'];entries=[];selected={}
assert len(archive)==1380610 and sha(archive)=='295b440095d35327457fff6e795e3021b3367608fcd9079e56a770f60a40072a'
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    assert len(z.namelist())==len(set(z.namelist()))==21 and sum(v.file_size for v in z.infolist())<64*1024**2
    for name in z.namelist():
        assert not name.startswith('/') and '..' not in name.split('/')
        raw=z.read(name);entries.append({'path':name,'bytes':len(raw),'sha256':sha(raw)})
        for needle,target in [('Run server test suite','server-original.txt'),('Run Real Disposable Docker Boundary Rehearsal','boundary-original.txt'),
            ('Run Real Docker Deployment Readiness Acceptance','readiness-original.txt')]:
            if needle in name:assert target not in selected;selected[target]=raw
assert {r['path']:r for r in entries}=={r['path']:r for r in json.loads(originals['pr299-ci-38915551182-entry-sha256.json'])}
assert len(selected)==3
failure=b'199 default entrypoint changed retained analytical, audit or receipt rows'
assert failure in selected['readiness-original.txt']
for n in range(1,6):assert ('Scenario '+str(n)+' PASSED').encode() in selected['boundary-original.txt']
endpoints=['repos/yigini/soilfer-lims/actions/runs/38915551182','repos/yigini/soilfer-lims/actions/runs/38915551182/jobs',
    'repos/yigini/soilfer-lims/pulls/299','repos/yigini/soilfer-lims/git/commits/72adbe43b36319e6f9d8088baa61b0fbe26bb3ff',
    'repos/yigini/soilfer-lims/git/ref/heads/main']
raws=[subprocess.check_output(['gh','api',endpoint],cwd=W) for endpoint in endpoints]
run,jobs,pr,commit,main=map(json.loads,raws)
assert run['id']==38915551182 and run['run_attempt']==1 and run['status']=='completed' and run['conclusion']=='failure'
assert run['head_sha']==pr['head']['sha']==commit['sha']=='72adbe43b36319e6f9d8088baa61b0fbe26bb3ff'
assert commit['tree']['sha']=='2e562ca28eff2229b321db490b4f243882e44021'
assert pr['state']=='open' and pr['draft'] and pr['base']['sha']==main['object']['sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
steps={s['name']:s for j in jobs['jobs'] for s in j['steps']}
for name in ['Build client production bundle','Run server test suite','Build Docker image','Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
    'Run Real Disposable Docker Boundary Rehearsal']:assert steps[name]['conclusion']=='success'
assert steps['Run Real Docker Deployment Readiness Acceptance']['conclusion']=='failure'
D.mkdir()
for name,raw in originals.items():save(D,name,raw)
save(D,'agent-closed-evidence-sha256.json',index_raw);save(D,'frozen-local-inventory.json',local_raw)
for i,raw in enumerate(raws):save(D,'api-original-'+str(i)+'.json',raw)
for name,raw in selected.items():save(D,name,raw)
save(D,'parent-server-reporter-lines.json',canonical(out)+b'\n')
save(D,'parent-independent-verification.json',canonical({'run':38915551182,'attempt':1,'head':run['head_sha'],
    'tree':commit['tree']['sha'],'conclusion':'failure','suiteCount':376,'testCount':5725,
    'everyServerReporterLineCounted':True,'consoleCheckmarksExcluded':excluded,'exactFrozenLocal376InventoryEqual':True,
    'all21ArchiveEntriesIndependentlyHashed':True,'closedZipSha256':sha(archive),'readinessFailure':failure.decode(),
    'guaranteedStaticAddedSampleKey':'labSampleCode','actualBeforeAfterRowPayloadsAvailable':False,
    'soleActualMismatchProven':False,'actualOldValueOrReceiptEqualityRecomputed':False,
    'parentAuthorizedSmallestLocalComparatorCorrectionAndFocusedTestsOnly':True,
    'fullRunCommitPushOrNewCiAuthorized':False,'readyAuditOrMergeAuthorized':False,'hostCalls':0})+b'\n')
lead=f"""ACTUAL #208 NEW-HEAD CI CLOSED FAILED / ORIGINALS RETAINED / LOCAL COMPARATOR CORRECTION ONLY - {utc()}.
PR299 exact72adbe43b36319e6f9d8088baa61b0fbe26bb3ff/tree2e562ca28eff2229b321db490b4f243882e44021 ordinaryCI38915551182attempt1 COMPLETE/FAILURE. Original parent retainer refused ZIP list-order equality BEFORE evidence-directory/README/Git/host mutation; unchanged helper preserved/neverreplayed. Unique successor compares EVERY exact entry object by path while retaining the original archive order. Parent independently checked all5725 server reporter lines/376uniquePASSsuites/exactfrozenlocalinventory/all21originalZIPentryhashes/fullghlog/server-boundary-readiness originals. Client/server/bothrealDockerbuilds/ALL5boundary scenarios PASS; readiness fails at rehearsal_deployment_readiness.cjs:1426 '199 default entrypoint changed retained analytical, audit or receipt rows'. OverallFAILURE/neverretry. Original38898578537alsoimmutableFAILED.
Source-domain analysis guarantees SELECT* gains canonical180 Sample.labSampleCode:null for retainedSample rows. Actualbefore/after row/receipt arrays were NOTprinted and discardedCIvolumes are gone: soleactualmismatch and actualoldvalue/receipt equality CANNOT be independently proven from closedlogs. No invented reconciliation. Parent NOWauthorizes existing208 agent smallest LOCAL preservation-comparator correction+focusedtests ONLY: everyoldcolumn/value/row/receipt protected, exactsole nullableTEXT/null-default Sample.labSampleCode with NULLexistingrows permitted, allotheradditions/type/nullability/default/backfill/oldvalue/receipt mutations refuse. Approved180DDL/owner/appbehavior unchanged. Report concretepatch/focusedresults/hashes BEFORE frozenfullrun/commit/push/newheadCI. No retry/ready/audit/merge/newagents/worktrees.
207 actualONEready/request6218049200 remains finalClAUDITPENDING/no duplicates/native/merge. Releasekit208LOCALPASS/source002a6479e2a8d50ad739ff37ed72d48f986caef7/446raw verified; copy precreate admissions andApachetimestamp roundtrip implemented, completewholecopy/evidence/filesystem closure and fullfreshreviewedcapturelauncher STILLMISSING/copy-site-closure.json ABSENT/noSourceReview to waitfor/nohost/package/root/unit/gate/deployment. KEEP IMPLEMENTING. ALLmainmerges HOLD actualbeDEPLOYED+actualClpostcheckPASS. SameheartbeatACTIVE2min/restore10ONLYactualmilestone.621299+621326govern/ACK621326ONLYnextCOMPLETEsourceReview/ALLnativefallbacksCANCELLED/noduplicates. Earlier history follows verbatim.

"""
print(json.dumps(boundary_publish(D,{pathlib.Path(__file__).resolve(),W/'WP/backlog-resume-20261013/retain-issue208-ci38915551182-failure-parent-once.py'},'docs(audit): retain labels CI failure and bounded correction scope',lead)))
