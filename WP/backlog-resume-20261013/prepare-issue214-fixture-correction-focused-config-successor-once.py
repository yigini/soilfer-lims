"""Preserve the pre-test configuration refusal and prepare its unique successor."""
import datetime, hashlib, json
from pathlib import Path
wp = Path(__file__).parent
refused = wp / 'issue214-fixture-correction-focused'
assert refused.is_dir() and not (refused / 'stdout-original.log').exists() and not (refused / 'report-original.json').exists()
record = refused / 'pre-test-refusal-boundary.json'
assert not record.exists()
configRaw = (refused / 'config-original.json').read_bytes()
config = json.loads(configRaw[configRaw.index(b'{'):])
assert config['globalConfig']['workerIdleMemoryLimit'] == 512000000
record.write_bytes((json.dumps({'observedUtc': datetime.datetime.now(datetime.UTC).isoformat(),
    'status': 'REFUSED_BEFORE_TEST_EXECUTION', 'helperExitCode': 1,
    'reason': 'Helper checked configs[0].workerIdleMemoryLimit; the actual setting is globalConfig.workerIdleMemoryLimit.',
    'actualWorkerIdleMemoryLimit': 512000000, 'testRunnerStarted': False, 'productionOperations': 0,
    'helperSha256': hashlib.sha256((wp / 'verify-issue214-fixture-correction-focused-once.py').read_bytes()).hexdigest()}, indent=2) + '\n').encode())
source = (wp / 'verify-issue214-fixture-correction-focused-once.py').read_text(encoding='utf-8')
source = source.replace("dest = wp / 'issue214-fixture-correction-focused'", "dest = wp / 'issue214-fixture-correction-focused-config'")
old = "assert config['configs'][0]['workerIdleMemoryLimit'] == 512000000"
assert source.count(old) == 1
source = source.replace(old, "assert config['globalConfig']['workerIdleMemoryLimit'] == 512000000")
target = wp / 'verify-issue214-fixture-correction-focused-config-once.py'
assert not target.exists()
target.write_bytes(source.encode())
print('Original pre-test refusal retained; one unique corrected successor prepared.')
