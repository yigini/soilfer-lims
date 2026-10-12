"""Retain the actual forward-fix scope without granting production authority."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

d = Path(__file__).resolve().parent
w = d.parent.parent
raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6131470499'])
scope = json.loads(raw)
assert scope['id'] == 6131470499 and scope['created_at'] == '2026-10-12T19:48:31Z'
assert 'nothing in production changes without YY\'s own answer' in scope['body']
with (d / 'pr294-forward-scope-6131470499-api.json').open('xb') as out:
    out.write(raw)
record = {
    'retainedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'scopeId': scope['id'], 'url': scope['html_url'],
    'rawApiSha256': hashlib.sha256(raw).hexdigest(),
    'scopeIsSourceApproval': False, 'productionMutations': 0,
    'yyEntryDecision': 'PENDING_ACTUAL_ANSWER_NEVER_INFERRED',
    'nativeObserved': 'Scope and waiting-on-YY checklist read; composer empty; no card answered',
    'originalProofFilesMustRemainByteIdentical': 31,
    'failedProductionRoot': '/opt/lims/releases/instrument-import-release-959d17e1-20261012T161000Z',
    'failedProductionReceiptSha256': '2a03e66071406c58b754d9c63ed8200373c55a0433c2d1ad1cbdc2836d72499e',
    'requiredProductionOnlyChange': 'Hash-bound frozen subdirectory and exhaustive disjoint output paths checked before any live mutation',
}
with (d / 'pr294-forward-scope-6131470499-record.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
prefix = f'''PR294 forward-fix scope confirmed; YY entry decision pending {record['retainedUtc']}

Claudio's actual #162 comment 6131470499 at 19:48:31 UTC confirms the four output/frozen-evidence path collisions. His scope is retained as raw API evidence; it is NOT a Source review: PASS. The original failed 161000Z root, consumed gate, receipt and DRY container remain sealed and permanently excluded from replay, retry or reuse.

LIMS remains in maintenance with the original 51f/d4eb container stopped and jobs held. The 19:45 read-only verification proves the live DB/WAL/SHM bytes and attributes, stopped backup, 62 frozen files and original 144000Z PASSED proof unchanged. DRY made zero changes; APPLY and default startup never began.

Claudio has asked YY in the native thread whether to restore unchanged service or stay held. No actual answer is recorded. NOTHING in production changes until YY's own answer is verified. Never answer the card or infer approval from standing go. The same writer continues independent production-only correction and local validation: keep all 31 approved proof files byte-identical; separate frozen evidence from every execution output; check exhaustive output-path disjointness and absence in freeze, gate and pre-quiesce preflight; run the real production install_once path locally with stubbed CLI/seals and all 62 frozen names.

The original 144000Z PASS and 135400Z build remain the only proof/build authority. The selected entry state must be explicitly bound after YY's answer. Then require a NEW production-source review, ONE distinct unused kit, NEW exact-kit review, ONE fresh gate and separately audited forward deployment. No restore, older-image start, installer replay, cleanup, heap override or weakening of row/schema/disk/memory/timing guards. Other application merges remain held until #200 is live and Claudio actually postchecks it. Human checkout, drafts and cards remain untouched.

Previous checkpoint follows:

'''
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']:
    path = w / relative
    path.write_bytes(prefix.encode('utf-8') + path.read_bytes())
print(json.dumps(record, indent=2))
