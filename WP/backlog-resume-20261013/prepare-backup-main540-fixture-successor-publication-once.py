from pathlib import Path
import ast,json
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';target=h/'publish-kit-backup-main540-fixture-successor-once.py';assert not target.exists()
s=(h/'publish-kit-backup-main540-once.py').read_text(encoding='utf8')
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
once("with_name('backup-main540-publication-notes-once.txt')","with_name('backup-main540-fixture-successor-publication-notes-once.txt')")
once("D=K/'backup-main540-publication-once'","D=K/'backup-main540-fixture-successor-publication-once'")
once("runs=['backup-main540-first']","runs=['backup-main540-first','backup-main540-second']")
once("zip(runs,[0],[540],[234],['OK'])","zip(runs,[1,0],[540,540],[234,234],['FAILED (failures=1)','OK'])")
once("'value':json.loads(raw) if path.name.endswith('.json') else None}","'value':json.loads(raw) if path.name.endswith('.json') and raw.strip() else None}")
once('backup_main_rows=[]','backup_main_rows=[];failed_backup_main_commands=[]')
once(" out=case['stdout-original.json'];value=out['value'];original=case['plan-before-backup.json'];plan=original['value'];snapshot=case['before-finish-main-original.bin']", """ out=case['stdout-original.json']
 if case['exit-original.json']['value']['exitCode']!=0:
  assert folder.endswith('/abort') and case['exit-original.json']['value']['exitCode']==1 and out['value'] is None
  failed_backup_main_commands.append({'folder':folder,'stdoutOriginal':original_pin(out),'exitOriginal':original_pin(case['exit-original.json']),'completedParameterCase':False,'releaseFailureOrSourceProofFailure':False})
  continue
 value=out['value'];original=case['plan-before-backup.json'];plan=original['value'];snapshot=case['before-finish-main-original.bin']""")
once(" assert 0<snapshot['bytes']==value['beforeFinishBytes']<=maximum", " assert 0<=snapshot['bytes']==value['beforeFinishBytes']<=maximum")
once(" assert not value['nativePagerOrFileRequestsMeasured']", " if value['mode']=='commit' or value['page']<=4096:assert value['beforeFinishBytes']>0\n assert not value['nativePagerOrFileRequestsMeasured']")
once("'beforeFinishBytesObserved':value['beforeFinishBytes']", "'planMatchesCurrentProof':plan['sourceProofSha256']==sha((K/'backup-main-source.json').read_bytes()),'visiblePrefinishMainBytesObserved':value['beforeFinishBytes']>0,'beforeFinishBytesObserved':value['beforeFinishBytes']")
once('assert len(backup_main_rows)==6*len(runs) and len(backup_main_setups)==3*len(runs)',"assert len(backup_main_rows)==9 and len(backup_main_setups)==5 and len(failed_backup_main_commands)==1 and sum(r['planMatchesCurrentProof'] for r in backup_main_rows)==6")
once("'nativeLocalCommandsIncludingSetup':9*len(runs)","'nativeLocalCommandsIncludingSetup':15,'failedNewFixtureAbortCommands':failed_backup_main_commands,'historicalCompletedCasesUsingEarlierProof':3,'currentProofCompletedCases':6")
once("for name in ['prepare-backup-main533-entry-once.py','prepare-backup-main-source-once.py','prepare-backup-main540-publication-once.py','backup-main540-publication-notes-once.txt']:","for name in ['prepare-backup-main533-entry-once.py','prepare-backup-main-source-once.py','prepare-backup-main540-publication-once.py','repair-backup-main-fixture-spill-expectation-once.py','prepare-backup-main540-fixture-successor-publication-once.py','backup-main540-publication-notes-once.txt','backup-main540-fixture-successor-publication-notes-once.txt','publish-kit-backup-main540-once.py']:")
ast.parse(s)
notes=(h/'backup-main540-publication-notes-once.txt').read_text(encoding='utf8').replace('WP/batch-release-kit-be837974-20261016/backup-main540-publication-once','WP/batch-release-kit-be837974-20261016/backup-main540-fixture-successor-publication-once')
notes=notes.replace('SOLE frozen {summary}','FINAL frozen {summary}').replace('local-tests-backup-main540-first. No failed/focused/other run.','local-tests-backup-main540-second. First full540 ONEFAILURE310.250s/start2026-10-17T12:14:54.913592+00:00/closed2026-10-17T12:20:05.842143+00:00/ALL234unchanged: NEW4096 fixture expected visible MAIN spill after4MiB copied. Predicate refused; no original pre-error progress JSON was emitted. Source build DEFAULT_CACHE_SIZE=-16000 is pinned, NOT loaded-cache-capacity measurement. After actual closure changed ONLY new fixture/narrative to wait for observed nonzero MAIN at512/4096;65536 abandons its prefix with actual MAIN bytes retained including0, without assuming spill. Production module/guards unchanged. BOTH complete stdout/stderr/verification/ALL234 source-at-test retained in local-tests-backup-main540-first and-second; first remainsFAILED. No focused/other run.')
notes=notes.replace('actual pinned native default-cache spilling backups512/4096/65536 EACHcommit+abandon. Six native parameter cases/9Node commands including3setup;', 'actual pinned native default-cache backups512/4096/65536 EACHcommit+abandon in finalrun. Nine completed parameter cases across BOTH fullruns(3historical/6currentproof), ONE refused NEWabort-fixture command,15Nodecommands including5setup;')
notes=notes.replace('Every abort samples real >0 pre-finish MAIN bytes with remaining source pages then final0 after close;', 'At512/4096 completed aborts sample real >0 pre-finish MAIN bytes with remaining pages then final0;65536 retains observed pre-finish bytes including0, not no dirty-cache/full transient/no-spill proof;')
notes=notes.replace('H/prepare-backup-main533-entry-once.py,prepare-backup-main-source-once.py,prepare-backup-main540-publication-once.py,publish-kit-backup-main540-once.py CONSUMED NEVER REPLAY.', 'H/prepare-backup-main533-entry-once.py,prepare-backup-main-source-once.py,prepare-backup-main540-publication-once.py,repair-backup-main-fixture-spill-expectation-once.py,prepare-backup-main540-fixture-successor-publication-once.py,publish-kit-backup-main540-fixture-successor-once.py CONSUMED NEVER REPLAY. Prepared publish-kit-backup-main540-once.py NEVER EXECUTED/superseded/NEVER EXECUTE.')
(h/'backup-main540-fixture-successor-publication-notes-once.txt').open('x',encoding='utf8').write(notes)
target.open('x',encoding='utf8',newline='').write(s)
print(json.dumps({'publisherPrepared':str(target),'executed':False,'expectedFinalTests':540,'sources':234,'closedRunsExpected':2,'nativeCompletedCasesExpected':9,'failedNewAbortCommandsExpected':1}))
