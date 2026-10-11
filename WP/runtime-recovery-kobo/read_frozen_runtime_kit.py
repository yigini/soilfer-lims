"""Download byte-exact frozen evidence read-only, without collecting a gate."""
import base64
import hashlib
import json
import pathlib
import subprocess
import sys
from runtime_release_contract import safe_root, require


def main():
    root, output = sys.argv[1:]; safe_root(root, 'runtime-kobo-release-')
    output = pathlib.Path(output); require(not output.exists(), 'Never overwrite a downloaded kit')
    payload = base64.b64encode(root.encode()).decode()
    code = '''import base64,hashlib,json,pathlib,sys
r=pathlib.Path(base64.b64decode(PAYLOAD).decode());sys.path.insert(0,str(r))
from runtime_release_contract import frozen_files
m=json.loads((r/'prepared-manifest.json').read_bytes());frozen_files(r,m)
assert not any((r/n).exists() for n in ['production-gate.json','execution-attempt.json','production-receipt.json'])
out={}
for name in list(m['files'])+['prepared-manifest.json']:
 data=(r/name).read_bytes();out[name]={'sha256':hashlib.sha256(data).hexdigest(),'mode':oct((r/name).stat().st_mode&0o777),
 'base64':base64.b64encode(data).decode()}
print(json.dumps(out))
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
        'python3', '-B', '-'], input=code, text=True, capture_output=True, timeout=60)
    require(result.returncode == 0, 'Frozen evidence read refused: ' + result.stderr)
    records = json.loads(result.stdout); output.mkdir()
    for name, row in records.items():
        data = base64.b64decode(row.pop('base64'))
        require(pathlib.PurePosixPath(name).name == name and hashlib.sha256(data).hexdigest() == row['sha256'] and
            row['mode'] == '0o400', 'Frozen evidence transport differs')
        with (output / name).open('xb') as out:
            out.write(data)
    (output / 'original-file-hashes.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
    print(json.dumps({'root': root, 'local': str(output), 'fileCount': len(records),
        'manifestSha256': records['prepared-manifest.json']['sha256'], 'productionGateCollected': False}), flush=True)


if __name__ == '__main__':
    main()
