"""Read-only upstream evidence for the owned copy. Never syncs or mutates it.

Each page is discarded after its ids and payload digest are recorded. No token
or submission content is serialized. Errors deliberately omit request URLs,
headers and response bodies. Redirects refuse credential transmission.
"""
import contextlib
import time
import datetime
import hashlib
import json
import pathlib
import sqlite3
import urllib.error
import urllib.parse
import urllib.request

MAX_PAGE_BYTES = 32 * 1024 * 1024
MAX_PAGES = 100


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('Upstream redirect refused')


def capture(database, config_ids, since_by_config=None,deadline_seconds=180,progress=None):
    deadline=time.monotonic()+deadline_seconds
    def tick():
        if time.monotonic()>=deadline:raise RuntimeError('Bounded read-only upstream capture deadline')
        if progress is not None:progress()
    path = pathlib.Path(database).resolve()
    wal = pathlib.Path(str(path) + '-wal')
    if wal.exists() and wal.stat().st_size:
        raise RuntimeError('Readonly upstream evidence requires a consistent backup without WAL')
    uri = path.as_uri() + '?mode=ro&immutable=1'
    with contextlib.closing(sqlite3.connect(uri, uri=True)) as db:
        db.row_factory = sqlite3.Row
        db.execute('BEGIN')
        configs = {row['id']: dict(row) for row in db.execute('SELECT * FROM KoboConfig')}
    opener = urllib.request.build_opener(NoRedirect())
    captured = {}
    for config_id in config_ids:
        config = configs[config_id]
        if not config['isActive'] or not config['projectCode']:
            raise RuntimeError('Require an existing active mapped config')
        source = config['koboServerUrl']
        parsed = urllib.parse.urlsplit(source)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
            raise RuntimeError('Require the configured HTTPS Kobo origin')
        since = (since_by_config or {}).get(config_id, config['lastSubmissionId'])
        if since is not None and not str(since).isdigit():
            raise RuntimeError('Require the actual numeric cursor')
        record = {'configId': config_id, 'labId': config['labId'], 'projectCode': config['projectCode'],
            'sourceIdentitySha256': hashlib.sha256(json.dumps([source, config['formId']]).encode()).hexdigest(),
            'since': since, 'startedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'pages': [], 'submissionIds': []}
        seen = set()
        for page in range(MAX_PAGES):
            tick()
            params = {'limit': 1000, 'start': page * 1000}
            if since:
                params['query'] = json.dumps({'_id': {'$gt': int(since)}}, separators=(',', ':'))
            url = source.rstrip('/') + '/api/v2/assets/' + urllib.parse.quote(config['formId'], safe='') + '/data.json?'
            url += urllib.parse.urlencode(params)
            request = urllib.request.Request(url, headers={'Authorization': 'Token ' + config['apiToken']}, method='GET')
            try:
                with opener.open(request, timeout=min(30,max(1,deadline-time.monotonic()))) as response:
                    data = response.read(MAX_PAGE_BYTES + 1)
                    if len(data) > MAX_PAGE_BYTES:
                        raise RuntimeError('Readonly fetch page exceeded evidence bound')
                    payload = json.loads(data)
            except urllib.error.HTTPError as error:
                raise RuntimeError('Readonly Kobo GET failed with HTTP ' + str(error.code)) from None
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
                raise RuntimeError('Readonly Kobo GET failed; no request credentials disclosed') from None
            tick()
            results = payload.get('results', [])
            if not isinstance(results, list) or len(results) > 1000:
                raise RuntimeError('Unexpected upstream page shape')
            ids = [str(row.get('_id', '')) for row in results]
            if any(not value.isdigit() for value in ids) or len(set(ids)) != len(ids) or seen.intersection(ids):
                raise RuntimeError('Missing or duplicate upstream submission identity')
            if since and any(int(value) <= int(since) for value in ids):
                raise RuntimeError('Upstream ignored actual cursor')
            seen.update(ids)
            record['pages'].append({'start': page * 1000, 'count': len(ids), 'bytes': len(data),
                'payloadSha256': hashlib.sha256(data).hexdigest(), 'submissionIds': ids})
            if len(results) < 1000 or not payload.get('next'):
                break
        else:
            raise RuntimeError('Readonly upstream evidence page bound exceeded')
        record['submissionIds'] = sorted(seen, key=int)
        record['completedUtc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        captured[config_id] = record
    return captured
