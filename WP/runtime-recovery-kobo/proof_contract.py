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


def require(value, message):
    if not value:
        raise RuntimeError(message)


def utc_seconds(value):
    instant = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
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
