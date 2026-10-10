"""Verify CLI lifetime/memory evidence on another owned, read-only-plan copy."""
import json, pathlib, shutil, sys
import release_support as s

root = pathlib.Path(__file__).resolve().parent
assert root.parent == pathlib.Path('/opt/lims/releases') and root.name.startswith('combined-eb6de2e8-guards-')
source = pathlib.Path(sys.argv[1]).resolve()
assert source.parent.parent == root.parent and source.parent.name.startswith('combined-eb6de2e8-')
assert source.name == 'fresh-production-copy.db' and not source.is_symlink()
image = sys.argv[2]
original = s.sha(source)
prisma = root/'owned-prisma'
prisma.mkdir(mode=0o700)
target = prisma/'dev.db'
with source.open('rb') as reader, target.open('xb') as writer:
    shutil.copyfileobj(reader, writer)
target.chmod(0o600)
before = s.sha(target)
plan = s.cli(root, image, prisma, 'install_work_attempt_contract.js', '--dry-run', '190-cli-proof')
s.verify_attempt_plan(plan)
assert s.sha(target) == before and s.sha(source) == original
summary = {'status':'READ_ONLY_CLI_LIFETIME_PROOF', 'head':s.HEAD, 'totalChanges':0,
    'copyBytesPreserved':True, 'sourceCopyBytesPreserved':True,
    'container':json.loads((root/'190-cli-proof-container.json').read_text()), 'utc':s.utc()}
with (root/'cli-lifetime-proof.json').open('x') as output:
    json.dump(summary, output, indent=2)
print(json.dumps(summary))
