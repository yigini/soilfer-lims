"""Inventory original runtime write expressions against the frozen path set."""
import ast
import hashlib
import json
from pathlib import Path

d=Path(__file__).resolve().parent;k=d.parent/'pr284-frozen-kit-20261012T161000Z'
m=json.loads((k/'prepared-manifest.json').read_bytes());frozen=set(m['files'])|{'prepared-manifest.json'}
runtime=['deploy_import.py','import_stage.py','import_installation.py','import_sealing.py','import_startup_checks.py','startup_common.py','release_support.py','known_core_disk_guard_import_deploy.py']
calls=[]
for name in runtime:
 source=(k/name).read_text(encoding='utf-8');tree=ast.parse(source)
 for node in ast.walk(tree):
  if not isinstance(node,ast.Call):continue
  fn=ast.unparse(node.func)
  if fn.endswith(('write_new','write_text','write_bytes','open','mkdir','command')):
   expression=ast.get_source_segment(source,node)
   literals=[sub.value for arg in node.args for sub in ast.walk(arg) if isinstance(sub,ast.Constant) and isinstance(sub.value,str)]
   intersections=sorted(frozen.intersection(literals))
   calls.append({'source':name,'line':node.lineno,'function':fn,'expression':expression,'literalFrozenPaths':intersections})
collisions=[row for row in calls if row['function'].endswith('write_new') and row['literalFrozenPaths']]
assert {path for row in collisions for path in row['literalFrozenPaths']}=={'import-dry-copy-authority.json','import-install-preservation.json','import-repeat-preservation.json','installed-protected-state.json'}
record={'status':'ORIGINAL_RUNTIME_WRITE_CALL_INVENTORY_NOT_EXECUTION_OR_APPROVAL','manifestSha256':hashlib.sha256((k/'prepared-manifest.json').read_bytes()).hexdigest(),'actualCollision':'import-dry-copy-authority.json','staticFutureExclusiveWriteCollisions':collisions,'runtimeWriteExpressions':calls,'dynamicExpressionsRequireManualAndBehavioralCoverage':True,'sourceFilesUnchanged':True,'productionOperations':0}
with (d/'pr294-original-production-path-collisions.json').open('x',encoding='utf-8',newline='\n') as out:json.dump(record,out,indent=2)
print(json.dumps({'frozenPathCount':len(frozen),'runtimeWriteCallCount':len(calls),'collisions':[{key:row[key] for key in ['source','line','literalFrozenPaths']} for row in collisions],'productionOperations':0}))
