import hashlib,json,pathlib,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016'
sys.path.insert(0,str(k));from kit_contract import canonical
p=k/'wal-content-source.json';v=json.loads(p.read_bytes())
for name in v['files']:
 raw=(w/name).read_bytes();v['files'][name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
p.write_bytes(canonical(v)+b'\n')
print('Rebound conditional WAL source after descriptor-identity review; no operator or test executed')
