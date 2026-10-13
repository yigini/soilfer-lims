"""Prepare one current-schema fixture successor after the closed predecessor failure."""
from pathlib import Path
wp = Path(__file__).parent
source = (wp / 'verify-issue214-fixture-correction-focused-config-once.py').read_text(encoding='utf-8')
old = "dest = wp / 'issue214-fixture-correction-focused-config'"
assert source.count(old) == 1
source = source.replace(old, "dest = wp / 'issue214-compatibility-prerequisite-corrected'")
source = source.replace("'failure': case['failureMessages'][:1]", "'failure': [message[:1800] for message in case['failureMessages'][:1]]")
target = wp / 'verify-issue214-compatibility-prerequisite-corrected-once.py'
assert not target.exists()
assert (wp / 'issue214-fixture-correction-closed-failure/index.json').is_file()
target.write_bytes(source.encode())
print('One unique 12-suite successor prepared with current Native fixture predecessors.')
