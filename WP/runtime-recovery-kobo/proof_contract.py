"""Pure guards for a NEW bounded scheduler proof; no host or database actions."""
import datetime
import re

BASE_HEAD = 'ae64f169e56e7677a920a3b60a7b1fe0dbfa4ccf'
AUDITED_PR_HEAD = 'cb79d89bfd104466ab7d29a83312dbc7bb48b7a0'
LIMIT = 805306368
FLOOR = 10556150894
SOAK_SECONDS = 660
TARGET_CONFIG = '897c1fb0-d83c-40cd-b513-b3e6e6b78172'
TARGET_LAB = 'ZMB-LAB1'
TARGET_PROJECT = 'SOILFER-US'
REFUSAL_SCOPE_COMMENT_ID = 6113601584
REFUSAL_POLICY = 'EXACT_FRESH_COPY_CONFIG_REFUSALS'
CARDINALITY_POLICY = 'SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS'
REFUSAL_PAIRING_SCOPE_COMMENT_ID = 6114143349
REFUSAL_PAIRING_POLICY = 'STREAM_ORDER_ONE_TO_ONE'
REFUSAL_PAIR_WINDOW_SECONDS = 1
REFUSAL_TUPLES = [
    ('ec5a5a67-3f5a-4682-88df-edb0e07e6485', 'MOZ-LAB1', 'MOZL',
        "[KOBO] Configured project 'MOZL' does not exist in the database."),
    ('f24b4f7a-1da7-4320-831e-b9105647f106', 'TUR', 'TEST-TURSAP',
        "LAB_INACTIVE: Laboratory 'TURSAP LAB' is inactive. Intake disallowed."),
    ('a9fc2329-cdfc-408e-aeb2-fa1a9020e66d', 'TUR', 'TEST3',
        "LAB_INACTIVE: Laboratory 'TURSAP LAB' is inactive. Intake disallowed."),
    ('edfc27ed-adfe-44f8-8ef6-f159f3ba2fc0', 'TUR', 'TURSAP8',
        "LAB_INACTIVE: Laboratory 'TURSAP LAB' is inactive. Intake disallowed.")]


def require(value, message):
    if not value:
        raise RuntimeError(message)


def utc_seconds(value):
    # Docker retains nanoseconds; host Python accepts microseconds. Preserve
    # the original timestamp in evidence and truncate only the comparison's
    # sub-microsecond portion, never change the scheduler's clock.
    normalized = value.replace('Z', '+00:00')
    normalized = re.sub(r'(\d\d:\d\d:\d\d)\.(\d+)([+-]\d\d:\d\d)$',
        lambda match: match[1] + '.' + match[2][:6].ljust(6, '0') + match[3], normalized)
    instant = datetime.datetime.fromisoformat(normalized)
    require(instant.tzinfo is not None, 'Require an explicit UTC offset')
    return instant.timestamp()


def validate_candidate(pin, built, image):
    require(re.fullmatch(r'[a-f0-9]{40}', pin.get('head', '')), 'Invalid exact application head')
    require(pin['head'] != BASE_HEAD and pin.get('baseHead') == BASE_HEAD,
        'Only a new forward candidate based on the deployed head')
    require(pin.get('auditedPrHead') == AUDITED_PR_HEAD and pin.get('pr') == 292,
        'Unreviewed PR candidate')
    require(pin.get('auditReviewId') and pin.get('mainCiRunId'), 'Audit and main CI evidence missing')
    require(pin.get('labAndHubBuildsOwnedByYY') is True and
        pin.get('releaseWindowControl') == 'RELEASE_DAY_DISK_ABORTS_ACCEPTED', 'Workload pins missing')
    require(built.get('status') == 'BUILT_ONLY_NOT_DEPLOYED' and built.get('head') == pin['head'],
        'Require a valid exact-head build')
    require(image['Id'] == pin['image'] == built['image'], 'Candidate image digest mismatch')
    require(image['Size'] == pin['imageBytes'] == built['imageBytes'] and image['Size'] > 0,
        'Candidate image size mismatch')
    require(image['Config']['Labels'].get('org.opencontainers.image.revision') == pin['head'],
        'Candidate image revision mismatch')
    require(pin['tree'] == pin['auditedTree'], 'Merged tree differs from the audited tree')
    require(built.get('productionDatabaseMounts') == 0, 'Build had a production data mount')


def source_review_pass(review, tooling, coordinator_sha, guard_sha, now=None,
                       verifier_sha=None, contract_sha=None, baseline_guard_sha=None, stream_pairing=False):
    """A NEW measurement source needs its own explicit exact-byte approval."""
    require(review['id'] != 6112725472 and review['html_url'] ==
        'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(review['id']),
        'New proof-source review missing')
    tokens = ['Source review: PASS', tooling, coordinator_sha, guard_sha,
        'f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169',
        'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
        'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED']
    if verifier_sha is not None or contract_sha is not None:
        require(verifier_sha is not None and contract_sha is not None, 'Both corrected helper bindings required')
        tokens += [verifier_sha, contract_sha, 'refusalScopeCommentId=6113601584',
            REFUSAL_POLICY, CARDINALITY_POLICY]
    if baseline_guard_sha is not None:
        require(verifier_sha is not None and contract_sha is not None, 'Baseline guard requires all corrected bindings')
        tokens += [baseline_guard_sha,
            'baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE',
            'BASELINE_ATTEMPTS_MAX=3', 'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10']
    if stream_pairing:
        require(verifier_sha is not None and contract_sha is not None and baseline_guard_sha is not None,
            'Stream pairing requires all corrected helper bindings')
        tokens += ['refusalPairingScopeCommentId=' + str(REFUSAL_PAIRING_SCOPE_COMMENT_ID),
            'schedulerRefusalPairing=' + REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS=1']
    require(all(value in review['body'] for value in tokens), 'Exact corrected source approval missing')
    now = now or datetime.datetime.now(datetime.timezone.utc)
    require(utc_seconds(review['created_at']) <= now.timestamp(), 'Source review is future-dated')


def expected_refusals(configs, labs, projects):
    """Bind the whole allowance or none, using only the fresh sealed baseline."""
    active = [row for row in configs if row['isActive']]
    for config_id, lab_id, project, _ in REFUSAL_TUPLES:
        rows = [row for row in active if row['id'] == config_id]
        if len(rows) != 1 or rows[0]['labId'] != lab_id or rows[0]['projectCode'] != project:
            return []
        if len([row for row in active if row['labId'] == lab_id and row['projectCode'] == project]) != 1:
            return []
    if any(row['code'] == 'MOZL' for row in projects):
        return []
    moz = [row for row in labs if row['id'] == 'MOZ-LAB1' or row['code'] == 'MOZ-LAB1']
    tur = [row for row in labs if row['id'] == 'TUR' or row['code'] == 'TUR']
    if len(moz) != 1 or not moz[0]['isActive'] or len(tur) != 1 or tur[0]['isActive'] or tur[0]['name'] != 'TURSAP LAB':
        return []
    if {row['id'] for row in active if row['labId'] == 'TUR'} != {row[0] for row in REFUSAL_TUPLES if row[1] == 'TUR'}:
        return []
    return [{'configId': key, 'labId': lab, 'projectCode': project, 'message': message}
        for key, lab, project, message in REFUSAL_TUPLES]


def docker_stamp_ns(stamp):
    """Keep nanosecond comparisons exact at the inclusive one-second bound."""
    match = re.fullmatch(r'(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z', stamp)
    require(match is not None, 'Invalid Docker UTC timestamp')
    base = datetime.datetime.fromisoformat(match[1] + '+00:00')
    return int(base.timestamp()) * 1000000000 + int((match[2] or '').ljust(9, '0'))


def scheduler_refusals(stdout, stderr, expected):
    """Pair exact config refusals in each stream's order, never sorted stamps.

    Docker independently timestamps stdout and stderr. A signed skew up to
    one second is allowed only for the one-to-one exact fresh-bound pairs.
    Only a bounded trailing trigger suffix may still be in flight.
    """
    triggers, errors = {}, []
    for stream, log in [('stdout', stdout), ('stderr', stderr)]:
        for index, line in enumerate(log.splitlines(), 1):
            stamp, separator, message = line.partition(' ')
            if 'FATAL ERROR' in line or '[KOBO_SCHEDULER] General scheduler error' in line:
                raise RuntimeError('Owned scheduler/runtime error; retain this failed proof')
            trigger_line = '[KOBO_SCHEDULER] Triggering scheduled sync' in line
            error_line = '[KOBO_SCHEDULER] Error syncing' in line
            if not trigger_line and not error_line:
                continue
            require(separator and re.fullmatch(r'\d{4}-\d\d-\d\dT\S+Z', stamp),
                'Untimestamped scheduler trigger or error')
            ns = docker_stamp_ns(stamp)
            if trigger_line:
                require(stream == 'stdout', 'Scheduler trigger is in the wrong stream')
                trigger = re.fullmatch(r'\[KOBO_SCHEDULER\] Triggering scheduled sync for Lab: ([^,]+), Project: (.+)', message)
                require(trigger is not None, 'Unexpected scheduler trigger line')
                matches = [row for row in expected if (row['labId'], row['projectCode']) == trigger.groups()]
                if matches:
                    require(len(matches) == 1, 'Ambiguous bound scheduler trigger')
                    triggers.setdefault(trigger[1], []).append((stamp, ns, index, line, matches[0]))
            if error_line:
                require(stream == 'stderr', 'Scheduler refusal is in the wrong stream')
                error = re.fullmatch(r'\[KOBO_SCHEDULER\] Error syncing lab ([^:]+): (.+)', message)
                require(error is not None, 'Unexpected scheduler error line')
                require(any(row['labId'] == error[1] and row['message'] == error[2] for row in expected),
                    'Unexpected scheduler error message or lab')
                errors.append((stamp, ns, index, line, message, error[1], error[2]))
    consumed, observed = {}, []
    for stamp, ns, index, raw, message, lab, error_message in errors:
        count = consumed.get(lab, 0)
        queue = triggers.get(lab, [])
        require(count < len(queue), 'Scheduler refusal has no exact bound trigger')
        trigger_stamp, trigger_ns, trigger_index, trigger_raw, row = queue[count]
        require(error_message == row['message'], 'Unexpected scheduler error message')
        delta = ns - trigger_ns
        require(abs(delta) <= REFUSAL_PAIR_WINDOW_SECONDS * 1000000000,
            'Scheduler refusal pair exceeds the one-second window')
        consumed[lab] = count + 1
        observed.append({**row, 'utc': stamp, 'triggerUtc': trigger_stamp, 'text': message,
            'triggerRawLine': trigger_raw, 'errorRawLine': raw,
            'stdoutLineIndex': trigger_index, 'stderrLineIndex': index,
            'signedDeltaSeconds': delta / 1000000000})
    for lab, queue in triggers.items():
        bound_count = len([row for row in expected if row['labId'] == lab])
        require(len(queue) - consumed.get(lab, 0) <= bound_count,
            'Too many trailing in-flight scheduler triggers')
    return observed


def intake_summary(state, completion, config_id=TARGET_CONFIG):
    count = state['newSampleCount'][config_id]
    pairs = state['newSamplePairs'][config_id]
    ids = state['newSubmissionIds'].get(config_id, [])
    require(count == completion['newSamples'] == len(pairs), 'Scheduler count differs from sealed Sample rows')
    require(sum(state['newSampleDepthSplit'][config_id].values()) == count, 'Depth split differs from Sample count')
    return {'newSamples': completion['newSamples'], 'skipped': completion['skipped'],
        'distinctSubmissionCount': len(ids), 'newSampleCount': count,
        'depthSplit': state['newSampleDepthSplit'][config_id]}


def completed_syncs(log, lab=TARGET_LAB):
    """Parse only observed completion headers and numeric fields, never JS eval.

    Node prints its result object over multiple timestamped lines. A header is
    evidence of the awaited sync returning; newSamples/skipped must also exist.
    Raw messages and submission payloads are deliberately not returned.
    """
    lines = []
    for line in log.splitlines():
        stamp, separator, message = line.partition(' ')
        if separator and re.fullmatch(r'\d{4}-\d\d-\d\dT\S+Z', stamp):
            lines.append((stamp, message))
    records = []
    header = '[KOBO_SCHEDULER] Completed sync for ' + lab + ':'
    for index, (stamp, message) in enumerate(lines):
        if not message.startswith(header):
            continue
        following = [message[len(header):]]
        for _, next_message in lines[index + 1:index + 200]:
            if next_message.startswith('['):
                break
            following.append(next_message)
            if next_message.strip() == '}':
                break
        body = '\n'.join(following)
        new = re.search(r'\bnewSamples:\s*(\d+)\s*[,}]', body)
        skipped = re.search(r'\bskipped:\s*(\d+)\s*[,}]', body)
        require(new is not None and skipped is not None, 'Incomplete scheduler completion record')
        records.append({'utc': stamp, 'epochSeconds': utc_seconds(stamp),
            'labId': lab, 'newSamples': int(new.group(1)), 'skipped': int(skipped.group(1))})
    return records


def observation_end(first_completion, ready_utc, interval_minutes):
    require(isinstance(interval_minutes, (int, float)) and 0 < interval_minutes <= 60,
        'Configured interval outside this proof deadline; do not change it')
    return max(utc_seconds(first_completion) + (interval_minutes + 2) * 60,
        utc_seconds(ready_utc) + SOAK_SECONDS)


def require_final_observation(first, second, ready_utc, finished_utc, interval_minutes,
                              restart_count, peak, healthy_seconds):
    end = observation_end(first['utc'], ready_utc, interval_minutes)
    require(second['epochSeconds'] > first['epochSeconds'] and
        second['epochSeconds'] >= first['epochSeconds'] + interval_minutes * 60,
        'Second sync did not occur naturally after the configured interval')
    require(utc_seconds(finished_utc) >= end, 'Observation ended before interval plus two minutes')
    require(restart_count == 0 and 0 < peak <= LIMIT, 'Restart or memory-limit refusal')
    require(healthy_seconds >= SOAK_SECONDS, 'Healthy soak too short')
