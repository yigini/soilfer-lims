import hashlib, json, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
target=root/'server/tests/fixtures/pre214-native-run-source.cjs'
assert not target.exists()
raw=subprocess.check_output(['git','show','1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a:server/services/qcNativeRunService.js'],cwd=root)
assert b'controlCharts' not in raw
target.parent.mkdir(exist_ok=True)
target.write_bytes(raw)
record={'sourceCommit':'1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a','sourcePath':'server/services/qcNativeRunService.js','fixturePath':target.relative_to(root).as_posix(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'purpose':'Genuine pre-release start on a disposable test-owned database; no editing historical criteria or production operation.'}
(Path(__file__).parent/'issue214-pre-release-start-fixture.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
print(json.dumps(record))
