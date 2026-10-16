"""Publish concrete kit foundation and retained timing comparison; no host calls."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'foundation-timing-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='23aeff2695972230ce2c6e1312255bee726fc311'
assert not git('diff','--cached','--name-only').strip()
v=json.loads((K/'foundation-local-first/verification.json').read_bytes())
assert v['testExit']==v['deriveExit']==0 and v['sourceBefore']==v['sourceAfter']
for name,digest in v['sourceBefore'].items():assert sha((K/name).read_bytes())==digest
timing=json.loads((K/'timing-evidence.json').read_bytes())
for row in timing['references']:
    raw=(W/row['path']).read_bytes();assert sha(raw)==row['sha256'] and len(raw)==row['bytes'] and oid(raw)==row['gitBlobOid']
    assert git('show','HEAD:'+row['path'])==raw
assert timing['wholeSequenceUnder600SecondsProved'] is False and timing['threeApplyCallsSeconds']>410 and timing['comparisonApplyPlusFastestAcceptedReadinessPlusTenSecondGrace']>815
captures=[]
for path in ['repos/yigini/soilfer-lims/issues/comments/6212990400','repos/yigini/soilfer-lims/issues/comments/6033653468','repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721']:
    raw=subprocess.check_output(['gh','api',path],cwd=W);captures.append((path,raw))
review,pin,main,ci=[json.loads(raw) for _,raw in captures]
sys.path.insert(0,str(K));import kit_contract as c
c.acceptance(review)
assert pin['id']==6033653468 and pin['created_at']==pin['updated_at'] and pin['performed_via_github_app']['id']==1236702
assert 'Failure before COMMIT' in pin['body'] and 'point of no return' in pin['body']
assert main['object']['sha']==c.HEAD and ci['head_sha']==c.HEAD and ci['status']=='completed' and ci['conclusion']=='success' and ci['run_attempt']==1
D.mkdir()
for i,(path,raw) in enumerate(captures):save(D,'api-original-'+str(i)+'.json',raw)
save(D,'api-index.json',canonical([{'endpoint':path,'file':'api-original-'+str(i)+'.json','sha256':sha(raw),'bytes':len(raw)} for i,(path,raw) in enumerate(captures)])+b'\n')
save(D,'foundation-boundary.json',canonical({'observedUtc':utc(),'completeKit':False,'executableReleaseExists':False,'exactSourcePassExists':False,'gateExists':False,'hostCalls':0,'productionCalls':0,'timingBoundaryNeedsClaudioClarification':True,'allSevenLocalCriticalRefusalTestsPass':True,'postflightPolicy':c.POSTFLIGHT_POLICY,'predecessorAutomaticRestart':False})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}|{p for p in (K/'foundation-local-first').iterdir() if p.is_file()}|{W/r['path'] for r in timing['references']}|{__import__('pathlib').Path(__file__)}
lead='LATEST CONCRETE KIT FOUNDATION / WHOLE-OUTAGE TIMING BOUNDARY - 2026-10-16T10:06:40Z.\nNew source-only foundation WP/batch-release-kit-be837974-20261016 binds actual qualification acceptance6212990400/mainbe837974/acc15844/cd3a2757. Seven critical local refusal tests PASS; no host/SQL/operator/source approval/gate/deployment. Postflight selected AFTER natural sync with explicit Sample/AuditLog deltas and Result/Batch/BatchQcResult unchanged; full provenance comparator still mandatory. Fresh YY gate must accept193new23holds20oldcrossduplicates1ZMBnotification/otherlabs0/maygrow plus lab-hub workload control. No automatic predecessor restart, even absent commit receipt; any installer/entrypoint attempt requires separately reviewed forward fix.\nRetained timing originals show206/214/209 APPLY89.3475+130.2412+190.7438=410.332512s; all9dry/apply/repeat632.285438s. Fastest accepted100000 readiness394.886040s plus10sstop grace => comparison815.218552s BEFOREquiesce/integrityFK/backup/preservation/probes/reopen. Historical installers werecde8/B5, not a measuredacc158productionsequence. Both100000+233000 usedALREADYinstalled112/42;233000isstartup-only, not a three-installer install path. Whole9to10minoutage fit NOTESTABLISHED; do not invent measured fit or change600readiness. Need one concrete Claudio timing-boundary clarification; rest of kit implementation continues. Full coordinator NOTYETcomplete/reviewrequested; no kit SourcePASS exists. Acceptance result6212737130 ANSWERED/10:04:23fallbackCANCELLED forever. MainMERGEHOLD/208207agentsactive/no duplicates/no host/prune/103/humansheld. Preserve all prior history below.\n\n'
print(json.dumps(boundary_publish(D,extras,'Publish kit foundation and measured outage timing boundary',lead)))
