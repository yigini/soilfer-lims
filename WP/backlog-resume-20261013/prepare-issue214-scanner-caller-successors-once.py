"""After closed failure retention, register only the approved owned fixture caller.

Preserve the pinned helper, stock assertions, other caller restrictions and all
failed runners. Prepare new unique verification successors without running them.
"""
import ast,datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
terminal=json.loads((wp/'issue214-full-fixture-corrected-terminal/terminal-boundary.json').read_bytes())
assert terminal['closed'] and terminal['summary']['status']=='FAILED_OR_INCOMPLETE'
assert all(row['suite'].replace('\\','/').endswith('/tests/security/audit_1_2_state_writes.test.js')
           and 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' in ''.join(row['failureMessages']) for row in terminal['failedCases'])
assert terminal['summary']['sourceUnchanged'] and terminal['summary']['inventoryEqual']
before=json.loads((wp/'issue214-full-fixture-corrected/source-after.json').read_bytes())
assert len(before)==415 and all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in before.items())
git=lambda *args:subprocess.check_output(['git',*args],cwd=root).decode('utf-8').strip()
assert git('branch','--show-current')=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
retention=json.loads((wp/'issue214-full-fixture-corrected-terminal/index.json').read_bytes())
for path,row in retention.items():
    assert hashlib.sha256(subprocess.check_output(['git','show','HEAD:'+path],cwd=root)).hexdigest()==row['sha256'],path
helper=root/'server/tests/helpers/calculationReleasePrerequisites.js'
assert hashlib.sha256(helper.read_bytes().replace(b'\r\n',b'\n')).hexdigest()=='5b091435c1e3ce5468a5dedcddf1f278fe3d6f6238c129804959f1826287ac57'
dest=wp/'issue214-scanner-caller-correction'
names=['verify-issue214-scanner-caller-focused-once.py','verify-issue214-scanner-caller-full-once.py']
assert not dest.exists() and all(not (wp/name).exists() for name in names)
scanner=root/'server/tests/helpers/workflowWriteScanner.js'
raw=scanner.read_bytes();newline=b'\r\n' if b'\r\n' in raw else b'\n'
needle=b"        'tests/contracts/audit_2_3_native_runs.test.js', 'tests/contracts/audit_1_2_guard_installer.test.js',"
assert raw.count(needle)==1
replacement=(b"        // Claudio6152507558: current-schema Native case in this owned compatibility fixture only."+newline+
             b"        'tests/contracts/audit_2_3_compatibility_runs.test.js',"+newline+needle)
after=raw.replace(needle,replacement)
dest.mkdir();(dest/'scanner-before-original.js').write_bytes(raw)
scanner.write_bytes(after);(dest/'scanner-after-original.js').write_bytes(after)
full=(wp/'verify-issue214-full-fixture-corrected-once.py').read_text(encoding='utf-8')
full=full.replace("dest = wp / 'issue214-full-fixture-corrected'","dest = wp / 'issue214-scanner-caller-full'")
full=full.replace("assert (wp / 'issue214-full-responsive-terminal/index.json').is_file()",
                  "assert (wp / 'issue214-full-fixture-corrected-terminal/index.json').is_file()")
focus=(wp/'verify-issue214-compatibility-prerequisite-corrected-once.py').read_text(encoding='utf-8')
focus=focus.replace("dest = wp / 'issue214-compatibility-prerequisite-corrected'","dest = wp / 'issue214-scanner-caller-focused'")
focus=focus.replace("assert (wp / 'issue214-full-responsive-terminal/index.json').is_file()",
                    "assert (wp / 'issue214-full-fixture-corrected-terminal/index.json').is_file()")
focus=focus.replace("expected = [str(server / 'tests/contracts' / (name + '.test.js')) for name in targets]",
                    "expected = [str(server / 'tests/contracts' / (name + '.test.js')) for name in targets]\n"
                    "expected += [str(server / 'tests/security/audit_1_2_state_writes.test.js'), str(server / 'tests/contracts/audit_2_6_sql_scanner.test.js')]\n"
                    "assert len(expected) == len(set(expected)) == 14")
for name,text in zip(names,[focus,full]):
    ast.parse(text,filename=name);(wp/name).write_bytes(text.encode('utf-8'))
record={'preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'auditSourceBefore':git('rev-parse','HEAD'),
        'changedSource':['server/tests/helpers/workflowWriteScanner.js'],
        'addedCaller':'tests/contracts/audit_2_3_compatibility_runs.test.js',
        'actualFixtureDirection':6152507558,'pinnedPrerequisiteHelperUnchanged':True,
        'stockAssertionsUnchanged':True,'runtimeWriterExceptionsAdded':0,'preparedHelpers':names,
        'preparedHelpersNotExecuted':True,'productionOperations':0,
        'sourceBeforeSha256':hashlib.sha256(raw).hexdigest(),'sourceAfterSha256':hashlib.sha256(after).hexdigest()}
(dest/'preparation-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
print(json.dumps(record))
