import ast,datetime,hashlib,hmac,json,pathlib,stat
root=pathlib.Path('/opt/lims/releases/workflow-batch-prechecks-be837974-20261016T080000Z');run=root/'hook'
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()
def sha(b):return hashlib.sha256(b).hexdigest()
def retained(p):
 for q in [p,*p.parents]:assert not q.is_symlink()
 before=p.stat();assert stat.S_IMODE(before.st_mode)==256 and before.st_nlink==1 and before.st_size<4*1024**2
 raw=p.read_bytes();after=p.stat();assert (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_ctime_ns)==(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns)
 return raw
pins=json.loads(retained(root/'diagnostic-pins.json'));out={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'kind':'DERIVED_FROM_ACTUAL_RETAINED_C2_STREAMS_ON_HOST_ONLY','newDockerCalls':0,'operatorReplays':0,'privateRawBytesFetched':0,'owners':[]}
label='io.soilfer.release-owned'
def selected(v):
 return {'id':v['Id'],'owner':v['Config']['Labels'][label],'name':v['Name'],'image':v['Image'],'running':v['State']['Running'],'startedAt':v['State']['StartedAt'],'mounts':v['Mounts']}
for a,b in [(2,3),(5,6)]:
 records=[];values=[]
 for i in [a,b]:
  metadata=json.loads(retained(run/('docker-call-'+str(i).zfill(3)+'.json')));assert metadata['argv'][:2]==['docker','inspect']
  pin=metadata['streams']['stdout'];raw=retained(run/pin['path']);assert len(raw)==pin['bytes'] and sha(raw)==pin['sha256']
  rows=json.loads(raw);assert len(rows)==1;values.append(rows[0]);records.append({'call':i,'stdoutSha256':pin['sha256'],'stdoutBytes':pin['bytes']})
 before,after=map(selected,values);assert before['id']==after['id'] and before['id'] in pins['owners']
 expected=pins['owners'][before['id']]
 def mounts(v):return sorted(v,key=lambda m:canonical(m))
 same={k:before[k]==after[k] for k in before};equal_unordered=mounts(before['mounts'])==mounts(after['mounts'])
 matches_pin=all(before[k]==expected[p] and after[k]==expected[p] for k,p in [('id','id'),('name','name'),('image','image'),('startedAt','startedAt')]) and before['owner']==after['owner']==expected['labels'][label] and mounts(before['mounts'])==mounts(after['mounts'])==mounts(expected['mounts'])
 out['owners'].append({'beforeSelected':before,'afterSelected':after,'selectedFieldEqual':same,'fullMountObjectsEqualIgnoringArrayOrder':equal_unordered,'bothMatchExactBoundPinsIgnoringMountArrayOrder':matches_pin,'beforeMountDestinationOrder':[m['Destination'] for m in before['mounts']],'afterMountDestinationOrder':[m['Destination'] for m in after['mounts']],'beforeStateSafe':{k:values[0]['State'][k] for k in ['Running','ExitCode','OOMKilled','StartedAt','FinishedAt']},'afterStateSafe':{k:values[1]['State'][k] for k in ['Running','ExitCode','OOMKilled','StartedAt','FinishedAt']},'streamIdentities':records})
review=json.loads(retained(root/'diagnostic-source-review.json'));assert review['id']==6210209468
public=json.loads(retained(run/'public-result.json'));target=public['failure']['errorHmacSha256'];key_info=json.loads(retained(run/'private-stop-post-hmac-key.json'));key=bytes.fromhex(key_info['keyHex']);assert len(key)==32
source=retained(root/'run_diagnostic.py');tree=ast.parse(source);literals=[]
for node in ast.walk(tree):
 if isinstance(node,ast.Call):
  candidate=node.args[1] if isinstance(node.func,ast.Attribute) and node.func.attr=='require' and len(node.args)>1 else node.args[0] if isinstance(node.func,ast.Name) and node.func.id=='RuntimeError' and node.args else None
  if isinstance(candidate,ast.Constant) and type(candidate.value) is str:literals.append((node.lineno,candidate.value))
matched=[{'line':line,'literal':value} for line,value in literals if hmac.new(key,canonical(value),hashlib.sha256).hexdigest()==target]
assert len(matched)==1
out['runDiagnosticFailureClosedLiteralMatch']=matched;out['closedLiteralCandidates']=len(literals);out['runDiagnosticSourceSha256']=sha(source);out['keyNeverLeavesHost']=True
print(json.dumps(out,sort_keys=True,separators=(',',':')))
