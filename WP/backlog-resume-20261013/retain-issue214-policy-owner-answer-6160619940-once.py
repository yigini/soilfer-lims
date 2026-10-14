"""Retain the actual accepted scope once; no source or remote mutation."""
import datetime, hashlib, json, subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[2]
dest = Path(__file__).parent / 'issue214-policy-owner-answer-6160619940'
assert not dest.exists()
def run(args):
    result = subprocess.run(args, cwd=root, capture_output=True, check=True)
    return result.stdout
assert run(['git', 'branch', '--show-current']).strip() == b'audit/release-eb6de2e8'
raw = run(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6160619940'])
answer = json.loads(raw)
assert answer['id'] == 6160619940 and answer['issue_url'].endswith('/issues/214')
assert answer['performed_via_github_app']['slug'] == 'claude'
assert 'accepted inside PR296, with conditions.' in answer['body']
assert '**No automatic normalization.**' in answer['body']
pr = run(['gh', 'api', 'repos/yigini/soilfer-lims/pulls/296'])
assert json.loads(pr)['head']['sha'] == 'e47b842c2a7f6b4f06fa4c532f7460c01797821b'
dest.mkdir()
files = {'answer-original.json': raw, 'answer-original.md': answer['body'].encode('utf-8'), 'pr-before-original.json': pr}
for name, data in files.items(): (dest / name).write_bytes(data)
index = {name: {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in files.items()}
(dest / 'index.json').write_text(json.dumps({'retainedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'commentId': answer['id'], 'url': answer['html_url'], 'files': index, 'productionOperations': 0}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'commentId': answer['id'], 'scope': 'INSIDE_PR296_NO_NORMALIZATION', 'files': index}))
