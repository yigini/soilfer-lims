"""Independent original-archive review; no CI retry or GitHub mutation."""
import collections,io,re,zipfile
from prechecks6210209468_boundary_publication import *
D=W/'WP/backlog-resume-20261013/issue207-ci38956418902-parent-once'
E=pathlib.Path('C:/Users/yigin/AppData/Local/Temp/soilfer-207-verify-af36ba07-768c-4bb9-8aa6-79263be8c197')
S=pathlib.Path('C:/Users/yigin/.codex/worktrees/issue-207-custody/soilfer-lims')
prefix='ci-38956418902'
assert not D.exists() and not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').decode().strip()=='6ca233f81258a8a95931cf5080e81dc1506e75f7'
summary_raw=(E/(prefix+'-summary.json')).read_bytes();assert sha(summary_raw)=='44580878a83f78c46542c1328240c16a04fffeb9f6e3b38ef25e04a8234d464b'
summary=json.loads(summary_raw);originals={};pins=[]
for row in summary['artifacts'].values():
    path=pathlib.Path(row['path']);assert path.parent==E
    raw=path.read_bytes();assert sha(raw)==row['sha256'] and ('bytes' not in row or row['bytes']==len(raw))
    originals[path.name]=raw;pins.append({'path':path.name,'bytes':len(raw),'sha256':sha(raw)})
assert len(originals)==15
originals[prefix+'-summary.json']=summary_raw
assert sha(originals[prefix+'-full.log'])=='404c9113747483f91e57641ede9a59f78844fa456502cf12bd3438c5aa7f514d'
assert len(originals[prefix+'-full.log'])==6004202
inventory=json.loads(originals[prefix+'-inventory.json'])
local_raw=(E/'audit-6218788735-full-1-inventory-closed.json').read_bytes();local=json.loads(local_raw)
assert sha(local_raw)=='638665325acd50a2ff4b4d1581d1cfe0edee4e9ed63febda2c2705b03e12711d'
D.mkdir()
for name,raw in originals.items():save(D,name,raw)
save(D,'frozen-local-inventory.json',local_raw)
archive=subprocess.run(['gh','api','repos/yigini/soilfer-lims/actions/runs/38956418902/logs'],cwd=W,capture_output=True)
save(D,'original-logs.zip',archive.stdout);save(D,'archive-download-stderr.txt',archive.stderr)
assert archive.returncode==0 and not archive.stderr and len(archive.stdout)<16*1024**2
entries=[];selected={};all_entries={}
with zipfile.ZipFile(io.BytesIO(archive.stdout)) as z:
    assert len(z.namelist())==len(set(z.namelist())) and 1<=len(z.namelist())<=64
    assert sum(x.file_size for x in z.infolist())<=64*1024**2
    for name in z.namelist():
        assert not name.startswith('/') and '..' not in name.split('/')
        raw=z.read(name);entries.append({'entry':name,'bytes':len(raw),'sha256':sha(raw)});all_entries[name]=raw
        save(D,'archive-original-entries/'+name,raw)
        for needle,out in [('Run server test suite','server-original.txt'),('Run Real Disposable Docker Boundary Rehearsal','boundary-original.txt'),
            ('Run Real Docker Deployment Readiness Acceptance','readiness-original.txt')]:
            if needle in name:assert out not in selected;selected[out]=raw
assert len(selected)==3
save(D,'archive-entry-hashes.json',canonical(entries)+b'\n')
for name,raw in selected.items():save(D,name,raw)
def payload(raw,step=None):
    result=[]
    for line in raw.decode('utf-8').splitlines():
        if step is not None:
            bits=line.split('\t',2)
            if len(bits)!=3 or bits[1]!=step:continue
            line=bits[2]
        result.append(re.sub(r'\x1b\[[0-9;]*m','',re.sub(r'^\ufeff?[0-9T:.Z-]+ ','',line)))
    return result
def reporter(lines):
    out={};current=None;console=False;excluded=0
    for line in lines:
        assert not re.match(r'^FAIL\s+tests/',line)
        if re.match(r'^  console\.',line):console=True;continue
        if re.match(r'^\s+at ',line):console=False;continue
        if console and re.match(r'^  \S',line):console=False
        m=re.match(r'^PASS\s+(tests/\S+)',line)
        if m:current=m[1];assert current not in out;out[current]=[];console=False
        elif re.match(r'^\s+[\u2713\u221a] ',line):
            if console:excluded+=1
            else:assert current is not None;out[current].append(line)
    return out,excluded
out,excluded=reporter(payload(selected['server-original.txt']))
full,excluded_full=reporter(payload(originals[prefix+'-full.log'],'Run server test suite'))
assert out==full and excluded==excluded_full==129 and len(out)==374 and sum(map(len,out.values()))==5716
assert set(out)=={s['path'] for s in local['suites']}=={s['path'] for s in inventory['suites']}
assert all([re.sub(r'^\s+[\u2713\u221a] ','',line) for line in out[s['path']]]==s['tests'] for s in inventory['suites'])
assert all(len(out[s['path']])==len(s['tests']) for s in local['suites'])
assert b'Test Suites: 374 passed, 374 total' in selected['server-original.txt'] and b'Tests:       5716 passed, 5716 total' in selected['server-original.txt']
for n in range(1,6):assert ('Scenario '+str(n)+' PASSED').encode() in selected['boundary-original.txt']
ready=payload(selected['readiness-original.txt'])
assert any('ALL REAL DOCKER DEPLOYMENT READINESS SCENARIOS PASSED!' in line for line in ready)
proof=json.loads(next(line for line in ready if line.startswith('{"calculationEntrypointProof"')))['calculationEntrypointProof']['custody']
assert proof==summary['custodyReadinessProof'] and proof['ledgerCount']==0 and proof['dbWalShmPreserved'] is True
assert proof['ready']['classification']==proof['again']['classification']=='COMPLETE_207'
assert proof['ready']['mode']=='DRY_RUN' and proof['again']['mode']=='NO_OP'
assert all(type(proof[mode][key]) is int and proof[mode][key]==0 for mode in ('ready','again') for key in ('totalChanges','backfilledCount'))
strip=lambda name:re.sub(r' \([0-9.]+ ms\)$','',name)
differences=[]
for suite in inventory['suites']:
    ci=[strip(s) for s in suite['tests']];old=next(s for s in local['suites'] if s['path']==suite['path'])
    previous=[strip(s.encode('cp1252').decode('utf-8')) for s in old['tests']]
    a=[s for s in ci if s not in previous];b=[s for s in previous if s not in ci]
    if a or b:differences.append({'path':suite['path'],'ciOnly':a,'localOnly':b})
assert differences==summary['variableFixtureNameDifferences'] and len(differences)==1
assert len(differences[0]['ciOnly'])==len(differences[0]['localOnly'])==5
assert differences[0]['path']=='tests/contracts/audit_2_1_reference_placement.test.js'
head='f83f3cddfee97f9115737ae85a07650c83cef885';tree='2555f0b98b14c92cc0f895b6cd44a6ef0423a8ef';base='be8379745bdfae52ce46496ff26514dc7d729640'
source=subprocess.check_output(['git','show',head+':server/'+differences[0]['path']],cwd=S)
save(D,'reference-placement-test-source.js',source)
assert b'crypto.randomUUID()' in source and b'test.each' in source
def api(name,endpoint):
    raw=subprocess.check_output(['gh','api',endpoint],cwd=W);save(D,'api-fresh-'+name+'.json',raw);return json.loads(raw)
run=api('run','repos/yigini/soilfer-lims/actions/runs/38956418902')
jobs=api('jobs','repos/yigini/soilfer-lims/actions/runs/38956418902/jobs')
pr=api('pr','repos/yigini/soilfer-lims/pulls/300');commit=api('commit','repos/yigini/soilfer-lims/git/commits/'+head)
checkout=api('checkout','repos/yigini/soilfer-lims/git/commits/0a92d4b2b1859d3583eba3b5901f512ff410a3e1')
main=api('main','repos/yigini/soilfer-lims/git/ref/heads/main')
assert run['status']=='completed' and run['conclusion']=='success' and run['run_attempt']==1 and run['event']=='pull_request'
assert run['head_sha']==pr['head']['sha']==commit['sha']==head and pr['base']['sha']==main['object']['sha']==base
assert pr['state']=='open' and commit['tree']['sha']==checkout['tree']['sha']==tree and [p['sha'] for p in checkout['parents']]==[base,head]
assert jobs['total_count']==len(jobs['jobs'])==1 and jobs['jobs'][0]['conclusion']=='success'
steps=jobs['jobs'][0]['steps'];assert len(steps)==20 and all(s['status']=='completed' and s['conclusion']=='success' for s in steps)
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=S).decode().strip()==head
mapping=json.loads(originals['audit-6218788735-correction-commit.json'])['workingAndCommittedFiles'];assert len(mapping)==16
for name,row in mapping.items():
    raw=(S/name).read_bytes();committed=subprocess.check_output(['git','show',head+':'+name],cwd=S)
    assert sha(raw)==row['workingSha256'] and sha(committed)==row['stagedSha256']
    assert raw==committed if row['comparison']=='RAW_IDENTICAL' else row['comparison']=='ONLY_CRLF_TO_LF' and raw.replace(b'\r\n',b'\n')==committed
save(D,'agent-artifact-verified-hashes.json',canonical(pins)+b'\n')
save(D,'parent-independent-verification.json',canonical({'run':38956418902,'attempt':1,'head':head,'tree':tree,
 'status':'completed','conclusion':'success','actualCheckout':checkout['sha'],'actualCheckoutTreeEqualsHead':True,
 'suiteCount':374,'testCount':5716,'all5716OriginalZipReporterLinesEqualFullGhLog':True,'consoleCheckmarksExcluded':129,
 'allArchiveEntryHashesRetained':len(entries),'agentArtifactsIndependentlyVerified':15,'summaryAlsoVerified':True,
 'exact374FrozenDiscoveryAndPerSuiteCounts':True,'literalCaseNamesIdentical':False,'literalCaseDifferences':differences,
 'noUuidNormalization':True,'all20StepsSuccess':True,'custodyReadinessProof':proof,
 'productionRecoveryAuthority':False,'readyOrAuditRequested':False,'mainMergeHold':True,'checkedUtc':utc()})+b'\n')
lead=f'''CORRECTED #207 CI CLOSED GREEN / INDEPENDENT ORIGINALS REVIEW - {utc()}.
PR300 exactf83f3cddfee97f9115737ae85a07650c83cef885/tree2555f0b98b14c92cc0f895b6cd44a6ef0423a8ef ordinaryCI38956418902attempt1 COMPLETE/SUCCESS20:14:43Z.374suites5716testsPASS1653.038s/client/BOTHrealDocker/ALL5boundary/fullreadinessPASS. Parent independently matched ALL5716actualUTF8 reporter lines ZIP-vs-fullGHlog, excluded129consolecheckmarks, exact374uniquePASSdiscovery/per-suitecounts, ALL15agentartifacthashes+summary, all original archive entry hashes, actualcheckout0a92d4b2/tree/parents and16testedworking-vs-commit mappings. Five actual parameterized names differ by generated methodUUIDs; both raw name sets retained/literal equalityFALSE/no UUID normalization. CI restore tests are disposable, never production recovery authority. Old207audit6218788735 remains immutableFAILED/oldad9dgreenNOoverride.
Parent will send ONE new exactf83f ready/audit only after fresh head/main/CI/no-duplicate checks. PRbody/labels unchanged at this retention boundary.208actualaudit6223680579pending/no duplicates. Kit253LOCALPASS6ca233f81/wholefilesystemclosure+freshcapturelauncher unfinished/copy-site-closure.json ABSENT/noSourceReview/package/host/root/gate/deployment. Currentbekit206214209ONLY/future207custodyDRYplannedblockedcounts+3nonblockersrequired. ALLmainmergesHOLD actualbeDEPLOYED+actualClpostcheck.621299+621326govern/allnativefallbacksCANCELLED/ACK621326ONLYnextCOMPLETEkitSourceReview. HeartbeatACTIVE2min. Earlier history unchanged.

'''
print(json.dumps(boundary_publish(D,{pathlib.Path(__file__).resolve()},'docs(audit): independently close corrected custody CI originals',lead)))
