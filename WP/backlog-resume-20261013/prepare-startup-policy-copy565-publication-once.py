from pathlib import Path
import ast
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013'
source=h/'publish-startup-a94-prefix565-source-once.py';target=h/'publish-startup-policy-copy565-source-once.py';assert not target.exists()
s=source.read_text(encoding='utf8')
def replace(old,new,count=1):
 global s
 assert s.count(old)==count,(old,s.count(old),count)
 s=s.replace(old,new)
replace("E=H/'startup-a94-prefix565-entry-1451-once';D=K/'startup-a94-prefix565-source-publication-once'","E=H/'startup-policy-copy565-entry-1508-once';D=K/'startup-policy-copy565-source-publication-once'")
replace("PRIOR_HEAD='baff7d042c21cad5c420205d393ce211b6253c52'","PRIOR_HEAD='482d17179299892096e2a8fd1ea4264eca143a8a'")
replace("prior=K/'candidate-startup565-source-publication-once'","prior=K/'startup-a94-prefix565-source-publication-once'")
replace('startup-a94-already-applied-prefix-source-review.json','startup-policy-copy-context-source-review.json')
replace('2457ed3662f6e6c832f2dea92bf4505a23ebd0a55accda6332e35598c25ec526','d0a44305f3614971391c17cd6b834a5865f85e81c80942f73ce767455a73d08f')
replace("assert len(r['files'])==119 and len(r['exactReleaseSourceExcerpts'])==6 and len(r['explicitQueryCatalogue'])==10 and len(r['sourceFamilies'])==6 and len(r['fullReleaseSourceOriginalBindings'])==2","assert len(r['files'])==125 and len(r['exactReleaseSourceExcerpts'])==9 and len(r['sourceFamilies'])==8 and len(r['fullReleaseSourceOriginalBindings'])==6")
replace("assert not r['actualRuntimeAlreadyAppliedEntryOrSqlExecutionsObserved'] and not r['nativeSorterMaterializationCountAndFullPayloadInventoryDerived']","assert not r['actualDefaultStartupOrCacheHitObserved'] and not r['wholeStartupCopyInventoryComplete']")
replace("assert not r['beforeInitialReaderSqlAdmissionImplemented'] and not r['writerGraphAdmissionImplemented'] and not r['physicalFilesystemClosureClaimed']","assert not r['beforeDefaultStartupHeldAdmissionImplemented'] and not r['writerGraphAdmissionImplemented'] and not r['physicalFilesystemClosureClaimed']")
replace("assert r['symbolicCallCount']['formula']=='7+e+U*(r+c)' and not r['symbolicCallCount']['countIsNativeApiOrHandleOrRowOrFrameInventory']","assert sum(x['directPolicyReviewOpportunities'] for x in r['selectedCallerOpportunityLedger'])==r['conditionalSelectedExplicitReviewOpportunities']==8\nassert r['conditionalDirectJsCopyFileInvocationLimit']==24 and not r['nativeCopyOrPagerOrSyscallCountsMeasured']")
replace('startup-a94-prefix565-source-publication-notes-once.txt','startup-policy-copy565-source-publication-notes-once.txt',2)
replace("'fullSourcePins':119,'exactReleaseSourceExcerpts':6,'explicitQueryCatalogueEntries':10,'sourceFamilies':6,'fullPublicReleaseOriginalBindings':2,'sourceOnlyExplicitCallFormula':'7+e+U*(r+c)','formulaIsNativeApiOrHandleCount':False","'fullSourcePins':125,'exactReleaseSourceExcerpts':9,'sourceFamilies':8,'fullPublicReleaseOriginalBindings':6,'conditionalSelectedJsReviewOpportunities':8,'conditionalSelectedDirectJsCopyInvocations':24,'wholeStartupCopyInventoryComplete':False,'nativeCopyOrPagerOrSyscallCountsMeasured':False")
replace("'actualAutomaticWakeObservedUtc':'2026-10-17T14:51:18.630Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T15:08:18.794Z'")
replace('prepare-startup-a94-prefix565-entry-once.py','prepare-startup-policy-copy565-entry-once.py')
replace('prepare-startup-a94-prefix565-source-review-once.py','prepare-startup-policy-copy565-source-review-once.py')
replace('prepare-startup-a94-prefix565-publication-once.py','prepare-startup-policy-copy565-publication-once.py')
replace('docs(release): catalogue already-applied startup A94 prefix SQL','docs(release): catalogue selected startup snapshot copy paths')
ast.parse(s);target.write_text(s,encoding='utf8')
print({'publisher':str(target.relative_to(w)),'syntaxValidated':True,'newTestRuns':0,'newPrivateInventory':False})
