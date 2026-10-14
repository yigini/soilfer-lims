import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-native-274-progress-checkpoint'
assert (dest/'native-checkpoint-actual-text.txt').exists() and not (dest/'native-delivery-record.json').exists()
text=(dest/'native-checkpoint-actual-text.txt').read_text(encoding='utf8')
assert text.startswith('Pip #209 progress:') and 'fbfc604dcd06aaaf2401d56bf8ac0fde600fbd48' in text and '274/274' in text and 'No #209 PR' in text
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'deliveryObservedNoLaterThanUtc':'2026-10-14T09:36:39Z',
 'exactCaptureTimeAvailable':False,'sourceAuditHead':'fbfc604dcd06aaaf2401d56bf8ac0fde600fbd48',
 'window':{'id':5311708,'app':'Claude_pzs8sxrjxfjjc!Claude','project':'LIMS Audit','thread':'Lab workflow audit and plan'},
 'freshActualWindowTarget':True,'rightComposerInitiallyEmpty':True,'focusCaretObservedBeforeTyping':True,
 'draftHeadAndEndInspected':True,'returnKeyCount':1,'actualSentBubbleVerified':True,'rightComposerEmptyAfter':True,'claudioState':'Churning',
 'centreHumanDraft':'can you go and ask Pip','humanDraftPreserved':True,'cardsAnswered':False,
 'progressCheckpoint':True,'finalAuditRequest':False,'fullServerPassClaimed':False,'productionOperations':0}
(dest/'native-delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'record':record,'rawFiles':pins},indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 stable-code/full-progress checkpoint delivered ONCE

ActualnativePip274-test progresscheckpoint SENTONCE/visuallyverified no laterthan09:36:39UTC afterfreshreturnedClaude5311708/LIMS Audit/Labworkflowaudit/rightEMPTY/focuscaret/drafthead+endinspection/oneReturn/actualsentbubble+emptyright/ClChurning. CentreHUMANDRAFT "can you go and ask Pip" preserved/cardsuntouched. Exactactualtext/native-delivery-record2verifiedblobs at issue209-native-274-progress-checkpoint/index.json. Neverduplicate; progress NOTfinal209auditrequest. Sourceauditfbfc604d/closed09:33:09.78260710/274 PASS/frozen370discovery actualwrappedguard own409 ORDER_ATTEMPT_INSERT_REFUSED+first/repeat/scientificrollback allpass/oldOPENfirstfill+SQL/scanners unchanged. Clientbuildlint/actualdetachedChromiumPASS22a5d072. No fullserverPASS/209PR/ready/audit/productionoperation. Remainingbroaderhistoricalownedfixturecontexts/fullverification; keepautonomousauthorizedsamewriter. OriginalCl209scope6163271808/nativeguard-code direction1c153fda;214mainCIcompletegreen366/5566/214+206undeployedopen/alloldhandoffs immutable. Humancontent/103noapply/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 f=root/name;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
git('add','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in pins.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
git('commit','-m','audit(209): retain once-sent stable code progress checkpoint')
retained=git('rev-parse','HEAD').decode().strip()
for name,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'rawBlobsVerified':len(pins),'nativeCheckpointSentOnce':True,'finalAuditRequest':False,'productionOperations':0}))
