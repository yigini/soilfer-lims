"""Retain raw review/CI evidence and prepend a documentation checkpoint only."""
import datetime
import hashlib
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent


def github(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', endpoint], encoding='utf-8'))


def save(name, value):
    raw = (json.dumps(value, indent=2) + '\n').encode()
    with (ROOT / name).open('xb') as output:
        output.write(raw)
    return hashlib.sha256(raw).hexdigest()


def main():
    observed = datetime.datetime.now(datetime.timezone.utc).isoformat()
    run = github('repos/yigini/soilfer-lims/actions/runs/38233444989')
    jobs = github('repos/yigini/soilfer-lims/actions/runs/38233444989/jobs')
    assert run['head_sha'] == '5dd5488d138514351fffd54d0b0232ae19fcb64d'
    assert run['status'] == 'completed' and run['conclusion'] == 'success'
    assert all(row['conclusion'] == 'success' for row in jobs['jobs'])
    log = subprocess.check_output(['gh', 'run', 'view', '38233444989', '--repo', 'yigini/soilfer-lims', '--log'])
    with (ROOT / 'main-ci-38233444989.log').open('xb') as output:
        output.write(log)
    summary = [line for line in log.decode('utf-8').splitlines()
        if re.search(r'(Test Suites:|Tests:|Time:)', line)]
    evidence = {'observedUtc': observed, 'run': run, 'jobs': jobs,
        'logSha256': hashlib.sha256(log).hexdigest(), 'testSummary': summary,
        'nativeDelivery': {'requestId': 6122535364,
            'verifiedUtcMinute': '2026-10-12T10:40Z',
            'thread': 'LIMS Audit / Lab workflow audit and plan',
            'actualAcknowledgement': 'Got it: reviewing revised source f5e59428 now, starting with the diff from 70fd and the dry-run fix.',
            'composerEmptyAfterDelivery': True, 'humanCardsAnswered': False},
        'sourcePassClaimed': False, 'productionMutations': 0}
    digest = save('main-ci-and-source-delivery-1042.json', evidence)
    checkpoint = (
        f'PR284 revised WAL source checkpoint {observed}: currentmain5dd5488d138514351fffd54d0b0232ae19fcb64d/'
        'tree9b3b77496c3aa2cdad7c7594a0b258ec4b491753 remains the exact audited PR284 merge; '
        'applicationPASS6121933894 unchanged. MainCI38233444989 now SUCCESS at10:37:52UTC, '
        'including full server/client/both real Docker/boundary/readiness gates; raw run/jobs/log retained. '
        'Old proposed70fd was explicitly CHANGES_REQUIRED6122256443 and NEVER executed. '
        'NEW revised sourcef5e59428c1bbf19247db2555f5158bc3a2ac5fad passes164/164Windows and164/164Linux '
        'guards0failure/error/skip/no productionDBaccess; all raw failures/intermediates retained. '
        'Option(a) separate owned0400 dry copy leaves original backup/apply physical triple untouched; '
        'actual WAL-header real-mount witness passed10:30:32UTC atad49 with current adapter/guard bytes identical. '
        'Explicit jobs-ON boundary, CLI memory=swap805306368/networknone/600s, 13 retainedDBallocations, '
        '31proof source/assets39production sources60frozenfiles. New source request162/6122535364 '
        'posted10:35:04UTC/native delivered and actual Cl acknowledgement verified10:40UTC; '
        'ACTUAL NEW Source review: PASS remains PENDING. Flat rawGitf5e export compiled only, no build/proof '
        'started. Production proof binding is UNREVIEWED_REFUSE/0 and cannot freeze. Fresh read-only live '
        '10:14:52UTC healthy51f/d4eb0restarts/same volumes/HTTPS200/originalreceipt480f and41files unchanged/'
        'free90747678720B. No #200 installer/kit/gate/productionmutation/cleanup/cards, no test/PTY/writer. '
        'SAME writer continues actual source approval -> ONE new build/proof -> separate production-source '
        'approval -> stopped originalPASS frozenkit/exactreview/onefreshgate/forwarddeploy. Other app merges '
        'held until#200live/postchecked; completedPR293 and all originals/human checkout/drafts retained. '
        f'Evidence main-ci-and-source-delivery-1042.json SHA256{digest}.')
    for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md',
            'WP/pr284-release/README.md']:
        path = ROOT.parent.parent / relative
        old = path.read_bytes()
        assert not old.startswith(checkpoint.encode())
        path.write_bytes((checkpoint + '\r\n\r\nPrevious checkpoint follows:\r\n\r\n').encode() + old)
    print(json.dumps({'observedUtc': observed, 'mainCi': run['conclusion'],
        'testSummary': summary, 'evidenceSha256': digest, 'sourcePassClaimed': False}))


if __name__ == '__main__':
    main()
