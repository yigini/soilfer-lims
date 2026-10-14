"""Publish the complete verified bounded metadata-only graph and original interface/guard evidence."""
import datetime,hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='cc7b7469593f4794b9b190f8caee92caaac678d2'
assert not cmd('git','diff','--cached','--name-only').strip()
sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import *
proof=exact_json((SOURCE/'source-local-host-verification-once/exit-original.json').read_bytes())
require(proof['status']=='PASS_METADATA_SOURCE_GUARDS_NOT_EXECUTION' and proof['sourceUnchanged'] and proof['localGuardTests']==proof['actualHostGuardTests']==14,'Current source verification incomplete')
for n,d in proof['sourceSha256After'].items():require(sha((SOURCE/n).read_bytes())==d,'Source changed since verification')
description='''# New source: bounded forward metadata evidence only

The first candidate build remains FAILED under its original 500 MB disk gate. Candidate cde8c889/tree638 image sha256:1d4882f49f351a08549c79c0409f7848dbb205feef314b33432aae63ed11217b is forensic only. Actual Claudio directions6180234041 and6180335648 allow preparing a new read-only forward route; they approve no source, execution or receipt. The exact original failed root, mode0600 candidate ID and sealed mode0400 build log remain unchanged. The original image-inspect-original.json never existed. The explicitly distinct first closed forensic response is retained at a514/SHA256c4b4d2fabe2783adf0eb6f842bb424982fcb6a7d53753b3dde2c79800f821c14.

This complete five-file source graph is the next bounded EVIDENCE component for the eventual validator. It collects original image identity, current filesystem reserves, containerd namespaces/images/content, snapshot info plus usage for committed snapshots, BuildKit cache metadata, and small OCI runtime metadata for the candidate/base digest graph. It does not adopt the image, calculate or claim complete growth attribution, create an adoption receipt, make the image proof-eligible, run a production-copy proof or deploy. A later concrete validator/receipt source review must use the actual evidence and satisfy all six conditions. Residual>=500000000B remains STOP, and the missing pre-build containerd allocation remains unknown.

Only a new actual exact-source Claudio PASS with full five hashes and literal bindings can authorize the preparer/launcher/collector. The planned first metadata root is fixed to /opt/lims/releases/workflow-batch-forward-metadata-cde8c889-20261014T233000Z. The package contains only reviewed raw source, actual current main/closedCI/source review, full actual scope/reference directions and immutable first-closed forensic references. Fresh source/main/CI/directions/later-rejection checks run before upload and again immediately before launch. Exclusive intents/new root/unused unit prevent replay, and uncertain outcomes require same-root/unit inspection.

The collector compares the original candidate ID and successful exported ID in the sealed build log to the first forensic response; a fresh read-only image inspect must match ID, runtime platform, entire RootFS, revision label and entire Config. Any reference bytes/modes or absence change stops collection. Filesystem aliases refuse; current floor10556150894B applies on /opt/lims, /var/lib/docker and /var/lib/containerd before and after. Source remains on the exact audited cde8/mainCI38636615469 attempt1 SUCCESS370/5649.

The command whitelist permits only docker image inspect/info, BuildKit's read-only DiskUsage API through docker buildx du, and ctr namespace/image/content/snapshot listing/info/committed-usage plus small OCI metadata retrieval. It runs zero filesystem du executables. Commands are arrays with no shell; exact image/socket/namespaces/read interfaces are pinned; unsafe digest/key/option injection and mutation verbs refuse. Every call is bounded to10seconds and2MiB stdout/stderr; total collection600seconds/256calls, OCI metadata<=32objects and snapshots<=80per namespace with no truncation. Oversized/timeout/unknown interfaces yield STOP_METADATA_INCOMPLETE_IMAGE_EXCLUDED, retain all raw outputs and never replay.

Docker/buildx client state and temp/cache paths stay inside the new evidence root. No pull/push/save/load/build/retag/container start/prune/DB connection/volume mount/daemon or configuration change is permitted. The bounded unit uses MemoryMax805306368/MemorySwapMax0/RuntimeMax900/Restartno/UMask0077 and writes its own stdout/stderr only in this root. Its two freshly created empty unit outputs are included in the initial inventory guard; immutable package files remain0400. No original root file is written or chmodded.

Closed current verification23:26:55.513691UTC:14 local +14 actual host Python3.9.23 pure guards, all five source files compile in memory and all hashes unchanged. No metadata operator/image inspect/adoption/receipt/production connection was executed by those tests. A preliminary12guard quick run was an earlier source boundary, with its tool-output transcription labeled honestly. Actual existing CLI help at23:07:15UTC shows ctr2.2.0 and the exposed read interfaces; help only ran, with no attribution collection. Original help outputs, current full guard logs, source hashes and exact host verifier are retained.

The original build failure and all old source passes, roots/images/inputs/logs/gates remain immutable. All future scientific214/209impact lists, invalidStoredAnalysisSampleCount/sample-owner IDs, policyPRESENT/NO_OP0orSTOP, retained allocation accounting, nonzero lists to YY, approved-amendment nonzeroSTOP/separatelyreviewed forward remedy, separately reviewed stopped production-copy proof, final exact-kit review and fresh single-use gate remain required. #103 has no connection/APPLYGO, and human files/drafts/cards remain untouched.
'''
readme=SOURCE/'README.md'
with readme.open('x',encoding='utf-8') as f:f.write(description)
with (SOURCE/'preliminary-12-guard-tool-output-transcription.json').open('x',encoding='utf-8') as f:json.dump({'status':'PRELIMINARY_EARLIER_SOURCE_GUARDS_PASS','evidenceKind':'TOOL_OUTPUT_TRANSCRIPTION','literalSummary':'Ran 12 tests in 0.002s\n\nOK','toolExitCode':0,'sourceBeforeAfterHashesAvailable':False,'currentFinalGuardCount':14,'currentProof':'source-local-host-verification-once/exit-original.json','metadataCollectorsRun':0,'imageAdoptions':0,'newReceipts':0},f,indent=2)
paths=[SOURCE/n for n in sorted(SOURCE_FILES)]+[readme,SOURCE/'preliminary-12-guard-tool-output-transcription.json']
for folder in [SOURCE/'source-local-host-verification-once',REPO/'WP/batch-release-cde8-20261014/forward-source-containerd-cli-interfaces-once']:
    paths.extend(sorted(p for p in folder.iterdir() if p.is_file()))
paths.extend([REPO/'WP/backlog-resume-20261013/read-containerd-source-planning-cli-help-once.py',REPO/'WP/backlog-resume-20261013/verify-forward-metadata-source-local-and-host-once.py',pathlib.Path(__file__)])
tracking=REPO/'WP/audit-release-eb6de2e8/README.md'
tracking.write_bytes(('## 2026-10-14 NEW bounded forward METADATA-ONLY source ready for review\n\nComplete5file graph WP/batch-forward-metadata-cde8-20261014/README.md/14local+14actualhost3.9pureguardPASS/all5compile/hashesunchanged23:26:55UTC. New fixed metadata233000root UNCREATED; no sourcePASS/operator/receipt/adoption. Exact whitelist/budgets/currentreserve/refidentity/absence/client-state-isolation/unit-output-inventory/zerooperations guards. Scope618023+reference618033 directionONLY; originalfailed221500imageFORENSICONLY. Bounded metadata step collects evidence for a later separatelyreviewed fullattribution/validator/receipt; fullresidual3,609,116,672B muststillbeexplained withresidual>=500MBSTOP. No recursivefilesystemdu/adoption/proof/kit/gate/deploy/103connection. ActualCLIhelp2.2interface and preliminary12testtranscription retainedhonestly; no appsourcechanges.\n\n').encode()+tracking.read_bytes());paths.append(tracking)
index_path=SOURCE/'source-publication-index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':'COMPLETE_BOUNDED_METADATA_SOURCE_REVIEW_READY_NOT_APPROVED','preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sourceSha256':proof['sourceSha256After'],'metadataScope':SCOPE,'imageEligibility':False,'newSourceReview':None,'newExecutionAuthority':None,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
for p,rel in zip(paths,rels):require(cmd('git','show',':'+rel)==p.read_bytes(),'Raw staged bytes differ')
cmd('git','commit','-m','Prepare complete bounded read-only forward metadata graph and guard proofs')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(cmd('git','show',head+':'+rel)==p.read_bytes(),'Raw source Git bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':'PUSHED_COMPLETE_METADATA_SOURCE_REVIEW_READY','head':head,'verifiedBlobs':len(paths),'guardTestsLocal':14,'guardTestsActualHost':14,'imageEligibility':False,'newSourceReview':None,'newExecutionAuthority':None}))
