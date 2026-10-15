"""Build an exact review-only list and dependency catalog from retained metadata."""
import collections,csv,datetime,json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-host-capacity-options-6gb-20261015';out=D/'exact-review-list.json';assert not out.exists()
m=json.loads((D/'metadata-stdout-original.json').read_bytes());a=json.loads((D/'dependency-and-old-backup-hashes-once/stdout-original.json').read_bytes());e=json.loads((D/'cache-parent-and-config-reference-once/stdout-original.json').read_bytes());proof=json.loads((D/'proof-copies-verified-elsewhere.json').read_bytes())
def release_refs(tokens):
 return [{'file':rec['path'],'key':v['key'],'reference':v['value']} for rec in m['releaseAuthorityPathImageReferences'] for v in rec['structuredPathImageReferences'] if any(t in v['value'] for t in tokens)]
def config_refs(tokens):
 return [v for v in a['exactAndRepositoryConfigReferences'] if set(tokens)&set(v['exactReferenceTokens'])]
def env_refs(tokens):
 return [v for v in e['runningContainerSelectedImageEnvironmentReferences']+e['composeSelectedImageEnvironmentReferences'] if set(tokens)&set(v['exactImageTagReferences'])]
containers={v['Id']:v for v in a['versionedSafeSelectedContainers']};cache=e['cacheWithActualParentEdges'];cache_meta={v['ID']:v for v in a['versionedBuildCacheRecords']};cache_by_id={v['id']:v for v in cache};children=collections.defaultdict(list)
for v in cache:
 for p in v['parents'] or []:children[p].append(v['id'])
chosen_cache={v['id'] for v in cache if not v['inUse'] and not v['shared']};assert len(chosen_cache)==65
cache_rows=[]
for v in sorted(cache,key=lambda x:(-x['size'],x['id'])):
 if v['id'] not in chosen_cache:continue
 other_children=sorted(x for x in children[v['id']] if x not in chosen_cache);assert not other_children
 cache_rows.append({'item':'cache:'+v['id'],'id':v['id'],'bytes':v['size'],'sizeBasis':'Docker reported unshared cache accounting; physical reclaim estimated','inUse':v['inUse'],'sharedWithImages':v['shared'],'parents':v['parents'] or [],'children':sorted(children[v['id']]),'childrenOutsideProposedSet':other_children,'description':cache_meta[v['id']]['Description'],'lastUsedAt':cache_meta[v['id']].get('LastUsedAt'),'dependsOn':'Only reusable build cache relationships shown; no in-use build, no image-shared record. Removing it makes future builds rebuild this cache.','approvalRequired':True})
images=[];protected_image_ids=[]
for v in a['versionedSafeSelectedImages']:
 consumer_ids=set()
 for manifest in v.get('Manifests') or []:consumer_ids.update((manifest.get('ImageData') or {}).get('Containers') or [])
 aliases={v['Id']}|{x['ID'] for x in v.get('Manifests') or []}
 for c in containers.values():
  desc=(c.get('ImageManifestDescriptor') or {}).get('digest')
  if c['ImageID'] in aliases or desc in aliases:consumer_ids.add(c['Id'])
 consumers=[{k:containers[id].get(k) for k in ['Id','Names','State']} for id in sorted(consumer_ids) if id in containers]
 if any(x['State']=='running' for x in consumers):protected_image_ids.append(v['Id']);continue
 if v.get('Containers',0)>0 or consumers:continue  # Include genuinely unused images only.
 tags=v['RepoTags'] or [];tokens=[v['Id'],*tags];refs=release_refs(tokens);cfg=config_refs(tokens);env=env_refs(tokens)
 df=next(x for x in a['versionedSystemDfSafeImages'] if x['Id']==v['Id'])
 logical=df['Size'];shared=df['SharedSize'];unique=logical-shared if isinstance(shared,int) and shared>=0 else None
 selected='soil-museum:prev-20261014-093649' in tags
 if selected:assert not refs and not cfg and not env and unique==245985521
 images.append({'item':'image:'+v['Id'],'id':v['Id'],'tags':tags,'logicalBytes':logical,'dockerSharedBytes':shared,'estimatedUniqueBytes':unique,'sizeBasis':'Docker system-df Size minus SharedSize; estimate, not a measured deletion delta','containerConsumers':consumers,'currentExactConfigReferences':cfg,'currentSelectedImageEnvironmentReferences':env,'retainedReleaseReferences':refs,'historicallyProtectedByOldCleanupPlan':any('image-cleanup-' in x['file'] and x['key']=='protectedImages' for x in refs),'proposedSixGbSet':selected,'reviewStatus':'CANDIDATE_OLD_PREVIOUS_BUILD' if selected else 'HOLD_CONFIGURATION_DEPENDENCY' if cfg or env else 'HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE','consequence':'Retires this previous Soil Museum build; no exact current configuration, container or retained LIMS release reference found.' if selected else 'See exact current and retained references; not part of the proposed set.','approvalRequired':True})
selected_names=['failed_db_20261004_031055.db','dev_pre_issue155_20261003_132428.db','dev_pre_issue159_20261003_221538.db']
backup_rows=[];hashed=a['oldBackupStableHashes']
for v in hashed:
 selected=pathlib.PurePosixPath(v['path']).name in selected_names
 copies=[x['path'] for x in hashed if x['path']!=v['path'] and x['sha256']==v['sha256'] and x['bytes']==v['bytes']]
 refs=release_refs([v['path']]);cfg=config_refs([v['path']]);fds=[p for p in m['processPathAndOpenFileReferences'] if v['path'] in p['openFileTargets']]
 mounts=[{'containerId':c['Id'],'names':c['Names'],'state':c['State'],'mountSource':z.get('Source')} for c in containers.values() for z in c.get('Mounts',[]) if z.get('Source')==v['path'] or v['path'].startswith(z.get('Source','<none>')+'/')]
 if selected:assert not refs and not cfg and not fds and not mounts and v['hardLinks']==1
 backup_rows.append({'item':'file:'+v['path'],**v,'proposedSixGbSet':selected,'verifiedOtherExactCopies':copies,'otherCopyVerified':bool(copies),'currentConfigurationReferences':cfg,'retainedReleaseReferences':refs,'processOpenFileReferences':fds,'containerMountConsumers':mounts,'latestBackupExcludedBySelection':True,'remainingDependency':'Retain '+copies[0]+'; byte-identical SHA-256 verified.' if copies else 'No active/configured/retained-release consumer found. This is a distinct old restore point; another exact copy has NOT been verified. Deleting it retires that historical restore point.','approvalRequired':True})
assert sum(x['proposedSixGbSet'] for x in backup_rows)==3
proof_rows=[x for x in proof['rows'] if x['eligibleForExactListReview']];assert len(proof_rows)==3
selected_image=next(x for x in images if x['proposedSixGbSet'])
cache_bytes=sum(x['bytes'] for x in cache_rows);backup_bytes=sum(x['allocatedBytes'] for x in backup_rows if x['proposedSixGbSet']);proof_bytes=sum(x['physicalDuXBytes'] for x in proof_rows);image_bytes=selected_image['estimatedUniqueBytes']
total=cache_bytes+backup_bytes+proof_bytes+image_bytes
assert total==6083182001
approved_set=[{'category':'build-cache','exactId':x['id'],'estimatedBytes':x['bytes'],'sizeBasis':x['sizeBasis']} for x in cache_rows]
approved_set += [{'category':'old-backup','exactPath':x['path'],'allocatedBytes':x['allocatedBytes'],'sha256':x['sha256'],'distinctHistoricalRestorePointWillBeLost':not x['otherCopyVerified']} for x in backup_rows if x['proposedSixGbSet']]
approved_set += [{'category':'unused-image','exactId':selected_image['id'],'exactTags':selected_image['tags'],'estimatedUniqueBytes':image_bytes}]
approved_set += [{'category':'old-proof-folder','exactPath':x['root'],'physicalDuXBytes':x['physicalDuXBytes'],'allEvidenceVerifiedElsewhere':True} for x in proof_rows]
result={'status':'READ_ONLY_EXACT_REVIEW_LIST_NO_DELETION_APPROVED','metadataWindowsUtc':[m['observedUtc'],a['observedUtc'],e['observedUtc']],'units':'Decimal GB = 1000000000 bytes','proposedSet':approved_set,'totals':{'estimatedCombinedBytes':total,'estimatedCombinedGb':total/1e9,'dockerCacheEstimatedBytes':cache_bytes,'backupPhysicalAllocatedBytes':backup_bytes,'proofPhysicalDuXBytes':proof_bytes,'unusedImageEstimatedUniqueBytes':image_bytes,'onlyVerifiedDuplicateBackupAlternativeBytes':cache_bytes+563326976+proof_bytes+image_bytes},'spaceIsEstimatedNotGuaranteedDockerDeletionDelta':True,'twoSelectedOldBackupsAreDistinctHistoricalRestorePoints':True,'protectedRunningImagesNotListed':True,'currentDatabaseAndLatestBackupNotListed':True,'unverifiedProofFoldersNotListed':True,'cache':cache_rows,'backups':backup_rows,'unusedImageOptions':images,'proofFolders':proof_rows,'excludedProtectedImageIdsInternalOnly':protected_image_ids,'noSqlOrLiveDatabaseContentAccess':True,'mutations':0,'filesDeleted':0,'prunes':0,'approvalRequiredForExactSet':True,'blanketPruneNotApproved':True}
out.write_text(json.dumps(result,indent=2),encoding='utf-8')
def csv_write(name,fields,rows):
 with (D/name).open('x',newline='',encoding='utf-8-sig') as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
  for row in rows:w.writerow({k:json.dumps(row.get(k),ensure_ascii=False) if isinstance(row.get(k),(dict,list)) else row.get(k) for k in fields})
csv_write('exact-build-cache-65-records.csv',['id','bytes','sizeBasis','inUse','sharedWithImages','parents','children','childrenOutsideProposedSet','description','lastUsedAt','dependsOn'],cache_rows)
csv_write('old-backup-options.csv',['path','allocatedBytes','bytes','sha256','proposedSixGbSet','verifiedOtherExactCopies','currentConfigurationReferences','retainedReleaseReferences','containerMountConsumers','remainingDependency'],backup_rows)
csv_write('unused-image-options.csv',['id','tags','logicalBytes','dockerSharedBytes','estimatedUniqueBytes','proposedSixGbSet','reviewStatus','currentExactConfigReferences','currentSelectedImageEnvironmentReferences','retainedReleaseReferences','consequence'],images)
csv_write('verified-proof-folder-options.csv',['root','physicalDuXBytes','currentFileCount','allCurrentFileBytesHaveIndependentlyVerifiedElsewhereCopy','containerMountConsumers','otherReleaseAuthorityReferences','processOpenFileReferences','eligibleForExactListReview'],proof_rows)
def gb(n):return f'{n/1e9:.6f}'
lines=['# Read-only host removal options: about 6 GB','',f"Observed {m['observedUtc']} to {e['observedUtc']}. No files, images, containers, cache or settings were changed.",'',f'**One exact option totals about {total/1e9:.3f} GB estimated.** It contains 65 explicitly listed unused/unshared cache records, three older standalone backup files, one unused previous Soil Museum image and three closed proof folders. Two backup files are distinct historical restore points without another verified exact copy; their retirement needs your explicit acceptance. The third backup has an independently hash-verified identical copy that stays.','', 'Docker estimates are separate from physical file allocations. Shared image layers are excluded from the image estimate; shared cache records are excluded. Actual Docker space reclaimed can differ. No blanket image/cache prune is approved.','', '| Review ID | Exact item | Estimated / physical GB | What still depends on it / consequence |','|---|---|---:|---|',f'| C1–C65 | Exact IDs and per-record bytes in [cache CSV](exact-build-cache-65-records.csv) below | {gb(cache_bytes)} | All InUse=false and Shared=false. No child cache record outside this exact set depends on a selected record. Future builds rebuild these caches; existing images stay. |']
for i,x in enumerate([z for z in backup_rows if z['proposedSixGbSet']],1):lines.append(f"| B{i} | `{x['path']}` | {gb(x['allocatedBytes'])} | {x['remainingDependency']} |")
lines.append(f"| I1 | `{selected_image['tags'][0]}` — `{selected_image['id']}` | {gb(image_bytes)} estimated unique; {gb(selected_image['logicalBytes'])} logical total | No running/stopped container, exact configuration or retained LIMS release reference found. Retires a previous Soil Museum build. |")
for i,x in enumerate(proof_rows,1):lines.append(f"| P{i} | `{x['root']}` | {gb(x['physicalDuXBytes'])} | All {x['currentFileCount']} file bytes independently matched to published Git blobs; no mount, process-open-file or other release-input reference found. |")
lines += ['', f'**Total: {total:,} bytes / {total/1e9:.3f} GB estimated.** If only the verified duplicate backup is acceptable, the same set excluding the other two backups is about {(total-2*563326976)/1e9:.3f} GB, short of 6 GB.', '', 'The running production image, current database, latest backup sets and proof folders without another verified evidence copy are excluded from this review list. In particular, the 050000 raw files and 060000 database files are not candidates. No current input, qualified build or retained stopped container is proposed for removal.','', '## Exact cache items','', '| ID | Bytes | GB | Parent IDs | Child IDs | Last used |','|---|---:|---:|---|---|---|']
for x in cache_rows:lines.append(f"| `{x['id']}` | {x['bytes']} | {gb(x['bytes'])} | {', '.join(x['parents']) or 'none reported'} | {', '.join(x['children']) or 'none reported'} | {x['lastUsedAt']} |")
lines += ['', '## Other unused images and remaining dependencies','', 'These are alternatives or held items, not additions to the 6.083 GB total. “Unused” means no current container reference after resolving the OCI manifests, not that no service or historical record needs the image.','', '| Exact tag(s) and ID | Logical GB | Docker unique estimate GB | Remaining dependencies / status |','|---|---:|---:|---|']
for x in images:
 if x['proposedSixGbSet']:continue
 desc=[]
 if x['currentExactConfigReferences']:desc+=['Current config: '+', '.join(f"{r['path']}:{r['line']}" for r in x['currentExactConfigReferences'])]
 if x['currentSelectedImageEnvironmentReferences']:desc+=['On-demand image reference: '+', '.join(r.get('name',r.get('path',''))+' / '+r.get('environmentKey',r.get('imageVariableKey','')) for r in x['currentSelectedImageEnvironmentReferences'])]
 if x['retainedReleaseReferences']:desc += [f"{len(x['retainedReleaseReferences'])} retained release/source references; exact files in image CSV/JSON"]
 if x['historicallyProtectedByOldCleanupPlan']:desc+=['Explicitly protected in the prior image-retention plan']
 lines.append(f"| {'; '.join('`'+t+'`' for t in x['tags'])}<br>`{x['id']}` | {gb(x['logicalBytes'])} | {gb(x['estimatedUniqueBytes']) if x['estimatedUniqueBytes'] is not None else 'unknown'} | {'; '.join(desc) or 'No dependency found in the inspected scope'} — {x['reviewStatus']} |")
lines += ['', 'In particular, the 15.275 GB on-demand lab image has no current lab container but is still selected by the running hub’s LAB_IMAGE setting and the deployment environment. It is held. Manual-sync and Temporal admin-tools are also still referenced by their Compose configuration.','', '## Evidence and limits','', 'All container states and image-manifest consumers were inspected. The dependency search covered 137 current configuration/service/cron files, selected image environment references, selected top-level release authority/scripts, and process/open-file references. It does not establish the absence of every possible manual command or external consumer. Exact dependency paths are retained in JSON and CSV.','', 'Files were measured by allocated blocks; the three proof roots also have fresh du-x totals. Every offered proof-root file was rehashed and matched to a raw Git object at an already published commit. Old standalone backup content was hashed on host only; no SQLite connection or backup content transfer occurred.','', 'Approval is pending for the exact IDs and paths above. Nothing will be deleted, pruned, moved or untagged from this report alone.']
(D/'review-list.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'status':result['status'],'proposedCacheRecords':len(cache_rows),'proposedBackupFiles':3,'proposedUnusedImages':1,'proposedVerifiedProofFolders':3,'estimatedTotalBytes':total,'estimatedTotalGb':total/1e9,'onlyVerifiedDuplicateBackupAlternativeGb':result['totals']['onlyVerifiedDuplicateBackupAlternativeBytes']/1e9,'filesDeleted':0,'prunes':0}))
