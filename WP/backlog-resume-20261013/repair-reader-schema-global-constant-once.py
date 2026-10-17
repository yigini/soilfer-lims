from pathlib import Path
import ast,json,hashlib,subprocess,sys
w=Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013';sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
p=k/'reader-schema-scratch-source.json';v=json.loads(p.read_bytes());before=sha(p.read_bytes())
source=k/'kit_schema_collection.py';raw=source.read_bytes();ls=raw.splitlines(keepends=True);off=[0]
for line in ls:off.append(off[-1]+len(line))
constants=[]
for node in ast.parse(raw).body:
 if isinstance(node,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='FULL_SCHEMA_SQL' for x in node.targets):
  b=raw[off[node.lineno-1]:off[node.end_lineno]];constants.append({'path':source.relative_to(w).as_posix(),'constant':'FULL_SCHEMA_SQL','firstLine':node.lineno,'lastLine':node.end_lineno,'startByte':off[node.lineno-1],'endByte':off[node.end_lineno],'sha256':sha(b),'text':b.decode()})
assert len(constants)==1;v['callerConstants']=constants
v['derivation'].append('First full505 run rejected only a NEW test assertion that looked for the FULL_SCHEMA_SQL literal inside function excerpts: actual function references a module-global constant. Entire collector file was already hash-pinned. Added exact AST global-constant byte excerpt and test checks functions+constant together. No production source behavior/guard/settings changed. Original full failed run retained unchanged.')
p.write_bytes(canonical(v)+b'\n')
for name in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],capture_output=True,cwd=w);assert r.returncode==0,r.stderr
p2=k/'capture-statement-journal-source.json';v2=json.loads(p2.read_bytes())
for n in v2['files']:
 b=(k/n).read_bytes();v2['files'][n]={'bytes':len(b),'sha256':sha(b)}
p2.write_bytes(canonical(v2)+b'\n')
for f in k.iterdir():
 if f.is_file() and f.suffix=='.py':ast.parse(f.read_bytes())
r={'firstFullRun':'reader-schema505-first','exitCode':1,'failures':1,'elapsedSeconds':257.795,'all219SourcesUnchanged':True,'beforeProofSha256':before,'afterProofSha256':sha(p.read_bytes()),'newExactGlobalConstantExcerpts':1,'productionBehaviorChanged':False,'hooksExecuted':False}
(h/'reader-schema498-entry-1019-once/global-constant-first-run-repair.json').write_bytes(canonical(r)+b'\n');print(json.dumps(r))
