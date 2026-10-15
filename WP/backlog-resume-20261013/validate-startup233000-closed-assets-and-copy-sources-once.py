"""Complete retained-only asset, schema and application-copy-source checks. No host calls."""
import datetime,hashlib,json,pathlib,re,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';D=S/'proof233000-closed-memory-events-complete-originals-once';O=D/'remote-originals'
sys.path.insert(0,str(S));from proof_contract import sha,canonical
from proof_app_sources import APP_PINS,validate_sources
r=json.loads((D/'closed-retention-record.json').read_bytes());rows={x['path']:x for x in r['rootFileInventoryWithStableHashes']};spec=json.loads((O/'proof-input.json').read_bytes());manifest=json.loads((O/'source-index.json').read_bytes());manifest_rows={x['path']:x for x in manifest['entries']}
names=list(APP_PINS);batch=subprocess.check_output(['git','cat-file','--batch'],cwd=R,input=('\n'.join(APP_PINS[n]['blob'] for n in names)+'\n').encode());at=0;raws={}
for n in names:
 end=batch.index(b'\n',at);oid,kind,length=batch[at:end].decode().split();length=int(length);raw=batch[end+1:end+1+length];at=end+2+length
 assert kind=='blob' and oid==APP_PINS[n]['blob'] and batch[at-1:at]==b'\n' and length==APP_PINS[n]['bytes'] and sha(raw)==APP_PINS[n]['sha256'] and hashlib.sha1(('blob '+str(length)+'\0').encode()+raw).hexdigest()==oid;raws[n]=raw
assert at==len(batch) and validate_sources(raws,manifest_rows)==spec['applicationCopyDerivation']
assets=json.loads((O/'prior-assets-snapshot-handoff.json').read_bytes())['rawCopyByteIdentity'];copies=[]
for number in [1,2]:
 prefix='startup-'+str(number)+'-assets/';actual={n[len(prefix):]:{'bytes':x['bytes'],'sha256':x['sha256']} for n,x in rows.items() if n.startswith(prefix)};assert actual==assets
 schema='startup-'+str(number)+'-database/schema.prisma';marker='startup-'+str(number)+'-database/.seed_complete'
 assert (O/schema).read_bytes()==raws['server/prisma/schema.prisma'] and rows[schema]['bytes']==89556 and (O/marker).read_bytes()==b'' and rows[marker]['bytes']==0
 memory_names=[n for n in rows if re.fullmatch('startup-'+str(number)+'-memory-[0-9]{6}(?:-raw-[^/]+[.]stdout|[.]json)',n)]
 summary=json.loads((O/('startup-'+str(number)+'-result.json')).read_bytes())['memory']
 allocated=sum(rows[n]['allocatedBytes'] for n in memory_names);assert allocated<=summary['sampleAndSummaryAllocatedAllowanceBytes']
 copies.append({'startup':number,'assetFilesHashLengthEqual':len(actual),'assetAllocatedBytes':sum(x['allocatedBytes'] for n,x in rows.items() if n.startswith(prefix)),'schemaBytes':89556,'emptySeedMarkerRetained':True,'memoryFilesPhysicalAllocatedBytes':allocated,'memoryEvidenceAllowanceBytes':summary['sampleAndSummaryAllocatedAllowanceBytes']})
value={'status':'CLOSED_ASSET_SCHEMA_COPY_SOURCE_AND_MEMORY_ALLOCATIONS_VERIFIED','validatedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'applicationSourceRawGitOidShaLengthBindings':len(raws),'applicationCopyDerivation':spec['applicationCopyDerivation'],'startupCopies':copies,'mainIndependentValidationSha256':sha((D/'independent-closed-validation.json').read_bytes()),'hostCalls':0,'sqlCalls':0,'duCalls':0,'proofReplays':0}
with (D/'independent-assets-copy-sources-validation.json').open('xb') as f:f.write(canonical(value)+b'\n')
print(json.dumps({k:value[k] for k in ['status','applicationSourceRawGitOidShaLengthBindings','startupCopies']},ensure_ascii=True))
