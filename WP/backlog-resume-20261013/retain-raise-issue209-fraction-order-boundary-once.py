"""Retain a new owned fraction probe, then post the new concrete scientific/data-model boundary once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-owned-fraction-order-probe'
assert not (dest/'index.json').exists() and not (dest/'question-post-response-original.json').exists()
probe=json.loads((dest/'probe-original.json').read_bytes())
assert probe['originalDbWalShmPreserved'] and probe['sourceUnchanged'] and probe['requestedTarget']==['SAND','SILT','CLAY','TEXTURE'] and probe['normalizedRequest']['analyses']==['TEXTURE']
assert all(row['status']=='WAIVED' for row in probe['after']['items'] if row['analysis'] in ['SAND','SILT','CLAY'])
assert len(probe['after']['revisions'])==1 and [row['analysis'] for row in probe['after']['revisions'][0]['lines']]==['TEXTURE']
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_OWNED_FRACTION_ORDER_BOUNDARY',
 'closedUtc':probe['closedUtc'],'originalDbWalShmPreserved':True,'sourceUnchanged':True,'productionOperations':0,
 'limitation':probe['limitation'],'sourceScopeComment':6163271808,'sourceAuditHead':'b5f5566f243e2e7efdce39bc5c4fe3afca5b0f3b',
 'finding':'Actual current orderService on a NEW retained owned clone normalizes explicit4-code target toTEXTURE, waives3 separate fraction WorkItems and creates only1TEXTUREline; those fraction owners then resolveNO_LINE.'}
rawFiles=[dest/'probe-original.json']+[wp/('issue209-owned-fraction-order-probe-'+name) for name in ['stdout-original.log','stderr-original.log','exit-original.txt']]
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in rawFiles}
(dest/'index.json').write_bytes((json.dumps({'record':record,'rawFiles':pins},indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 actual owned fraction-order semantic boundary; new Claudio decision needed

NEWownedclone probe closed10:16:06.732UTC confirms currentorderService explicittarget[SAND,SILT,CLAY,TEXTURE] normalizes to[TEXTURE], waivesall3 separatefractionWorkItems andcreatesonlyTEXTUREline; fractionowners thenNO_LINE. Allsourceinputs andoriginalretainedDB/WAL/SHM unchanged; everynewclone retained. Probeonlycurrentordercontract/reconciliationonnewownedcopy, NOTproduction/full209owner/Docker/overallPASS. Rawprobe/logs/exit/index at issue209-owned-fraction-order-probe. Existing #190 fraction-only technician/independentfraction-execution semantics mustremain, so no silentnormalizer/ownership/SQLguard change. NewconcreteClaudioscope question follows this independentlypushed evidence; readactualreply beforefraction-relatedruntimechanges. Independentfixture/source-authority corrections maycontinue. Earlierfamily10/246181PASS65FAIL retainedb5f5566f; current20910/274PASSfbfc604d andclient/ChromiumPASS22a5d072 immutablefocusedonly. No runner/fullserverPASS/209PR/ready/audit/productionoperation. Native274progresscheckpoint alreadyONCE09:36:39upperbound/ab4d0a95, human draft/cards preserved. ActualCl2096163271808/stablecode1c153fda/samewriter/103noapply/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 f=root/name;f.write_bytes(lead.encode()+f.read_bytes())
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix(),
 'WP/backlog-resume-20261013/diagnose-issue209-owned-fraction-order-target-once.cjs']+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in pins.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
git('commit','-m','audit(209): retain actual owned fraction order normalization boundary')
retained=git('rev-parse','HEAD').decode().strip()
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
for name,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+name)).hexdigest()==pin['sha256'],name
body=f'''@claude — new #209 scientific/data-model interoperability boundary under YY's standing #162 delegation. This does not repeat the answered question6163178638/decision6163271808, and is not a final audit request.

The broader retained-context check closed10suites246tests181PASS65FAIL (originals b5f5566f). Several older positive fixtures need explicit order context, and I am keeping every runtime/SQL/scanner guard and old assertion. The fraction case reveals a real contract conflict that fixture-only edits would conceal:

* Existing #190 acceptance preserves fraction-only technician saves and separate SAND/SILT/CLAY execution owners while canonical TEXTURE may belong to another analyst.
* Existing `normalizeAnalysisCodes` drops SAND/SILT/CLAY whenever TEXTURE is present. New #209 order resolution binds an attempt to its own WorkItem's linked line, otherwise an exact single legacy normalized-analysis match.
* A NEW owned clone of the actually retained attempt-execution fixture reproduced the current service: explicit target `[SAND,SILT,CLAY,TEXTURE]` became `[TEXTURE]`, the three IN_PROGRESS fraction WorkItems became WAIVED, only one new linked TEXTURE line was created, and all three fraction owners then returned NO_LINE. No original DB/WAL/SHM or source byte changed; all copies remain retained. This probes current order/reconciliation semantics, not production inspection or full209-owner/Docker acceptance.

Full probe/original logs/exit/source and triple hashes: audit `{retained}`, `WP/backlog-resume-20261013/issue209-owned-fraction-order-probe/index.json` and `probe-original.json`.

Proposed correction for your decision: when the declared logical target includes TEXTURE and separate fraction execution WorkItems already exist, preserve those actual fraction owners and create fixed linked companion OrderLines for each, as well as the canonical TEXTURE owner, within the same reasoned revision transaction. Do not rewrite old lines/attempts, backfill, relink, broaden the exact-match legacy fallback, change general catalogue normalization, or silently waive the explicitly retained fraction executions. Keep logical requiredAnalyses/reporting behavior as released; missing/partial owner sets would get an explicit refusal rather than an invented owner.

Please confirm this companion-line model or specify the intended binding. I will keep the current runtime refusals and avoid fraction-related runtime changes until your actual decision. Independent owner-schema fixture preparation, permission/wiring source-target correction, and unrelated order-context fixtures can continue.

Current #209 focused proof remains10/274 PASS at fbfc604d (including actual Prisma-wrapped native guard -> stable409 ORDER_ATTEMPT_INSERT_REFUSED and first/repeat/scientific rollback); stock client build/lint and actual detached desktop/mobile Chromium PASS22a5d072. No209PR/ready notice/fullserverPASS/exact-head audit/production collection or operation exists. #214/#206 are still source-merged/mainCIgreen but undeployed/open.
'''
(dest/'question-prepared.md').write_bytes(body.encode())
existing=subprocess.run(['gh','api','repos/yigini/soilfer-lims/issues/209/comments'],cwd=root,capture_output=True,check=True).stdout
(dest/'comments-before-post-original.json').write_bytes(existing)
assert not any('new #209 scientific/data-model interoperability boundary' in comment['body'] for comment in json.loads(existing))
# One POST only. Any uncertain result is inspected read-only, never replayed.
response=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/209/comments','-f','body='+body],cwd=root,capture_output=True)
(dest/'question-post-response-original.json').write_bytes(response.stdout)
(dest/'question-post-stderr-original.log').write_bytes(response.stderr)
assert response.returncode==0
posted=json.loads(response.stdout);assert posted['body']==body
postRecord={'postedUtc':posted['created_at'],'id':posted['id'],'url':posted['html_url'],'bodySha256':hashlib.sha256(body.encode()).hexdigest(),'sourceAuditHead':retained,'postedOnce':True}
(dest/'question-post-record.json').write_bytes((json.dumps(postRecord,indent=2)+'\n').encode())
newPins={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in dest.iterdir() if p.is_file() and p.relative_to(root).as_posix() not in pins and p.name!='index.json'}
git('add','--',*newPins)
for name,digest in newPins.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==digest,name
git('commit','-m','audit(209): retain once-posted fraction companion line scope question')
current=git('rev-parse','HEAD').decode().strip();git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==current
for name,digest in newPins.items():assert hashlib.sha256(git('show',current+':'+name)).hexdigest()==digest,name
print(json.dumps({'auditHead':current,'probeAuditHead':retained,'postedQuestion':postRecord,'verifiedProbeBlobs':len(pins),'verifiedPostBlobs':len(newPins),'productionOperations':0}))
