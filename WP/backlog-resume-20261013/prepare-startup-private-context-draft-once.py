"""Source-only explicit readiness context; preserve default CLI and writers."""
import hashlib,json,pathlib,re,subprocess
R=pathlib.Path(__file__).resolve().parents[2]
D=R/'WP/startup-order-readiness-20261015/private-context-preparation-once'
assert not D.exists()
assert subprocess.check_output(['git','branch','--show-current'],cwd=R).decode().strip()=='audit/release-eb6de2e8'
D.mkdir()
index=R/'server/index.js'; entry=index.read_text(encoding='utf-8')
names=re.findall(r"require\('./scripts/(install_\w+)'\)\.assert\w+StartupReady\(dbPath\)",entry)
assert len(names)==len(set(names))==26
before={}
for rel in ['server/index.js',*[f'server/scripts/{n}.js' for n in names]]:
 p=R/rel;b=p.read_bytes();before[rel]=hashlib.sha256(b).hexdigest()
 dest=D/'before'/rel;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b)
for name in names:
 p=R/f'server/scripts/{name}.js';s=p.read_text(encoding='utf-8')
 s=s.replace("const ","const ",1)
 marker=s.index('\n',s.index('#!'))+1 if s.startswith('#!') else 0
 s=s[:marker]+"const { openReadonlyDatabase } = require('../utils/startupReadinessContext');\n"+s[marker:]
 s,n=re.subn(r'(function install\w+\(\{)([^}]*)(\}\s*=\s*\{\}\))',lambda m:m[1]+m[2].rstrip()+', startupContext'+m[3],s,count=1);assert n==1,name
 s,n=re.subn(r'(function assert\w+StartupReady\(dbPath)(\))',r'\1, startupContext\2',s,count=1);assert n==1,name
 # Every direct assert delegates its context explicitly to its own installer.
 begin=s.index('function assert');tail=s[begin:]
 tail,n=re.subn(r'(install\w+\(\{\s*dbPath)(\s*\})',r'\1, startupContext\2',tail,count=1);assert n==1,name
 s=s[:begin]+tail
 s,n=re.subn(r'new Database\((target|copy),\s*(\{\s*readonly\s*:\s*true[^}]*\})\)',r'openReadonlyDatabase(Database, \1, \2, apply ? undefined : startupContext)',s)
 assert n>=1,name
 # Nested prerequisites get the same context only along the read-only branch.
 s=re.sub(r'(\.assert\w+StartupReady\(target)(\))',r'\1, apply ? undefined : startupContext\2',s)
 if name=='install_lab_policy_schema':
  s=s.replace('function reviewReadonlySnapshot(target, source) {','function reviewReadonlySnapshot(target, source, startupContext) {\n    startupContext?.beforeSnapshot();')
  s=s.replace('    const reader = openReadonlyDatabase(Database, copy, { readonly: true, fileMustExist: true }, apply ? undefined : startupContext);',"    startupContext?.useSnapshot(copy, before);\n    const reader = openReadonlyDatabase(Database, copy, { readonly: true, fileMustExist: true }, startupContext);")
  s=s.replace('const reviewed = reviewReadonlySnapshot(target, source);',"const reviewed = !apply && startupContext\n        ? startupContext.reviewPolicy(target, source, fileHashes(target), () => reviewReadonlySnapshot(target, source, startupContext))\n        : reviewReadonlySnapshot(target, source);")
 if name=='install_control_charts':
  old='try{reviewed=reader.transaction(()=>classify(reader,source))();}finally{reader.close();}'
  assert old in s
  s=s.replace(old,'try{reviewed=!apply&&startupContext?startupContext.reviewChart(source,()=>reader.transaction(()=>classify(reader,source))()):reader.transaction(()=>classify(reader,source))();}finally{reader.close();}')
 if name=='install_order_revisions':
  s=s.replace('.assertControlChartStartupReady(copy);','.assertControlChartStartupReady(startupContext && !apply ? target : copy, apply ? undefined : startupContext);')
 p.write_bytes(s.encode())
entry=entry.replace("const { beginReadinessStage, readinessTelemetry } = require('./utils/startupReadinessTelemetry');","const { beginReadinessStage, readinessTelemetry } = require('./utils/startupReadinessTelemetry');\nconst { createStartupReadinessContext } = require('./utils/startupReadinessContext');\nconst startupContext = createStartupReadinessContext();")
entry,n=re.subn(r'(\.assert\w+StartupReady\(dbPath)(\))',r'\1, startupContext\2',entry);assert n==26
needle="    process.exit(1);\n}\nconst http"
assert needle in entry
entry=entry.replace(needle,"    process.exit(1);\n} finally {\n    startupContext.close();\n}\nconst http")
index.write_bytes(entry.encode())
after={p:hashlib.sha256((R/p).read_bytes()).hexdigest() for p in before}
(D/'source-preparation-record.json').write_text(json.dumps({'scopeDirection':6189025975,'status':'SOURCE_ONLY_PRIVATE_CONTEXT_DRAFT','before':before,'after':after,'directReadinessStages':names,'productionOperations':0,'defaultCliContextAbsent':True,'sharedSnapshotOnlyStableBytes':True},indent=2),encoding='utf-8')
print(json.dumps({'status':'DRAFT_PREPARED','readinessStages':len(names),'productionOperations':0}))
