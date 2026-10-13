"""Use the scanner's existing strict fixture-call form after closed failure."""
import ast,datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
terminal=json.loads((wp/'issue214-scanner-caller-focused-failure/terminal-boundary.json').read_bytes())
assert terminal['summary']['status']=='FAILED_OR_INCOMPLETE' and terminal['summary']['failed']==1
before=json.loads((wp/'issue214-scanner-caller-focused/source-after.json').read_bytes())
assert all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in before.items())
git=lambda *args:subprocess.check_output(['git',*args],cwd=root)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').strip()==b'1015c0ac2e9ff8acdc7041f0700c94313ba7f5a3'
dest=wp/'issue214-scanner-call-form-correction'
names=['verify-issue214-scanner-call-form-focused-once.py','verify-issue214-scanner-call-form-full-once.py']
assert not dest.exists() and all(not (wp/name).exists() for name in names)
fixture=root/'server/tests/contracts/audit_2_3_compatibility_runs.test.js'
raw=fixture.read_bytes();newline=b'\r\n' if b'\r\n' in raw else b'\n'
needle=b"        require('../helpers/calculationReleasePrerequisites').installCalculationReleasePrerequisites(record.file);"
assert raw.count(needle)==1
replacement=newline.join([b"        const { installCalculationReleasePrerequisites } = require('../helpers/calculationReleasePrerequisites');",
                           b"        const ownedDatabaseFile = record.file;",
                           b"        installCalculationReleasePrerequisites(ownedDatabaseFile);"])
after=raw.replace(needle,replacement)
restored=after.replace(b', nativeCurrentSchema = false',b'').replace(b", nativeCurrentSchema: targetKind === 'NATIVE'",b'')
blockStart=restored.index(b'    if (nativeCurrentSchema) {')
blockEnd=restored.index(b'    const db = new PrismaClient',blockStart)
restored=restored[:blockStart]+restored[blockEnd:]
assert restored.replace(b'\r\n',b'\n')==git('show','6d750914d8565acdd496767a7dd935811b5a89b2:server/tests/contracts/audit_2_3_compatibility_runs.test.js')
dest.mkdir();(dest/'fixture-before-original.js').write_bytes(raw)
fixture.write_bytes(after);(dest/'fixture-after-original.js').write_bytes(after)
script="const fs=require('node:fs');const {scanSource}=require('./tests/helpers/workflowWriteScanner');const findings=scanSource(fs.readFileSync('./tests/contracts/audit_2_3_compatibility_runs.test.js','utf8'),'tests/contracts/audit_2_3_compatibility_runs.test.js',[]);process.stdout.write(JSON.stringify(findings));if(findings.length)process.exitCode=1;"
checked=subprocess.run(['node','-e',script],cwd=root/'server',stdout=subprocess.PIPE,stderr=subprocess.PIPE)
(dest/'static-scanner-stdout-original.json').write_bytes(checked.stdout)
(dest/'static-scanner-stderr-original.log').write_bytes(checked.stderr)
assert checked.returncode==0 and json.loads(checked.stdout)==[]
for old,new,oldDest,newDest in zip(['verify-issue214-scanner-caller-focused-once.py','verify-issue214-scanner-caller-full-once.py'],names,
                                  ['issue214-scanner-caller-focused','issue214-scanner-caller-full'],
                                  ['issue214-scanner-call-form-focused','issue214-scanner-call-form-full']):
    text=(wp/old).read_text(encoding='utf-8').replace("dest = wp / '"+oldDest+"'","dest = wp / '"+newDest+"'")
    text=text.replace("assert (wp / 'issue214-full-fixture-corrected-terminal/index.json').is_file()",
                      "assert (wp / 'issue214-scanner-caller-focused-failure/index.json').is_file()")
    ast.parse(text,filename=new);(wp/new).write_bytes(text.encode())
record={'preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'auditSourceBefore':git('rev-parse','HEAD').decode().strip(),
        'changedSource':['server/tests/contracts/audit_2_3_compatibility_runs.test.js'],
        'existingScannerPredicatesUnchanged':True,'staticScannerFindings':[],
        'releasedCompatibilityStatementsAndAssertionsByteIdentical':True,
        'preparedHelpers':names,'preparedHelpersNotExecuted':True,'productionOperations':0,
        'sourceBeforeSha256':hashlib.sha256(raw).hexdigest(),'sourceAfterSha256':hashlib.sha256(after).hexdigest()}
(dest/'preparation-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
print(json.dumps(record))
