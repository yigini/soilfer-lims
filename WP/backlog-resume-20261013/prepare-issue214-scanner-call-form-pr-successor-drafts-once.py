"""Prepare unique unused successors; do not execute any superseded draft.

This prepares artifacts while the source is frozen. Full PASS, source-ref and
PR-creation actions remain guarded and sequential after actual run completion.
"""
import ast,datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip()
assert head=='519262ea8628e9a036bf9ace563984df336415e8'
assert not (wp/'issue214-scanner-call-form-full/summary.json').exists()
frozen=json.loads((wp/'issue214-scanner-call-form-full/source-before.json').read_bytes())
assert len(frozen)==415 and all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in frozen.items())
names=['retain-issue214-scanner-call-form-full-pass-once.py',
       'prepare-issue214-scanner-call-form-source-only-review-once.py',
       'create-issue214-scanner-call-form-source-pr-once.py']
dest=wp/'issue214-scanner-call-form-pr-successor-drafts'
assert not dest.exists() and all(not (wp/name).exists() for name in names)
retainer=(wp/'retain-issue214-full-fixture-corrected-pass-once.py').read_text(encoding='utf-8')
retainer=retainer.replace('issue214-full-fixture-corrected','issue214-scanner-call-form-full')
retainer=retainer.replace('507d8ed9d6343b4f20ad15ae37dcd04b650ccc60',head).replace('sessionId\':99113','sessionId\':65892')
review=(wp/'prepare-issue214-source-only-review-once.py').read_text(encoding='utf-8')
review=review.replace('issue214-full-fixture-corrected','issue214-scanner-call-form-full')
review=review.replace('issue214-source-only-review','issue214-scanner-call-form-source-only-review')
creator=(wp/'create-issue214-source-pr-once.py').read_text(encoding='utf-8')
creator=creator.replace('issue214-full-fixture-corrected','issue214-scanner-call-form-full')
creator=creator.replace('issue214-source-only-review','issue214-scanner-call-form-source-only-review')
creator=creator.replace('issue214-source-pr-created','issue214-scanner-call-form-source-pr-created')
creator=creator.replace('Corrected focused run: 12/12 suites and 175/175 tests pass',
                        'Corrected focused run: 14/14 suites and 293/293 tests pass')
needle='Original Native and compatibility assertions are unchanged.'
assert creator.count(needle)==1
creator=creator.replace(needle,needle+' The compatibility Native fixture is the only newly registered caller of the existing digest-pinned owned-file calculation prerequisite helper. Its destructured import, immutable direct call and owned-file identifier satisfy the existing scanner predicates; no predicate or runtime writer exemption is relaxed. The prior complete full run remains FAILED (364/365 suites,5546/5547 tests,one scanner finding), and the first registration-only focused run remains FAILED (13/14 suites,292/293 tests). Both closed originals are retained in the evidence directory.')
dest.mkdir()
record={'preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'auditSource':head,
        'activeFullSession':65892,'status':'PREPARED_ONLY_NOT_EXECUTED','productionOperations':0,'files':{}}
for name,source in zip(names,[retainer,review,creator]):
    ast.parse(source,filename=name);data=source.encode();(wp/name).write_bytes(data)
    record['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
(dest/'preparation-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
print(json.dumps(record))
