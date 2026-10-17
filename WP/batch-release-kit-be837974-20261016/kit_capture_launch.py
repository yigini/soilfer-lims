"""Compile the separate capture preflights/unit programs; never execute them."""
import ast
from kit_contract import require
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT
from kit_package import allocation
from kit_launch_programs import selected_definitions,render,CREATE,PREFLIGHT

LAUNCH='''
import os,pathlib,stat,hashlib,sys,subprocess,json
root=pathlib.Path(ROOT_VALUE);expected=PINS_VALUE
if os.name!='posix' or root.resolve(strict=True)!=root or not root.is_dir():raise RuntimeError('Exact Linux capture root required')
for part in (root,*root.parents):
    if part.is_symlink():raise RuntimeError('Capture root alias refused')
seen=set();directories={''}
for path in root.rglob('*'):
    if path.is_symlink():raise RuntimeError('Uploaded alias refused')
    info=path.lstat();name=path.relative_to(root).as_posix()
    if stat.S_ISDIR(info.st_mode):directories.add(name);continue
    if name not in expected or not stat.S_ISREG(info.st_mode) or info.st_nlink!=1:raise RuntimeError('Expanded or aliased capture upload')
    pin=expected[name]
    if info.st_size!=pin['bytes'] or not 0<info.st_size<=16*1024**2:raise RuntimeError('Capture upload size differs')
    with path.open('rb') as stream:raw=stream.read(16*1024**2+1)
    if len(raw)!=pin['bytes'] or hashlib.sha256(raw).hexdigest()!=pin['sha256']:raise RuntimeError('Capture upload changed')
    path.chmod(0o400)
    fd=os.open(str(path),os.O_RDONLY)
    try:os.fsync(fd)
    finally:os.close(fd)
    seen.add(name)
if seen!=set(expected):raise RuntimeError('Missing capture upload')
wanted={''}
for name in expected:
    parts=name.split('/')[:-1]
    for end in range(1,len(parts)+1):wanted.add('/'.join(parts[:end]))
if directories!=wanted:raise RuntimeError('Expanded capture directories')
for name in sorted(directories,key=len,reverse=True):
    fd=os.open(str(root/name),os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(fd)
    finally:os.close(fd)
for name in expected:
    if name.startswith('tooling/') and name.endswith('.py'):compile((root/name).read_bytes(),name,'exec')
sys.path.insert(0,str(root/'tooling'))
from kit_capture_inputs import verify_capture_inputs
from kit_package import read_package
checked=verify_capture_inputs(read_package(root))
if checked['filePins']!=expected:raise RuntimeError('Capture authority map differs')
unit=UNIT_VALUE
prior=subprocess.run(['systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=15)
if prior.returncode!=0 or prior.stdout.strip()!=b'not-found' or prior.stderr:raise RuntimeError('Capture unit consumed; never retry')
args=['systemd-run','--unit',unit,'--property=Type=exec','--property=RuntimeMaxSec=5400',
    '--property=MemoryMax=805306368','--property=MemorySwapMax=0','--property=Restart=no',
    '--property=TimeoutStopSec=300','--property=UMask=0077',
    '--property=ExecStopPost=/usr/bin/python3 -B '+str(root/'tooling/capture_stop_post.py'),
    '--property=StandardOutput=null','--property=StandardError=null',
    '--working-directory',str(root),'/usr/bin/python3','-B',str(root/'tooling/capture_controller_output.py'),'--root',str(root)]
result=subprocess.run(args,capture_output=True,timeout=30)
print(json.dumps({'unit':unit,'root':str(root),'exitCode':result.returncode,
    'stdout':result.stdout.decode('utf-8','replace'),'stderr':result.stderr.decode('utf-8','replace'),
    'status':'CAPTURE_DISPATCHED_REQUIRES_SAME_UNIT_CLOSED_ORIGINALS','neverRetry':True},sort_keys=True))
if result.returncode!=0:raise RuntimeError('Unknown capture dispatch; observe SAME unit, never redispatch')
'''


def remote_capture_programs(pins):
    future=allocation(pins)
    definitions=ast.parse('import os,pathlib,re,time,collections,math,json,hashlib\n'
        'def sha(raw):return hashlib.sha256(raw).hexdigest()\n'
        "def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()\n").body
    for filename,names in (
        ('kit_contract.py',['FLOOR','LOG_RESERVE','ADDITIONAL_HEADROOM','IMAGE_BYTES','require','disk_required']),
        ('retained_contract.py',['LIVE_DATA','LIVE_ASSETS']),
        ('kit_copy_admission.py',['BLOCK','MAX_FILES','MAX_DIRECTORIES','MAX_CONTENT_BYTES','copy_layout']),
        ('kit_budget.py',['MARGIN_PERCENT','MINIMUM_DB_EQUIVALENTS','SEAL_DIRECTORY_BYTES']),
        ('kit_capture_owned.py',['CAPTURE_ROOT','CAPTURE_UNIT','CAPTURE_COPY_SITES']),
        ('kit_capture_journal.py',['CAPTURE_JOURNAL_SITES','JOURNAL_DB_COST']),
        ('kit_capture_budget.py',['CAPTURE_DB_COST','CAPTURE_APACHE_BYTES','CAPTURE_STAGES','CAPTURE_TABLE',
            'CAPTURE_TOTAL_DB_COPIES','CAPTURE_DB_EQUIVALENTS','CAPTURE_TABLE_SHA','CaptureBudget']),
        ('kit_disk.py',['BOUND','hardware','free_gate','measure_inputs'])):
        definitions+=selected_definitions(filename,names)
    # Only the typed budget symbols change in the shared stat-only preflight.
    # Their exact AST bodies and capture table are independently checked.
    tree=ast.parse(PREFLIGHT)
    class CaptureSymbols(ast.NodeTransformer):
        def visit_Name(self,node):
            names={'Budget':'CaptureBudget','TABLE_SHA':'CAPTURE_TABLE_SHA','DB_EQUIVALENTS':'CAPTURE_DB_EQUIVALENTS'}
            if node.id in names:node.id=names[node.id]
            return node
    tree=CaptureSymbols().visit(tree);preflight=ast.unparse(tree)
    common={'ROOT_VALUE':CAPTURE_ROOT.as_posix(),'UNIT_VALUE':CAPTURE_UNIT}
    return {'beforeRoot':render(preflight,{**common,'PHASE_VALUE':'BEFORE_ROOT','FUTURE_PACKAGE_VALUE':future},definitions),
        'create':render(CREATE,{'ROOT_VALUE':CAPTURE_ROOT.as_posix()}),
        'beforeUnit':render(preflight,{**common,'PHASE_VALUE':'BEFORE_UNIT','FUTURE_PACKAGE_VALUE':0},definitions),
        'unit':render(LAUNCH,{**common,'PINS_VALUE':pins})}
