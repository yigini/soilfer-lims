"""Read every retained jobs-ON log byte and publish hashes only, preserving originals."""
import collections,datetime,hashlib,json,pathlib,re
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-jobs-intake-be837974-20261016';D=S/'jobs003000-closed-row-refusal-originals-once';P=S/'jobs003000-closed-log-content-review-once'
assert not P.exists();P.mkdir()
record=json.loads((D/'closed-retention-record.json').read_bytes());inventory={x['path']:x for x in record['rootFileInventoryWithStableHashes']}
on=[p for p in (D/'remote-originals').iterdir() if p.name.startswith('startup-2-') and ('startup-logs.' in p.name or '-watch-logs-' in p.name) and p.suffix in ['.stdout','.stderr']]
on+=sorted((D/'fresh-closed-diagnostics').glob('fresh-closed-startup-2-docker-logs-*.log'))
assert len(on)==6
rows=[];line_records=[]
for p in sorted(on):
 raw=p.read_bytes();digest=hashlib.sha256(raw).hexdigest();text=raw.decode('utf-8','strict')
 if p.parent.name=='remote-originals':assert digest==inventory[p.name]['sha256'] and len(raw)==inventory[p.name]['bytes']
 else:
  held=next(x for x in record['freshClosedDiagnosticArtifacts'] if x['path']==p.name);assert digest==held['sha256'] and len(raw)==held['bytes']
 tags=collections.Counter();flags=collections.Counter();lines=text.splitlines()
 for i,line in enumerate(lines,1):
  tag=re.search(r'\[([A-Z][A-Z0-9_ -]{1,50})\]',line)
  tags[tag[1] if tag else 'OTHER']+=1
  found=[name for name,pattern in [('kobo',r'KOBO|Kobo|kobo'),('submission',r'submission|_uuid|_id'),('sample_identity',r'sampleCode|sampleId|sample_id|Sample:|Sample |sample:|Sample:'),('structured_data',r'^\s*[{}\[\]]|["\x27][A-Za-z_][A-Za-z_0-9]*["\x27]\s*:'),('error_response_data',r'error\.response|response\.data|response data'),('credential_label',r'Bearer |Authorization|api[_ -]?token|apiKey|password')]
          if re.search(pattern,line,re.I)]
  flags.update(found)
  line_records.append({'file':p.relative_to(R).as_posix(),'line':i,'utf8Bytes':len(line.encode()),'sha256':hashlib.sha256(line.encode()).hexdigest(),'structuralFlags':found})
 rows.append({'path':p.relative_to(R).as_posix(),'bytes':len(raw),'sha256':digest,'utf8LinesReviewed':len(lines),'tagCounts':dict(tags),'structuralRiskLineCounts':dict(flags),'publicRawContentsAllowed':False})
value={'status':'ALL_SIX_ORIGINAL_JOBS_ON_LOG_CAPTURES_FULL_BYTE_REVIEWED_HASH_ONLY_PUBLICATION','reviewedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Every UTF-8 byte and line read; structural classification and whole-file SHA/length verified. Conservatively withhold all original jobs-ON log contents and the transport JSON that embeds them. No claim that raw logs are submission-content-free.','rawJobsOnCaptures':rows,'allOriginalsPreservedLocallyAndOnHost':True,'originalTransportWithheld':'WP/batch-proof-jobs-intake-be837974-20261016/jobs003000-closed-row-refusal-originals-once/stdout-original.json','payloadFreeClaimed':False,'publicationsMayContainHashesOnly':True,'proofReplays':0,'hostCalls':0}
for name,v in [('content-review-record.json',value),('all-reviewed-line-hashes.json',line_records)]:
 with (P/name).open('x',encoding='utf-8',newline='\n') as f:json.dump(v,f,ensure_ascii=True,sort_keys=True,separators=(',',':'));f.write('\n')
print(json.dumps({'status':value['status'],'files':len(rows),'bytesReviewed':sum(x['bytes'] for x in rows),'linesReviewed':len(line_records),'riskCounts':dict(sum((collections.Counter(x['structuralRiskLineCounts']) for x in rows),collections.Counter())),'rawLogsWithheld':True}))
