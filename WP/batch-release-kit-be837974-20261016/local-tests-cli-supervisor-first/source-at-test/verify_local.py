"""Local test utility; each run ID is exclusive. Never imports an operator.

New run IDs preserve new iterations without replaying any old once-helper.
"""
import argparse
import ast
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import datetime

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--run-id',required=True);args=parser.parse_args()
    if not re.fullmatch('[a-z0-9][a-z0-9-]{0,80}',args.run_id):raise RuntimeError('Invalid local run ID')
    root=pathlib.Path(__file__).resolve().parent;out=root/('local-tests-'+args.run_id)
    out.mkdir();(out/'source-at-test').mkdir()
    sources=sorted(p for p in root.iterdir() if p.suffix in ('.py','.md','.yml','.json'))
    before={}
    for path in sources:
        raw=path.read_bytes();before[path.name]=hashlib.sha256(raw).hexdigest()
        (out/'source-at-test'/path.name).write_bytes(raw)
        if path.suffix=='.py':ast.parse(raw)
    began=datetime.datetime.now(datetime.timezone.utc).isoformat()
    result=subprocess.run([sys.executable,'-B','-m','unittest','discover','-s',str(root),'-p','verify_kit_*.py','-v'],cwd=root,capture_output=True)
    (out/'stdout-original.txt').write_bytes(result.stdout);(out/'stderr-original.txt').write_bytes(result.stderr)
    after={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
    value={'startedUtc':began,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'exitCode':result.returncode,'sourceBefore':before,'sourceAfter':after,'hostCalls':0,'productionCalls':0,
        'realLocalChildProcessesAndNewSyntheticSqliteFixturesOnly':True,'platform':sys.platform,'linuxDirectoryFsyncTested':False}
    (out/'verification.json').write_text(json.dumps(value,sort_keys=True,indent=2),encoding='utf-8')
    print(json.dumps({'output':str(out),'exitCode':result.returncode,'sourcesUnchanged':before==after}))
    if result.returncode!=0 or before!=after:raise SystemExit(1)

if __name__=='__main__':main()
