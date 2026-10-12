import datetime
import hashlib
import json
import pathlib

root = pathlib.Path(__file__).resolve().parents[2]
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
record = {'updatedUtc': stamp, 'applicationHead': 'c26591698c1e974a3bf771e5c333578755aef315',
    'tree': '9b3b77496c3aa2cdad7c7594a0b258ec4b491753', 'draft': False,
    'ciRun': 38224227228, 'ciStatus': 'SUCCESS', 'ciCompletedUtc': '2026-10-12T09:09:17Z',
    'fullSuites': 360, 'fullTests': 5473, 'fullSeconds': 1673.574, 'realDockerGatesPassed': True,
    'readyCommentId': 6121215409, 'formalAudit': 'PENDING',
    'sourceCommit': '62851828f9ed4744364f3e434c10a091122b6b83',
    'sourceGuardWindows': 121, 'sourceGuardLinux': 121,
    'sourceAuthority': 'UNREVIEWED_UNMERGED_REFUSE', 'productionMutations': 0}
names = ['ci-c2659169-success.log', 'ci-c2659169-success-run.json',
    'import-authority-windows-0910.stdout.log', 'import-authority-windows-0910.stderr.log',
    'import-authority-linux-0910.stdout.log', 'import-authority-linux-0910.stderr.log']
record['evidenceHashes'] = {name: hashlib.sha256((root / 'WP/pr284-resume-20261012' / name).read_bytes()).hexdigest()
    for name in names}
note = ('PR284 audit-ready checkpoint ' + stamp + ': application c26591698c1e974a3bf771e5c333578755aef315 '
    '/tree9b3b77496c3aa2cdad7c7594a0b258ec4b491753 unchanged. Exact CI38224227228 SUCCESS09:09:17UTC, '
    '360/360suites5473/5473tests1673.574s/client/both actual Docker builds/boundary/readiness acceptance. Existing '
    'PR284 marked ready and claude ready for audit posted6121215409. Native boundary read: Claudio actually '
    'acknowledged CIgreen and ready comment; own final Linux full64/360with0failures at capture, formal audit '
    'PENDING. Windows full61602 remains INCOMPLETE C0000409; diagnostic52/52 and focused8/146PASS; no Windows '
    'full-pass claim. No app edits or another test run. Proposed source62851828 passes121/121Windows and121/121 '
    'exact-source Linux guards,0failures/errors/skips/no production DB access; initial harness errors retained. '
    'New build/proof/source contract deliberately UNREVIEWED/UNMERGED_REFUSE. Production packaging source still '
    'being prepared. No #200 build/proof/kit/gate/production action or cleanup/cards; completed PR293 untouched.\n\n'
    'Previous checkpoint follows:\n\n')
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = root / name
    path.write_text(note + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
old = root / 'WP/pr284-resume-20261012/pr284-description-draft-c2659169.txt'
body = old.read_text(encoding='utf-8').replace('Validation: DRAFT, final full validation in progress.',
    'Validation: ready for exact-head audit; final CI is green.')
body = body.replace('Claudio is running the final full suite on Linux; exact CI38224227228 is still running. No final-green claim yet.',
    'Claudio is running his independent final full suite on Linux. Exact CI38224227228 completed SUCCESS09:09:17UTC:360/360suites5473/5473tests1673.574s, client build, both actual Docker builds, disposable boundary rehearsal and real readiness acceptance. Formal exact-head audit remains pending.')
(root / 'WP/pr284-resume-20261012/pr284-description-ready-c2659169.txt').write_text(body, encoding='utf-8', newline='\n')
(root / 'WP/pr284-resume-20261012/checkpoint-0912.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps(record, indent=2))
