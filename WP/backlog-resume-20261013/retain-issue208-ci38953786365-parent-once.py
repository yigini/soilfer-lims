"""Independently verify CLOSED original CI; no GitHub mutation or new run."""
import collections,io,re,zipfile
from prechecks6210209468_boundary_publication import *
D=W/'WP/backlog-resume-20261013/issue208-ci38953786365-parent-once'
E=pathlib.Path('C:/Users/yigin/.codex/worktrees/issue-208-labels/soilfer-lims/server/tests/.tmp_issue208')
P=pathlib.Path('C:/Users/yigin/AppData/Local/Temp/soilfer-issue208-comparator-full-o776za/evidence')
prefix='pr299-ci-38953786365'
assert not D.exists() and not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').decode().strip()=='999a1d11c4fff3f1d5c811f061076faf43892cdd'
closure=(E/(prefix+'-closed-evidence-sha256.json')).read_bytes()
assert sha(closure)=='8fa3fdb9b294fd7cc931a44f932493b6a8b2124434c32c3dc40ebcd797c59678'
originals={}
for row in json.loads(closure):
    assert pathlib.PurePosixPath(row['path']).name==row['path']
    raw=(E/row['path']).read_bytes();assert sha(raw)==row['sha256'] and len(raw)==row['bytes']
    originals[row['path']]=raw
assert len(originals)==20
report=json.loads(originals[prefix+'-evidence.json'])
assert sha(originals[prefix+'-evidence.json'])=='3348286363999a14b27e5af1a695b16d5a4e09e4ba0f77f6a34e717278833e5b'
archive=originals[prefix+'-original-logs.zip'];assert sha(archive)=='caf43c3f13d9673944abd054e6b3f8a2315b4f54086af51be499cba3d39b1230'
entries=json.loads(originals[prefix+'-entry-sha256.json']);expected={r['entry']:r for r in entries}
assert len(expected)==len(entries)==22
selected={};all_entries={}
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    assert len(z.namelist())==len(set(z.namelist()))==22 and set(z.namelist())==set(expected)
    assert sum(row.file_size for row in z.infolist())<=64*1024**2
    for name in z.namelist():
        assert not name.startswith('/') and '..' not in name.split('/')
        raw=z.read(name);pin=expected[name]
        assert len(raw)==pin['bytes'] and sha(raw)==pin['sha256']
        all_entries[name]=raw
        for needle,output in [('Run server test suite','server-original.txt'),
            ('Run Real Disposable Docker Boundary Rehearsal','boundary-original.txt'),
            ('Run Real Docker Deployment Readiness Acceptance','readiness-original.txt')]:
            if needle in name:assert output not in selected;selected[output]=raw
assert len(selected)==3
def reporter(raw,full=False):
    out={};current=None;console=False;excluded=0
    for line in raw.decode('utf-8').splitlines():
        if full:
            parts=line.split('\t',2)
            if len(parts)!=3 or parts[1]!='Run server test suite':continue
            line=parts[2]
        line=re.sub(r'^\ufeff?[0-9T:.Z-]+ ','',line);line=re.sub(r'\x1b\[[0-9;]*m','',line)
        assert not re.match(r'^FAIL\s+tests/',line)
        if re.match(r'^  console\.[a-z]+$',line):console=True;continue
        if re.match(r'^\s+at ',line):console=False;continue
        match=re.match(r'^PASS\s+(tests/\S+)',line)
        if match:current=match[1];assert current not in out;out[current]=[];console=False
        elif line.lstrip().startswith('\u2713 '):
            if console:excluded+=1
            else:assert current is not None;out[current].append(line)
    return out,excluded
server=selected['server-original.txt'];out,excluded=reporter(server)
full,excluded_full=reporter(originals[prefix+'.log'],True)
assert out==full and excluded==excluded_full==129
assert len(out)==376 and sum(map(len,out.values()))==5761
local_raw=(P/'closed-test-inventory.json').read_bytes();local=json.loads(local_raw)
assert local['exactMatch'] is True and set(out)=={p.removeprefix('server/') for p in local['files']}
assert set(out)=={p.removeprefix('server/') for p in json.loads(originals[prefix+'-inventory.json'])['files']}
assert b'Test Suites: 376 passed, 376 total' in server and b'Tests:       5761 passed, 5761 total' in server
for n in range(1,6):assert ('Scenario '+str(n)+' PASSED').encode() in selected['boundary-original.txt']
assert b'ALL REAL DOCKER DEPLOYMENT READINESS SCENARIOS PASSED!' in selected['readiness-original.txt']
assert b'calculation-default-entrypoint-pre199' in selected['readiness-original.txt']
assert b'retainedRowsAndReceiptsPreserved' in selected['readiness-original.txt']
def api(endpoint):return subprocess.check_output(['gh','api',endpoint],cwd=W)
head='153f10e6bac02b1a962213431141fd1c54906e99';tree='34f6d9be9c00b2fd923989e4d4291a06ec333e32'
base='be8379745bdfae52ce46496ff26514dc7d729640'
endpoints=['repos/yigini/soilfer-lims/actions/runs/38953786365','repos/yigini/soilfer-lims/actions/runs/38953786365/jobs',
    'repos/yigini/soilfer-lims/pulls/299','repos/yigini/soilfer-lims/git/commits/'+head,
    'repos/yigini/soilfer-lims/git/commits/ca0de122750de6bdc9ef8f878818959f6631330a',
    'repos/yigini/soilfer-lims/git/ref/heads/main']
raws=[api(endpoint) for endpoint in endpoints];run,jobs,pr,commit,checkout,main=map(json.loads,raws)
assert run['id']==38953786365 and run['run_attempt']==1 and run['event']=='pull_request'
assert run['status']=='completed' and run['conclusion']=='success'
assert run['head_sha']==pr['head']['sha']==commit['sha']==head
assert commit['tree']['sha']==checkout['tree']['sha']==tree and [p['sha'] for p in checkout['parents']]==[base,head]
assert pr['state']=='open' and pr['draft'] and pr['base']['sha']==main['object']['sha']==base
assert jobs['total_count']==len(jobs['jobs'])==1
assert all(j['status']=='completed' and j['conclusion']=='success' for j in jobs['jobs'])
steps={s['name']:s for j in jobs['jobs'] for s in j['steps']}
for name in ['Build client production bundle','Run server test suite','Build Docker image',
    'Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
    'Run Real Disposable Docker Boundary Rehearsal','Run Real Docker Deployment Readiness Acceptance']:
    assert steps[name]['status']=='completed' and steps[name]['conclusion']=='success'
w208=E.parents[2]
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w208).decode().strip()==head
for row in report['testedFiles']:
    raw=(w208/row['path']).read_bytes();committed=subprocess.check_output(['git','show',head+':'+row['path']],cwd=w208)
    assert sha(raw)==row['sha256']
    assert raw==committed if row['stagedMatch']=='RAW_EQUAL' else row['stagedMatch']=='CRLF_TO_LF_ONLY' and raw.replace(b'\r\n',b'\n')==committed
D.mkdir()
for name,raw in originals.items():save(D,name,raw)
save(D,'agent-closed-evidence-sha256.json',closure);save(D,'frozen-local-suite-inventory.json',local_raw)
for name,raw in all_entries.items():save(D,'archive-original-entries/'+name,raw)
for name,raw in selected.items():save(D,name,raw)
for i,raw in enumerate(raws):save(D,'api-fresh-'+str(i)+'.json',raw)
save(D,'parent-independent-verification.json',canonical({'run':38953786365,'attempt':1,'head':head,'tree':tree,
    'status':'completed','conclusion':'success','actualCheckout':checkout['sha'],'actualCheckoutTreeEqualsHead':True,
    'suiteCount':376,'testCount':5761,'all5761ZipReporterLinesEqualFullGhLog':True,
    'exact376FrozenDiscovery':True,'consoleCheckmarksExcluded':129,'all22ZipEntryHashesVerified':True,
    'all20ClosedEvidenceHashesVerified':True,'allRealDockerStepsSuccess':True,
    'originalFailedRowReceiptEquality':'UNKNOWN; no retrospective PASS','productionOperations':0,
    'readyOrAuditRequested':False,'mainMergeHold':True,'checkedUtc':utc()})+b'\n')
lead=f'''CORRECTED #208 CI CLOSED GREEN / INDEPENDENT PARENT REVIEW - {utc()}.
PR299 exact153f10e6bac02b1a962213431141fd1c54906e99/tree34f6d9be9c00b2fd923989e4d4291a06ec333e32 ordinaryCI38953786365attempt1 COMPLETE/SUCCESS19:57:07Z. Exact376suites5761testsPASS1838.22s; parent independently matched ALL5761test reporter lines between original ZIP server log and fullghlog, exact376uniquePASS paths to frozen discovery, excluded129console checkmarks by explicit context, verified ALL20closed evidence files/ALL22ZIPentryhashes and fresh actual merge-checkout ca0de122/tree/parents. Client/BOTH realDocker builds/ALL5boundary/readiness incl actualPRE199 preservation allPASS. Original failed38898578537+38915551182 stay immutableFAILED; their unprinted original row/receipt payload equality remains UNKNOWN/no retrospectivePASS. Disposable CI restore tests grant no production recovery authority.
PR299 remains draft/body/labels unchanged at this retention boundary. Parent will send ONE ready/exact-head audit only after fresh exacthead/main/CI/no-duplicate checks. ALLmainmerges HOLD actualbeDEPLOYED+actualClpostcheck. Same207CI38956418902attempt1 remains observed only. Kit order-output242 published999a1d11/481raw; fullfilesystem closure/freshcapturelauncher STILLMISSING/copy-site-closure.json ABSENT/noSourceReview/package/host/root/unit/gate/deployment.621299+621326 govern/allnativefallbacksCANCELLED/ACK621326ONLYnextCOMPLETEsourceReview. SameheartbeatACTIVE2min/restore10ONLYactualmilestone. Earlier history unchanged.

'''
print(json.dumps(boundary_publish(D,{pathlib.Path(__file__).resolve()},'docs(audit): verify corrected labels CI and all original logs',lead)))
