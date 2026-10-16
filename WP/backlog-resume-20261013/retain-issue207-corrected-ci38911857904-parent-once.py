"""Retain original CLOSED CI and independent parent checks. No GitHub mutation."""
import io,re,zipfile
from prechecks6210209468_boundary_publication import *
D=W/'WP/backlog-resume-20261013/issue207-corrected-ci38911857904-parent-once'
P=pathlib.Path('C:/Users/yigin/AppData/Local/Temp/soilfer-207-verify-af36ba07-768c-4bb9-8aa6-79263be8c197')
assert not D.exists() and not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').decode().strip()=='a0561cb9adfa376c9afd5b0f770b4e73a1fc4cf5'
expected={'summary.json':'845dd977ae00e5aee226d68cfb3c5c9bdc174e0ebe79835822a360dc57a2fdf5',
    'result.json':'96803a1cdf8dfe3224644cb7c07c0f04b4c5628f7abfe94e09a5173f93c6de8a',
    'full.log':'7654f2140937cd625c2b82124036e04012218adf8833f769fe3e09fba09fb331',
    'inventory.json':'b6d02e8eb011626c61b069346e6e545d399ed2a89b3f945820b5d3ec03287ead',
    'docker-results.txt':'57d0a487a4f8f7ad0a11daecf55c721f6b7f91dce78898729fad3878ce7da163'}
originals={suffix:(P/('ci-38911857904-'+suffix)).read_bytes() for suffix in expected}
assert all(sha(raw)==expected[name] for name,raw in originals.items())
inventory=json.loads(originals['inventory.json']);local_raw=(P/'inventory-harness.json').read_bytes();local=json.loads(local_raw)
out={};current=None;console=False
for raw in originals['full.log'].decode('utf-8').splitlines():
    parts=raw.split('\t',2)
    if len(parts)!=3 or parts[1]!='Run server test suite':continue
    line=re.sub(r'^\ufeff?[0-9T:.Z-]+ ','',parts[2]);line=re.sub(r'\x1b\[[0-9;]*m','',line)
    if re.match(r'^  console\.[a-z]+$',line):console=True;continue
    if re.match(r'^\s+at ',line):console=False;continue
    match=re.match(r'^PASS\s+(tests/\S+)',line)
    if match:current=match[1];assert current not in out;out[current]=[];console=False
    elif line.lstrip().startswith('\u2713 ') and not console:out[current].append(line)
assert out=={row['path']:row['tests'] for row in inventory['suites']}
assert len(out)==374 and sum(map(len,out.values()))==5710 and set(out)==set(local['suites'])
assert b'Test Suites: 374 passed, 374 total' in originals['full.log'] and b'Tests:       5710 passed, 5710 total' in originals['full.log']
def api(endpoint):return subprocess.check_output(['gh','api',endpoint],cwd=W)
endpoints=['repos/yigini/soilfer-lims/actions/runs/38911857904','repos/yigini/soilfer-lims/actions/runs/38911857904/jobs',
    'repos/yigini/soilfer-lims/pulls/300','repos/yigini/soilfer-lims/git/commits/ad9d2660041c4db380d73a759871987d625f7404',
    'repos/yigini/soilfer-lims/git/ref/heads/main']
raws=[api(endpoint) for endpoint in endpoints];run,jobs,pr,commit,main=map(json.loads,raws)
assert run['id']==38911857904 and run['run_attempt']==1 and run['event']=='pull_request' and run['status']=='completed' and run['conclusion']=='success'
assert run['head_sha']==pr['head']['sha']==commit['sha']=='ad9d2660041c4db380d73a759871987d625f7404'
assert commit['tree']['sha']=='0470e4a5549e4048ae35f39f8b8a2e22d9cd5bfa'
assert pr['base']['sha']==main['object']['sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert pr['state']=='open' and not pr['draft']
steps={step['name']:step for job in jobs['jobs'] for step in job['steps']}
for name in ['Build client production bundle','Run server test suite','Build Docker image',
    'Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
    'Run Real Disposable Docker Boundary Rehearsal','Run Real Docker Deployment Readiness Acceptance']:
    assert steps[name]['status']=='completed' and steps[name]['conclusion']=='success'
archive=api('repos/yigini/soilfer-lims/actions/runs/38911857904/logs')
assert 0<len(archive)<=16*1024**2
entries=[];selected={}
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    names=z.namelist();assert len(names)==len(set(names)) and len(names)<=100
    assert sum(row.file_size for row in z.infolist())<=64*1024**2
    for name in names:
        assert not name.startswith('/') and '..' not in name.split('/')
        raw=z.read(name);entries.append({'name':name,'bytes':len(raw),'sha256':sha(raw)})
        for needle,output in [('Run server test suite','server-original.txt'),
            ('Run Real Disposable Docker Boundary Rehearsal','boundary-original.txt'),
            ('Run Real Docker Deployment Readiness Acceptance','readiness-original.txt')]:
            if needle in name:
                assert output not in selected;selected[output]=raw
assert len(selected)==3
assert b'Test Suites: 374 passed, 374 total' in selected['server-original.txt'] and b'Tests:       5710 passed, 5710 total' in selected['server-original.txt']
for n in range(1,6):assert ('Scenario '+str(n)+' PASSED').encode() in selected['boundary-original.txt']
assert b'COMPLETE_207' in selected['readiness-original.txt'] and b'calculationEntrypointProof' in selected['readiness-original.txt']
D.mkdir()
for i,raw in enumerate(raws):save(D,'api-original-'+str(i)+'.json',raw)
for name,raw in originals.items():save(D,'ci-'+name,raw)
save(D,'frozen-local-suite-inventory.json',local_raw);save(D,'logs-original.zip',archive)
for name,raw in selected.items():save(D,name,raw)
save(D,'archive-entry-hashes.json',canonical(entries)+b'\n')
save(D,'parent-independent-verification.json',canonical({'run':38911857904,'attempt':1,'head':run['head_sha'],
    'tree':commit['tree']['sha'],'status':'completed','conclusion':'success','suiteCount':374,'testCount':5710,
    'all5710ReporterLinesIndependentlyEqual':True,'exact374LocalSuiteInventoryEqual':True,
    'consoleCheckmarksExcludedUsingExplicitConsoleStackContext':True,'closedOriginalZipSha256':sha(archive),
    'allArchiveEntriesIndependentlyHashed':True,'allRealDockerStepsSuccess':True,'mainMergeHold':True,
    'readyOrAuditRequested':False,'productionOperations':0,'ciRetriesOrRedispatches':0})+b'\n')
lead=f"""CORRECTED #207 ORDINARY CI CLOSED GREEN / PARENT ORIGINAL-LOG REVIEW - {utc()}.
PR300 exactad9d2660041c4db380d73a759871987d625f7404/tree0470e4a5549e4048ae35f39f8b8a2e22d9cd5bfa, ordinaryCI38911857904attempt1 actuallyCOMPLETE/SUCCESS14:38:08Z. Parent independently matched ALL5710test reporter lines/374uniquePASSsuites to the original full log and frozen local inventory; excluded129console checkmarks by explicit console/stack context, not raw tick count. Both actual candidate+supported-baseline Docker builds, ALL5boundary scenarios and real readiness acceptance inclCOMPLETE207/emptyledger/no-op/receipt preservation passed. Original closedZIP/EVERYentryhash/server/boundary/readiness originals/fullghlog/API+agenthashes retained. These are DISPOSABLE CI rollback/restore tests, never production recovery authority. Main/base stillbe837974; ALLmainmerges HOLD actualbeDEPLOYED+actualClpostcheckPASS. Ready/exact-head audit NOTYETsent at this retention boundary; parent will send ONE after fresh exacthead/currentCI/no-duplicate checks. Originalfailed38898969962attempt1 remains immutable/no retry. Existing208same38915551182attempt1 observedonly. Releasekit199LOCALPASS/wholecopy-filesystemclosure+completefreshcapturelauncher stillmissing/no host/sourceReview/root/gate/deployment. SameheartbeatACTIVE2min/restore10ONLYactualdeployment+Clpostcheck. All older history follows unchanged.

"""
print(json.dumps(boundary_publish(D,{pathlib.Path(__file__).resolve()},'docs(audit): retain corrected custody CI and independent inventory review',lead)))
