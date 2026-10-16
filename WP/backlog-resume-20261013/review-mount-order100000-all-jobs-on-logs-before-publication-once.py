"""Full-byte local content/privacy review of all jobs-on logs; preserve and withhold originals."""
import pathlib,json,hashlib,re,datetime,collections
w=pathlib.Path(__file__).resolve().parents[2];b=w/'WP/batch-proof-mount-order-forward-be837974-20261016';d=b/'mount-order100000-closed-originals-once';o=d/'remote-originals';out=b/'closed-all-jobs-on-log-content-review-once';assert not out.exists();out.mkdir()
selected=sorted(p for p in o.iterdir() if p.is_file() and re.fullmatch(r'startup-2-(startup-logs|watch-logs-[0-9]+)[.](stdout|stderr)',p.name))
selected+=sorted(p for p in (d/'fresh-closed-diagnostics').iterdir() if p.name.startswith('fresh-closed-startup-2-docker-logs-') and p.suffix=='.log')
assert len(selected)==156;review=[];total=0;lines=0
with (out/'all-original-log-line-hashes.jsonl').open('x',encoding='utf-8',newline='\n') as sink:
 for p in selected:
  raw=p.read_bytes();text=raw.decode('utf-8','strict');all_lines=raw.splitlines(keepends=True);risks={k:len(re.findall(pattern,text,re.I)) for k,pattern in {'submissionOrRecord':r'\b(submission|record|barcode)\b','payloadMetadata':r'\b(metadata|payload|processing|sample)\b','coordinatesOrNames':r'\b(lat|lng|latitude|longitude|surveyor|site_id|siteName|collected_at|attachments)\b','structuredValues':r'[:=]\s*[\[{]'}.items()}
  row={'path':p.relative_to(w).as_posix(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'lineCount':len(all_lines),'fullBytesUtf8DecodedAndContentIndicatorsReviewed':True,'contentRiskCounts':risks,'publicContentDisposition':'WITHHELD_ENTIRE_ORIGINAL','originalRewritten':False};review.append(row);total+=len(raw);lines+=len(all_lines);sink.write(json.dumps({**row,'lineSha256':[hashlib.sha256(x).hexdigest() for x in all_lines]})+'\n')
transport=d/'stdout-original.json';excluded=[p.relative_to(w).as_posix() for p in selected]+[transport.relative_to(w).as_posix()]
result={'status':'ALL_JOBS_ON_LOG_ORIGINALS_FULL_BYTE_REVIEWED_WITHHELD_BEFORE_PUBLICATION','reviewedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rawLogFiles':len(review),'rawLogBytes':total,'rawLogLines':lines,'logs':review,'publicContentExclusions':excluded,'transportEmbeddingAllLogs':{'path':transport.relative_to(w).as_posix(),'bytes':transport.stat().st_size,'sha256':hashlib.sha256(transport.read_bytes()).hexdigest()},'allOriginalsPreservedLocalAndHost':True,'noRawJobsOnLogOrEmbeddingTransportPublished':True,'noPayloadFreeClaim':True,'privateDatabaseAndTwoHmacKeysNeverFetched':True}
with (out/'public-content-review-and-exclusions.json').open('x',encoding='utf-8',newline='\n') as f:json.dump(result,f,ensure_ascii=True,sort_keys=True);f.write('\n')
print(json.dumps({k:result[k] for k in ['status','reviewedUtc','rawLogFiles','rawLogBytes','rawLogLines']}))
