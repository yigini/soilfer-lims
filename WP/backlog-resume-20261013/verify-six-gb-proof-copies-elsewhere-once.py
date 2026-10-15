"""Verify every offered small proof-root file against its published raw Git copy."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-host-capacity-options-6gb-20261015';out=D/'proof-copies-verified-elsewhere.json';assert not out.exists()
v=json.loads((D/'metadata-stdout-original.json').read_bytes());prior={x['root']:x for x in json.loads((D/'prior-proven-small-proof-selection.json').read_bytes())};result=[]
for root in v['proofFoldersFreshStableHashes']:
 old=prior[root['root']];pins=old['publication']['rawGitPins'];verified=[];unmatched=[]
 for row in root['files']:
  choices=[x for x in pins if pathlib.PurePosixPath(x['path']).name==pathlib.PurePosixPath(row['relativePath']).name and x['sha256']==row['sha256'] and x['bytes']==row['bytes']]
  if not choices:unmatched.append(row['relativePath']);continue
  p=choices[0];raw=subprocess.check_output(['git','show',p['commit']+':'+p['path']],cwd=R)
  oid=hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
  assert oid==p['gitBlobOid'] and hashlib.sha256(raw).hexdigest()==row['sha256'] and len(raw)==row['bytes']
  verified.append({'rootRelativePath':row['relativePath'],'sha256':row['sha256'],'bytes':row['bytes'],'verifiedCopyCommit':p['commit'],'verifiedCopyPath':p['path'],'verifiedCopyGitBlobOid':oid})
 mounts=[{'id':c['Id'],'names':c['Names'],'state':c['State'],'mount':m} for c in v['safeSelectedContainerMetadata'] for m in c.get('Mounts',[]) if m.get('Source')==root['root'] or m.get('Source','').startswith(root['root']+'/')]
 refs=[]
 for rec in v['releaseAuthorityPathImageReferences']:
  if pathlib.PurePosixPath(rec['path']).parent.as_posix()==root['root']:continue
  for item in rec['structuredPathImageReferences']:
   if root['root'] in item['value']:refs.append({'file':rec['path'],'key':item['key'],'reference':item['value']})
 process=[p for p in v['processPathAndOpenFileReferences'] if any(x==root['root'] or x.startswith(root['root']+'/') for x in p['openFileTargets'])]
 eligible=not unmatched and not mounts and not refs and not process and all(x['hardLinks']==1 for x in root['files'])
 result.append({'root':root['root'],'physicalDuXBytes':root['physicalDuXBytes'],'currentFileCount':len(root['files']),'allCurrentFileBytesHaveIndependentlyVerifiedElsewhereCopy':not unmatched,'verifiedCopies':verified,'unmatchedFiles':unmatched,'containerMountConsumers':mounts,'otherReleaseAuthorityReferences':refs,'processOpenFileReferences':process,'hardLinksAllOne':all(x['hardLinks']==1 for x in root['files']),'eligibleForExactListReview':eligible,'deletionApproved':False})
out.write_text(json.dumps({'status':'FRESH_ALL_FILE_BYTES_VERIFIED_ELSEWHERE_FOR_OFFERED_PROOF_ROOTS','rows':result,'unverifiedProofFoldersExcluded':True,'mutations':0,'filesDeleted':0},indent=2),encoding='utf-8')
print(json.dumps([{'root':x['root'],'bytes':x['physicalDuXBytes'],'verifiedFiles':len(x['verifiedCopies']),'unmatched':x['unmatchedFiles'],'mountConsumers':len(x['containerMountConsumers']),'otherReferences':len(x['otherReleaseAuthorityReferences']),'eligibleForReview':x['eligibleForExactListReview']} for x in result]))
