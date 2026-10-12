"""Proposed #200 startup evidence checks; import performs no host operations.

The historical readiness, state, disk, zero-write and probe helpers remain
unchanged. This new module checks the one additional entrypoint verifier and
READY event after the separately verified native installation delta.
"""
import json

from import_preservation import SOURCES, require

LEGACY_READY_EVENTS = ['WORKFLOW', 'RESULT_ATTEMPT', 'SAMPLE_HOLD', 'REFERENCE',
    'QC_RULE', 'QC_RUN', 'QC_GATE_SCOPE', 'PT', 'NCR', 'RESULT_EQUIPMENT',
    'WORK_ATTEMPT', 'WORK_REPEAT', 'REPORTED_VALUE', 'REAGENT_LOT',
    'RESULT_OVERRIDE', 'CALCULATION', 'CROSS_CHECK', 'AMENDMENT',
    'REPORT_REVISION', 'BENCH_CREDENTIAL', 'PREPARATION_RECORD']
READY_EVENTS = LEGACY_READY_EVENTS + ['INSTRUMENT_IMPORT']
ENTRYPOINT_VERIFIER_COUNT = 23


def zero_changes(value):
    return type(value.get('totalChanges')) is int and value['totalChanges'] == 0


def empty_counts(value):
    counts = value.get('counts', {})
    return set(counts) == {'templates', 'receipts', 'draftLinks'} and all(
        type(number) is int and number == 0 for number in counts.values())


def import_zero(value):
    require(value.get('classification') == 'COMPLETE_200' and value.get('sources') == SOURCES,
        'Import READY schema/source authority differs')
    require(empty_counts(value),
        'Import startup has unexpected data')
    require(zero_changes(value), 'Import startup wrote changes')


def ready_logs(log):
    events = []
    for line in log.splitlines():
        try:
            value = json.loads(line)
        except ValueError:
            continue
        if isinstance(value, dict) and str(value.get('event', '')).endswith('_STARTUP_READY'):
            require(zero_changes(value), 'Startup READY wrote or omitted its changes')
            events.append(value)
    require([event['event'] for event in events] == [prefix + '_STARTUP_READY' for prefix in READY_EVENTS],
        'Missing or out-of-order startup READY events')
    import_zero(events[-1])
    return events


def entrypoint_zero(log):
    require(log.count('Starting SoilFER-LIMS...') == 1, 'Require one default entrypoint start')
    entry = log.split('Starting SoilFER-LIMS...')[0]
    decoder, values, offset = json.JSONDecoder(), [], 0
    while offset < len(entry):
        begin = entry.find('{', offset)
        if begin < 0:
            break
        try:
            value, length = decoder.raw_decode(entry[begin:])
            offset = begin + length
        except ValueError:
            offset = begin + 1
            continue
        if isinstance(value, dict) and 'totalChanges' in value:
            values.append(value)
    require(len(values) == ENTRYPOINT_VERIFIER_COUNT and
        all(value.get('mode') == 'NO_OP' and zero_changes(value) for value in values),
        'Default entrypoint must have exactly 23 NO_OP/0 verifiers')
    import_zero(values[-1])
    return [{'classification': value['classification'], 'mode': value['mode'],
        'totalChanges': value['totalChanges']} for value in values]


def startup_checks(root, name, database, expected, stage, common, support, jobs_guard=None):
    # Only an independently reviewed coordinator may call this adapter. Every
    # host operation stays in the exact-byte-bound historical helper supplied
    # in its frozen source index, and full expected state is checked unchanged.
    result = support.command(root, ['docker', 'logs', name], stage + '-startup')
    log = result.stdout + '\n' + result.stderr
    ready, entry = ready_logs(log), entrypoint_zero(log)
    memory = support.command(root, ['docker', 'exec', name, 'node', '-e',
        "console.log(Number(require('node:fs').readFileSync('/sys/fs/cgroup/memory.peak','utf8')))"], stage + '-memory')
    peak = int(memory.stdout.strip())
    require(0 < peak <= 805306368, 'Startup peak exceeds 768MiB')
    if jobs_guard is None:
        common.exact_state(database, expected)
    boundary = jobs_guard.verify() if isinstance(jobs_guard, common.OwnedJobsWatch) else None
    return {'startupReady': ready, 'entrypointInstallers': entry, 'startupChanges': 0,
        'ownedJobsBoundary': boundary, 'startupMemory': {'peakBytes': peak,
        'limitBytes': 805306368, 'nodeOptions': None}}
