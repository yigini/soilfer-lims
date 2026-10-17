import hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='86675b5f8659e6c6533b2ab7ffae9441749ebae2'
closed=json.loads((k/'local-tests-order-native456-first/verification.json').read_bytes())
assert closed['sourceBefore']==closed['sourceAfter']
p=k/'kit_order_revision_native.py';s=p.read_text();a="require(line is not None,'Existing ordinary OrderLine required')";assert s.count(a)==1
s=s.replace(a,"require(line is not None and line[2]=='OrderLine','Exact ordinary OrderLine table and stored owner name required')")
a="len(set(info['columns']))==len(info['columns'])";assert s.count(a)==1;s=s.replace(a,"len({n.casefold() for n in info['columns']})==len(info['columns'])")
p.write_text(s,encoding='utf8',newline='')
p=k/'verify_kit_order_revision_native.py';s=p.read_text();a="('without-rowid','comment','new-column'";assert s.count(a)==1;s=s.replace(a,"('wrong-owner','without-rowid','comment','new-column'")
a="if fault=='without-rowid':line[4]+=' WITHOUT ROWID'";assert s.count(a)==1;s=s.replace(a,"if fault=='wrong-owner':line[2]='unrelated_owner'\n            elif fault=='without-rowid':line[4]+=' WITHOUT ROWID'")
a="db.pragma('cache_size=4');db.pragma('secure_delete=ON');";assert s.count(a)==1;s=s.replace(a,a+"db.pragma('foreign_keys=ON');")
a="const final={programs,samples,rolled,indexRoot,oldRowsPreserved:";assert s.count(a)==1
s=s.replace(a,"const schemaAfter=db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY type,name').all().map(r=>[r.type,r.name,r.tbl_name,r.rootpage,r.sql]);\n        const final={schemaAfter,receiptRows:db.prepare('SELECT count(*) n FROM _schema_migrations').get().n,programs,samples,rolled,indexRoot,oldRowsPreserved:")
a="if mode=='commit':\n                    self.assertEqual(after['nullLinks'],96)";assert s.count(a)==1
s=s.replace(a,"self.assertEqual(after['receiptRows'],0 if mode=='rollback' else 1)\n                if mode=='rollback':self.assertEqual(after['schemaAfter'],initial['schema']['rows'])\n                if mode=='commit':\n                    self.assertEqual(after['nullLinks'],96)")
p.write_text(s,encoding='utf8',newline='')
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':sha(b)}
p=k/'order-revision-native-source.json';v=json.loads(p.read_bytes());v['files']={n:pin(w/n) for n in v['files']}
v['derivation'].append('Explicitly require the stored OrderLine table owner name to match, and reject case-colliding declared column names; no malformed declaration can enlarge the old schema name payload beyond its fixed-name allowance.')
p.write_bytes(canonical(v)+b'\n')
for name in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={n:pin(k/n) for n in v['files']};p.write_bytes(canonical(v)+b'\n')
print(json.dumps({'firstRunExitCode':closed['exitCode'],'firstRunSourcesUnchanged':True,'strictOwnerCheckAdded':True,'rollbackFullSchemaReceiptAssertionsAdded':True,'proofSha256':sha((k/'order-revision-native-source.json').read_bytes()),'hooksExecuted':False,'operatorsExecuted':0}))
