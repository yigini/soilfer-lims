from pathlib import Path
import json,hashlib
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';entry=h/'backup-tail549-entry-1308-once';p=entry/'post-backup-normalization-close-source-review.json';prior=p.read_bytes();v=json.loads(prior)
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(w/v['nativeSource']['path']).read_bytes();assert sha(raw)==v['nativeSource']['sha256'];ls=raw.splitlines(keepends=True);start=sum(map(len,ls[:66280]));end=sum(map(len,ls[:66365]));part=raw[start:end]
value={'version':1,'scope':'POST_BACKUP_NON_WAL_JOURNAL_METADATA_SOURCE_ADDENDUM','parentReviewSha256':sha(prior),'nativeSource':v['nativeSource'],
 'exactNativeExcerpt':{'label':'pager_set_journal_mode_close_delete_and_lock_branches','firstLine':66281,'lastLine':66365,'startByte':start,'endByte':end,'bytes':len(part),'sha256':sha(part),'text':part.decode()},
 'additionalProducer':{'producer':'non_wal_journal_mode_namespace_and_locks','conditions':'nonexclusive transition from PERSIST/TRUNCATE to even-numbered modes including MEMORY; lock-dependent close/delete branch, or jfd close when switching to MEMORY/OFF','effects':'non-WAL journal-mode change must not automatically be called zero filesystem operations; old mode, lock state and open journal state require actual binding','completeCountOrSizeDerived':False},
 'localModeOnlyDoesNotProveNoNamespaceEffects':True,'actualPriorModeLockAndJournalStateVerified':False,'actualFilesystemOperationsExecuted':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}
(entry/'journal-mode-metadata-source-addendum.json').open('x',encoding='utf8').write(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n')
print(json.dumps({'addendumSha256':sha((entry/'journal-mode-metadata-source-addendum.json').read_bytes()),'exactAdditionalNativeExcerpts':1,'sourceReviewExcerptsTotal':13,'reviewedProducerFamiliesTotal':7,'sqlExecutions':0,'newTests':0,'operationalCodeChanged':False}))
