"""Derive a review-only two-group root list from retained metadata and raw Git."""
import csv,hashlib,io,json,pathlib,re,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];B=REPO/'WP/yy-failed-root-candidates-20261015';HEAD=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO).decode().strip()
def require(v,m):
 if not v:raise RuntimeError(m)
def sha(b):return hashlib.sha256(b).hexdigest()
def load(p):return json.loads(p.read_bytes())
def write(n,v):
 with (B/n).open('x',encoding='utf8',newline='\n') as f:f.write(json.dumps(v,indent=2,ensure_ascii=False)+'\n')
require(not (B/'review-only-root-list.json').exists(),'Consumed derivation')
sel=load(B/'candidate-input-selection.json');obs=load(B/'stdout-original.json');require(obs['mutations']==0 and obs['filesDeleted']==0 and not obs['candidateRootProcessReferences'],'Candidate capture unsafe')
du=obs['duOriginal'];require(du['exitCode']==0,'du incomplete');allocated={line.split('\t',1)[1]:int(line.split('\t',1)[0]) for line in du['stdout'].splitlines()}
known={
 'workflow-batch-stopped-copy-cde8c889-20261015T020000Z':('WP/batch-proof-cde8-20261015/first-proof-020000-closed-mount-differences-successor','closed-retention-record.json','remote-originals'),
 'workflow-batch-stopped-copy-cde8c889-20261015T023000Z':('WP/batch-proof-cde8-20261015/first-proof-023000-closed-reserve-stop','closed-retention-record.json','remote-originals'),
 'workflow-batch-stopped-copy-cde8c889-20261015T050000Z':('WP/batch-proof-noop-identity-cde8-20261015/first-proof-050000-closed-name-refusal','closed-retention-record.json','remote-originals'),
 'workflow-batch-stopped-copy-cde8c889-20261015T060000Z':('WP/batch-proof-name-inventory-cde8-20261015/first-proof-060000-closed-source-preservation-stop','closed-retention-record.json','remote-originals'),
 'workflow-batch-forward-metadata-cde8c889-20261014T233000Z':('WP/batch-forward-metadata-cde8-20261014/first-metadata-233000-closed-stop','remote-closed-original-index.json','')}
verified={};allpins=[]
def get_blobs(commit,paths):
 listing=subprocess.check_output(['git','-c','core.longpaths=true','ls-tree','-r','-z',commit,'--',*paths],cwd=REPO)
 oids={}
 for entry in listing.split(b'\0'):
  if not entry:continue
  m,p=entry.split(b'\t',1);oids[p.decode()]=m.split()[2].decode()
 require(set(paths)<=set(oids),'Published path missing')
 raw=subprocess.check_output(['git','cat-file','--batch'],input=('\n'.join(oids[p] for p in paths)+'\n').encode(),cwd=REPO);offset=0;out={}
 for p in paths:
  end=raw.index(b'\n',offset);header=raw[offset:end].decode().split();require(header[1]=='blob','Not blob');size=int(header[2]);data=raw[end+1:end+1+size];offset=end+size+2
  require(hashlib.sha1(b'blob '+str(size).encode()+b'\0'+data).hexdigest()==oids[p],'Git OID differs')
  out[p]=(data,{'commit':commit,'path':p,'gitBlobOid':oids[p],'bytes':size,'sha256':sha(data)})
 return out
for name,(folder,recordname,sub) in known.items():
 indexpath=folder+'/index.json';recordpath=folder+'/'+recordname
 commit=subprocess.check_output(['git','log','-1','--format=%H',HEAD,'--',indexpath],cwd=REPO).decode().strip();require(bool(commit),'Publication commit absent')
 idx=load(REPO/indexpath);paths=sorted({indexpath,recordpath,*[v['path'] for v in idx['files']]});blobs=get_blobs(commit,paths)
 for v in idx['files']:
  data,pin=blobs[v['path']];require(pin['sha256']==v['sha256'] and pin['bytes']==v['bytes'],'Published raw index mismatch')
 rec=json.loads(blobs[recordpath][0]);originals=rec.get('rootFileInventoryWithStableHashes',rec.get('files'))
 if isinstance(originals,dict):originals=[{'path':p,**v} for p,v in originals.items()]
 rootrows={v['path']:v for v in originals};r=next(v for v in obs['candidates'] if v['root'].endswith('/'+name));current={v['path']:v for v in r['fileInventory']}
 payload=[];missing=[]
 for path,v in rootrows.items():
  q=folder+'/'+(sub+'/' if sub else '')+path
  if q in blobs:
   pin=blobs[q][1];require(pin['sha256']==v['sha256'] and pin['bytes']==v['bytes'],'Original root artifact mismatch');payload.append(path)
  else:missing.append(path)
 for path,v in current.items():
  require(path in rootrows and v['bytes']==rootrows[path]['bytes'],'Current file differs from closed inventory')
  if 'stableByteIdentity' in v:require(v['stableByteIdentity']['sha256']==rootrows[path]['sha256'],'Fresh owned root hash differs')
 # Every controller JSON/code/log must be published; raw DB and assets are listed separately.
 def rawkind(path):
  l=path.lower();base=pathlib.PurePosixPath(l).name
  return ('asset' if any(z in l.split('/') for z in ['raw-production-assets','assets','uploads']) else 'database' if re.search(r'\.(db|sqlite|sqlite3)(-|\.|$)',base) or base.endswith(('-wal','-shm')) else None)
 missingcontroller=[p for p in missing if rawkind(p) is None];require(not missingcontroller,'Original controller JSON/log/source not fully published: '+str(missingcontroller[:3]))
 require(pathlib.PurePosixPath(r['freshOwnOutcome']['file']).name in payload,'Original terminal receipt missing')
 pins=[pin for data,pin in blobs.values()];allpins.extend(pins)
 verified[name]={'publicationCommit':commit,'index':indexpath,'retentionRecord':recordpath,'rootInventoryFiles':len(rootrows),'publishedOriginalFiles':len(payload),'allWrittenControllerJsonLogsPublished':True,'fullIndexAndRetentionRecordRawGitVerified':True,'freshHashVerification':all('stableByteIdentity' in v for v in current.values()),'publishedOriginalRelativePaths':payload,'notPublishedRawRelativePaths':missing,'rawGitPins':pins,'currentFileSetEqualsClosedInventory':set(current)==set(rootrows)}
runtime=REPO/'WP/batch-proof-startup-forward-cde8-20261015';runtimefiles=[*runtime.glob('*.py'),runtime/'proof-package-workflow-batch-startup-forward-cde8c889-20261015T090000Z/proof-input.json']
rows=[];potential=[]
for c in sel['candidates']:
 root=c['root'];name=c['name'];r=next(v for v in obs['candidates'] if v['root']==root);require(not r['activeContainerMountConsumers'],'Active consumer')
 hits=[p.relative_to(REPO).as_posix() for p in runtimefiles if root.encode() in p.read_bytes() or name.encode() in p.read_bytes()]
 reasons=[]
 if name not in verified:reasons.append('Complete terminal + every original JSON/log + closed retention record publication has not been independently established; any terminal-only pins do not establish full closure.')
 if r['containerMountConsumers']:reasons.append('Retained stopped containers still reference this root in full mount metadata; dependency clearance required.')
 if hits:reasons.append('Literal candidate reference in current startup source/spec requires dependency clearance.')
 rawfiles=[]
 for v in r['fileInventory']:
  l=v['path'].lower();parts=l.split('/');base=parts[-1]
  isasset=any(p in ['assets','raw-production-assets','uploads'] for p in parts)
  isdb=bool(re.search(r'\.(db|sqlite|sqlite3)(-|\.|$)',base) or base.endswith(('-wal','-shm')) or (any('backup' in p for p in parts[:-1]) and not base.endswith(('.json','.log','.txt','.py'))))
  if isasset or isdb:
   entry={'root':root,'relativePath':v['path'],'kind':'asset' if isasset else 'database/wal/shm/reader/backup','bytes':v['bytes'],'allocatedBytes':v['allocatedBytes'],'anotherExactCopyVerified':False,'uniqueLossRisk':'Potential loss of these exact forensic bytes; no other exact copy verified by this report. Production/live backups are not byte-equivalent evidence.'}
   if 'stableByteIdentity' in v:entry['sha256']=v['stableByteIdentity']['sha256']
   rawfiles.append(entry)
 potential.extend(rawfiles)
 notes=[]
 if name.endswith('T050000Z'):notes.append('Original direct name-probe stdout/stderr were never written/retained; fresh diagnostic is distinctly labelled, not recovered original evidence.')
 if name.endswith('T060000Z'):notes.append('Failed exact live after-sample was not sealed; later metadata is not that original sample.')
 if name.endswith('T233000Z') and name in verified:notes.append('Current 46 root files match closed metadata paths/lengths; original closed record also includes external journal. No new content hashes were collected for this root.')
 group='a' if name in verified and not reasons else 'b'
 row={'group':group,'root':root,'name':name,'birthTimeOriginal':c['birthTimeOriginal'],'birthEpoch':c['birthEpoch'],'physicalDuXBytes':allocated[root],'ownOutcome':r['freshOwnOutcome'],'fullClosedPublicationVerified':name in verified,'publication':verified.get(name),'terminalOnlyOrPriorKnownPins':c.get('publishedClosedRawEvidence',[]),'reasons':reasons,'currentRuntimeSourceReferencePaths':hits,'stoppedContainerMountConsumers':r['containerMountConsumers'],'activeContainerMountConsumers':r['activeContainerMountConsumers'],'potentialExactRawFilesWithoutVerifiedOtherCopy':len(rawfiles),'potentialExactRawAllocatedBytes':sum(v['allocatedBytes'] for v in rawfiles),'knownOriginalObservationGaps':notes,'deletionAuthorized':False}
 rows.append(row)
totals={g:{'roots':sum(v['group']==g for v in rows),'physicalDuXBytes':sum(v['physicalDuXBytes'] for v in rows if v['group']==g)} for g in ['a','b']};totals['a+b']={'roots':len(rows),'physicalDuXBytes':sum(v['physicalDuXBytes'] for v in rows)}
report={'status':'REVIEW_ONLY_FAILED_ROOT_LIST_NOT_REMOVAL_AUTHORITY','request':6187300253,'metadataObservedUtc':obs['observedUtc'],'gitVerificationAtHead':HEAD,'exclusions':sel['excludedOperationalInputs'],'currentRunningProofRootExcluded':'/opt/lims/releases/workflow-batch-startup-forward-cde8c889-20261015T090000Z','scope':'Closed consumed FAILED/STOP release roots only. No Docker images, containers, volumes, backups directories, audit-backups, successful or unknown roots listed.','groupDefinitions':{'a':'Full written closed controller JSON/logs + terminal receipt + retention record independently raw Git verified; no current source/spec or container mount dependency found. Claudio dependency review pending. Raw DB/assets may still lack any other verified exact copy.','b':'All other candidate roots; reasons per row. Full publication not established is an unknown, not proof it does not exist.'},'totals':totals,'rows':rows,'guardrails':{'filesDeleted':0,'mutations':0,'rootCleanupCommandsExecuted':0,'claudioReviewRequiredBeforeYYExactListApproval':True,'YYExactListDeletionApprovalObtained':False,'rawGitJsonLogsReplaceDatabaseAssets':False,'potentialExactRawFileCount':len(potential),'anotherExactRawCopyVerifiedByThisReport':False,'hardLinkedFiles':sum(v['hardLinks']>1 for r in obs['candidates'] for v in r['fileInventory'])}}
write('review-only-root-list.json',report);write('potential-exact-raw-files-without-other-verified-copy.json',potential);write('independently-verified-publication-pins.json',allpins)
text=['# Failed release roots — review list only','',f"Observed {obs['observedUtc']}. Nothing deleted, moved or pruned. Claudio must review dependencies before YY approves an exact list.",'',f"Group (a): {totals['a']['roots']} roots, **{totals['a']['physicalDuXBytes']:,} bytes**. Group (a+b): {len(rows)} roots, **{totals['a+b']['physicalDuXBytes']:,} bytes**. These are physical du -x totals, not a safe-removal estimate.",'','Group (a) has verified publication of every written controller JSON/log, terminal receipt and closed retention record, with no current source/spec or container mount reference found. This does not preserve raw database or asset bytes. Exact forensic duplicates elsewhere have not been verified. Group (b) has incomplete publication verification or a dependency requiring clearance.','', 'The raw file inventory lists every potentially unique DB/WAL/SHM/reader/backup/asset file; those exact bytes could be lost if their root were removed. Live production and separate backups do not establish an exact forensic copy.','', 'Excluded: 070000 inputs/assets, 080000 installed209/11242 evidence, qualified B5/c03/B1 build, current 090000 proof, all successful/running/unknown roots, Docker images/containers/volumes and backup/audit-backup directories.','']
for group in ['a','b']:
 text += [f'## Group ({group})','', '| Root under /opt/lims/releases | Birth time (original timezone) | Own terminal outcome | Physical bytes | Publication / reason |','|---|---|---|---:|---|']
 for row in rows:
  if row['group']!=group:continue
  v=row.get('publication');pub=(f"[{v['publicationCommit'][:12]} index](https://github.com/yigini/soilfer-lims/blob/{v['publicationCommit']}/{v['index']}); {v['publishedOriginalFiles']} original files + retention record" if v else 'Full closed publication not verified')
  if row['reasons']:pub+='; '+' '.join(row['reasons'])
  if row['potentialExactRawFilesWithoutVerifiedOtherCopy']:pub+=f"; {row['potentialExactRawFilesWithoutVerifiedOtherCopy']} potentially unique raw DB/asset files"
  if row['knownOriginalObservationGaps']:pub+='; '+' '.join(row['knownOriginalObservationGaps'])
  text.append(f"| {row['name']} | {row['birthTimeOriginal']} | {row['ownOutcome']['status']} | {row['physicalDuXBytes']:,} | {pub} |")
 text.append('')
text+=['Exact paths, byte counts, hashes where collected, raw Git OIDs, original receipts, stopped mount consumers and known observation gaps are in the accompanying JSON files. No original evidence gap is reconstructed or represented as recovered.','']
with (B/'review-only-root-list.md').open('x',encoding='utf8',newline='\n') as f:f.write('\n'.join(text))
buf=io.StringIO(newline='');w=csv.writer(buf);w.writerow(['group','root','birthTimeOriginal','physicalDuXBytes','ownOutcome','fullClosedPublicationVerified','stoppedContainerMountConsumers','potentialExactRawFilesWithoutVerifiedOtherCopy','deletionAuthorized'])
for r in rows:w.writerow([r['group'],r['root'],r['birthTimeOriginal'],r['physicalDuXBytes'],r['ownOutcome']['status'],r['fullClosedPublicationVerified'],len(r['stoppedContainerMountConsumers']),r['potentialExactRawFilesWithoutVerifiedOtherCopy'],False])
with (B/'review-only-root-list.csv').open('x',encoding='utf8',newline='') as f:f.write(buf.getvalue())
print(json.dumps({'status':report['status'],'totals':totals,'verifiedPublicationBlobs':len(allpins),'potentialExactRawFiles':len(potential),'mutations':0,'deletions':0}))
