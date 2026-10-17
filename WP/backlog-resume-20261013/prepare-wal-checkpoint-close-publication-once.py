from pathlib import Path
import ast,hashlib,json
h=Path(__file__).resolve().parent;out=h/'publish-wal-checkpoint-close-source-once.py';assert not out.exists()
s=(h/'publish-backup-tail-source-review-once.py').read_text(encoding='utf8')
def replace(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
s=s.replace('backup-tail549-entry-1308-once','wal-close556-entry-1341-once').replace('backup-tail-source-publication-once','wal-checkpoint-close-source-publication-once')
s=s.replace('bd4d3f09f02d0e72f728a459f0ff58c76b833c91','891614f037d74f2cffeeaaa138472a9489d9f44f')
replace("prior=K/'backup-caller549-publication-once';v=json.loads((K/'local-tests-backup-caller549-first/verification.json').read_bytes())","prior=K/'header-normalization556-publication-once';v=json.loads((K/'local-tests-header-normalization556-second/verification.json').read_bytes())")
replace("len(v['sourceBefore'])==237","len(v['sourceBefore'])==240")
replace("review_raw=(E/'post-backup-normalization-close-source-review.json').read_bytes();r=json.loads(review_raw)","review_raw=(E/'wal-checkpoint-close-source-review.json').read_bytes();r=json.loads(review_raw)")
replace("add_raw=(E/'journal-mode-metadata-source-addendum.json').read_bytes();a=json.loads(add_raw)\n",'')
replace("assert len(r['files'])==98 and len(r['nativeExcerpts'])==12 and a['parentReviewSha256']==sha(review_raw)","assert len(r['files'])==101 and len(r['nativeExcerpts'])==25 and len(r['producerFamilies'])==8 and len(r['staticOsApiSourceSites'])==31")
replace("r['nativeExcerpts']+[a['exactNativeExcerpt']]","r['nativeExcerpts']")
replace("not r['completeQuantitativePostNormalizationOrCloseBoundDerived']","not r['completeCheckpointAndSourceCloseBoundImplemented']")
replace("(H/'backup-tail-source-publication-notes-once.txt')","(H/'wal-checkpoint-close-source-publication-notes-once.txt')")
replace("'journalMetadataAddendumSha256':sha(add_raw),'fullSourcePins':98,'exactNativeExcerpts':13,'reviewedProducerFamilies':7","'fullSourcePins':101,'exactNativeExcerpts':25,'reviewedProducerFamilies':8,'staticOsApiSourceSites':31,'staticSitesAreDynamicCallCounts':False,'currentCheckpointHeadAndAssociationVerified':False,'passiveOkIsCompleteBackfill':False,'previousReaderNIsCheckpointHeadD':False")
replace("'earlierFullSuiteTests':549","'earlierFullSuiteTests':556")
replace("'all236NonReadmeSourcesUnchanged'","'all239NonReadmeSourcesUnchanged'")
replace("'actualAutomaticWakeObservedUtc':'2026-10-17T13:08:17.598Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T13:41:17.919Z'")
replace("'completePostNormalizationOrCloseBoundsDerived':False","'completeCheckpointAndSourceCloseBoundImplemented':False")
replace("for name in ('prepare-backup-tail549-entry-once.py','prepare-backup-tail-source-review-once.py','extend-backup-tail-journal-metadata-review-once.py','backup-tail-source-publication-notes-once.txt'):","for name in ('prepare-wal-close556-entry-once.py','prepare-wal-close-checkpoint-source-review-once.py','prepare-wal-checkpoint-close-publication-once.py','wal-checkpoint-close-source-publication-notes-once.txt'):")
replace("'docs(release): inventory post-backup and source-close producers'","'docs(release): audit checkpoint head and close producers'")
ast.parse(s);out.open('x',encoding='utf8',newline='').write(s)
record={'publisher':out.name,'bytes':len(s.encode()),'sha256':hashlib.sha256(s.encode()).hexdigest(),'scope':'SOURCE_DOCUMENTATION_ONLY','expectedFullSourcePins':101,'expectedNativeExcerpts':25,'newTests':0,'newSql':0,'newPrivateInventory':False,'publisherExecuted':False}
(h/'wal-close556-entry-1341-once/publication-preparation-record.json').open('x',encoding='utf8').write(json.dumps(record,sort_keys=True)+'\n');print(json.dumps(record))
