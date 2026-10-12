"""Record the actual failed local validation, without changing any application file."""
import datetime
import hashlib
import json
from pathlib import Path
import re

here = Path(__file__).resolve().parent
path = here / 'native-workbench-full-5e65fe5b-1133.log'
raw = path.read_bytes()
text = raw.decode('utf-16' if raw.startswith(b'\xff\xfe') else 'utf-8-sig', errors='replace')
assert 'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory' in text
assert not (here / 'native-workbench-full-5e65fe5b-1133.result.json').exists()
config_path = here / 'native-workbench-sequential-worker-config-1156.json'
config_bytes = config_path.read_bytes()
config = json.loads(config_bytes.decode('utf-16' if config_bytes.startswith(b'\xff\xfe') else 'utf-8-sig'))
assert config['globalConfig']['maxWorkers'] == 1 and config['globalConfig']['workerIdleMemoryLimit'] == 512000000
assert config['globalConfig']['runInBand'] is False
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'head': '5e65fe5b587747efc717f167f9b61469effa9afe', 'session': 79434, 'sessionExitCode': 1,
    'status': 'FULL_LOCAL_VALIDATION_INCOMPLETE_NODE_DEFAULT_HEAP_EXHAUSTED_NOT_A_PASS',
    'logSha256': hashlib.sha256(raw).hexdigest(), 'jestResultFileProduced': False,
    'completedPassingSuites': len(re.findall(r'^PASS ', text, re.M)),
    'completedFailingSuites': len(re.findall(r'^FAIL ', text, re.M)),
    'nodeFatalError': 'Ineffective mark-compacts near heap limit; JavaScript heap out of memory',
    'replacementRunner': {'maxWorkers': 1, 'workerIdleMemoryLimitBytes': 512000000,
        'runInBand': False, 'applicationEdits': 0, 'heapLimitRaised': False,
        'singleSequentialTestChildRecycledBetweenSuites': True, 'fullTestInventory': 360,
        'normalGlobalAndSuiteHooksRetained': True, 'configSha256': hashlib.sha256(config_bytes).hexdigest()},
    'productionMutations': 0, 'failedProductionProofReplayed': False}
with (here / 'native-workbench-full-memory-failure-1156.json').open('x', encoding='utf-8') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps(record))
