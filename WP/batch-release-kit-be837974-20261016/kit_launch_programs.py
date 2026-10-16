"""Render and compile every exact Linux program BEFORE the first SSH call.

AST substitution inserts literal values once. Runtime budget and stat-only
reader definitions are copied as exact AST bodies from this source graph.
No program is executed by importing or rendering this module.
"""
import ast
import pathlib
from kit_contract import require
from retained_contract import ROOT,ROOT_NAME
from kit_package import allocation

UNIT='lims-'+ROOT_NAME.lower()+'.service'
HERE=pathlib.Path(__file__).resolve().parent

PREFLIGHT='''
import os,pathlib,re,time,subprocess,json,collections,math,hashlib
def sha(raw):return hashlib.sha256(raw).hexdigest()
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()
root=pathlib.Path(ROOT_VALUE);phase=PHASE_VALUE
require(os.name=='posix','Linux launcher required')
for ancestor in (root,*root.parents):require(not ancestor.is_symlink(),'Root ancestor alias refused')
require(root.parent==pathlib.Path('/opt/lims/releases') and root.parent.resolve(strict=True)==root.parent,
    'Exact existing release parent required')
if phase=='BEFORE_ROOT':require(not root.exists(),'Consumed root; never retry')
else:require(root.is_dir() and root.resolve(strict=True)==root,'Exact uploaded root required')
prior=subprocess.run(['systemctl','show',UNIT_VALUE,'--property=LoadState','--value'],capture_output=True,timeout=15)
require(prior.returncode==0 and prior.stdout.strip()==b'not-found' and not prior.stderr,
    'Unused unit not proved; inspect same unit, never retry')
inputs=measure_inputs();budget=Budget(inputs['databaseAllocatedBytes'],inputs['assetsAllocatedBytes'],IMAGE_BYTES)
rows=hardware();required=budget.required()+FUTURE_PACKAGE_VALUE
free_gate(rows,required)
print(json.dumps({'phase':phase,'root':str(root),'hardware':rows,'inputs':inputs,'requiredBytes':required,
    'remainingCopyBytes':budget.remaining(),'futurePackageAllocationBytes':FUTURE_PACKAGE_VALUE,
    'tableSha256':TABLE_SHA,'databaseEquivalents':DB_EQUIVALENTS,'metadataOnly':True,
    'productionSqliteConnections':0,'neverRetry':True},sort_keys=True))
'''

CREATE='''
import os,pathlib
root=pathlib.Path(ROOT_VALUE)
if os.name!='posix':raise RuntimeError('Linux required')
for part in (root,*root.parents):
    if part.is_symlink():raise RuntimeError('Root ancestor alias refused')
if root.parent!=pathlib.Path('/opt/lims/releases') or root.parent.resolve(strict=True)!=root.parent or root.exists():
    raise RuntimeError('Exact unused release root required')
root.mkdir(mode=0o700)
fd=os.open(str(root.parent),os.O_RDONLY|os.O_DIRECTORY)
try:os.fsync(fd)
finally:os.close(fd)
'''

LAUNCH='''
import os,pathlib,stat,hashlib,sys,subprocess,json,time
root=pathlib.Path(ROOT_VALUE);expected=PINS_VALUE
if os.name!='posix' or not root.is_dir() or root.resolve(strict=True)!=root:raise RuntimeError('Exact Linux root required')
for part in (root,*root.parents):
    if part.is_symlink():raise RuntimeError('Root alias refused')
seen=set();directories={''}
for path in root.rglob('*'):
    if path.is_symlink():raise RuntimeError('Uploaded alias refused')
    info=path.lstat();name=path.relative_to(root).as_posix()
    if stat.S_ISDIR(info.st_mode):directories.add(name);continue
    if name not in expected or not stat.S_ISREG(info.st_mode) or info.st_nlink!=1:raise RuntimeError('Expanded/aliased upload refused')
    pin=expected[name]
    if info.st_size!=pin['bytes'] or info.st_size>16*1024**2:raise RuntimeError('Upload size differs')
    raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=pin['sha256']:raise RuntimeError('Upload hash differs')
    path.chmod(0o400);seen.add(name)
if seen!=set(expected):raise RuntimeError('Incomplete uploaded package')
wanted_dirs={''}
for name in expected:
    parts=name.split('/')[:-1]
    for end in range(1,len(parts)+1):wanted_dirs.add('/'.join(parts[:end]))
if directories!=wanted_dirs:raise RuntimeError('Expanded uploaded directory tree')
for directory in sorted(directories,key=lambda n:len(n),reverse=True):
    fd=os.open(str(root/directory),os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(fd)
    finally:os.close(fd)
for name in expected:
    if name.startswith('tooling/') and name.endswith('.py'):
        compile((root/name).read_bytes(),name,'exec')
sys.path.insert(0,str(root/'tooling'))
from kit_package import read_package,verify_final
checked=verify_final(read_package(root,True),time.time())
if checked['filePins']!=expected:raise RuntimeError('Uploaded authority map differs')
unit=UNIT_VALUE
prior=subprocess.run(['systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=15)
if prior.returncode!=0 or prior.stdout.strip()!=b'not-found' or prior.stderr:raise RuntimeError('Never reuse unit')
args=['systemd-run','--unit',unit,'--property=Type=exec','--property=RuntimeMaxSec=5400',
    '--property=MemoryMax=805306368','--property=MemorySwapMax=0','--property=Restart=no',
    '--property=TimeoutStopSec=300','--property=UMask=0077',
    '--property=ExecStopPost=/usr/bin/python3 -B '+str(root/'tooling/stop_post.py'),
    '--property=StandardOutput=journal','--property=StandardError=journal',
    '--working-directory',str(root),'/usr/bin/python3','-B',str(root/'tooling/run_release.py'),'--root',str(root)]
# A lost/failed start return consumes this attempt. The independent nonignored
# hook remains registered even if run_release fails during imports/construction.
result=subprocess.run(args,capture_output=True,timeout=30)
print(json.dumps({'unit':unit,'root':str(root),'exitCode':result.returncode,
    'stdout':result.stdout.decode('utf-8','replace'),'stderr':result.stderr.decode('utf-8','replace'),
    'status':'DISPATCHED_OUTCOME_REQUIRES_SAME_UNIT_OBSERVATION','neverRetry':True},sort_keys=True))
if result.returncode!=0:raise RuntimeError('Unknown launch; inspect SAME unit and never redispatch')
'''


def selected_definitions(filename,names):
    tree=ast.parse((HERE/filename).read_bytes());selected=[];found=set()
    for node in tree.body:
        node_names={node.name} if isinstance(node,(ast.FunctionDef,ast.ClassDef)) else {
            target.id for target in getattr(node,'targets',[]) if isinstance(target,ast.Name)}
        if node_names&set(names):selected.append(node);found|=node_names&set(names)
    require(found==set(names),'Remote program exact AST dependency missing')
    return selected


def render(program,bindings,definitions=()):
    tree=ast.parse(program);tree.body=list(definitions)+tree.body
    found={name:0 for name in bindings}
    class Literals(ast.NodeTransformer):
        def visit_Name(self,node):
            if node.id in bindings and isinstance(node.ctx,ast.Load):
                found[node.id]+=1
                return ast.copy_location(ast.parse(repr(bindings[node.id]),mode='eval').body,node)
            return node
    tree=Literals().visit(tree);ast.fix_missing_locations(tree)
    require(all(count>0 for count in found.values()),'Unused reviewed render binding refused')
    require(not any(isinstance(n,ast.Name) and n.id.endswith('_VALUE') for n in ast.walk(tree)),
        'Unbound remote program literal refused')
    raw=(ast.unparse(tree)+'\n').encode();compile(raw,'reviewed-linux-program','exec')
    require(len(raw)<=1024**2,'Reviewed remote stdin exceeds transport bound');return raw


def remote_programs(pins):
    future=allocation(pins)
    definitions=selected_definitions('kit_contract.py',[
        'FLOOR','LOG_RESERVE','ADDITIONAL_HEADROOM','IMAGE_BYTES','require','disk_required'])
    definitions+=selected_definitions('retained_contract.py',['LIVE_DATA','LIVE_ASSETS'])
    definitions+=selected_definitions('kit_copy_admission.py',[
        'BLOCK','MAX_FILES','MAX_DIRECTORIES','MAX_CONTENT_BYTES','copy_layout'])
    definitions+=selected_definitions('kit_budget.py',[
        'MARGIN_PERCENT','MINIMUM_DB_EQUIVALENTS','ASSET_COPIES','SCHEMA_BYTES','FIXED_STARTUP','DB_COST',
        'RECOVERY_SCHEMA_BYTES','RECOVERY_FIXED','RECOVERY_DB_COPIES','EARLY_PREFIX_MAX_DB_COPIES','RECOVERY_EVIDENCE_SHARE',
        'STAGES','SEAL_DIRECTORY_BYTES','CONTROLLER_COPY_SITES','CLI_SITE','TABLE','TOTAL_DB_COPIES','DB_EQUIVALENTS','TABLE_SHA','Budget'])
    definitions+=selected_definitions('kit_disk.py',['BOUND','hardware','free_gate','measure_inputs'])
    # Definitions need imports/helpers before their top-level derived constants.
    prefix=ast.parse('import os,pathlib,re,time,collections,math,json,hashlib\n'
        'def sha(raw):return hashlib.sha256(raw).hexdigest()\n'
        "def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()\n").body
    common={'ROOT_VALUE':str(ROOT),'UNIT_VALUE':UNIT}
    return {'beforeRoot':render(PREFLIGHT,{**common,'PHASE_VALUE':'BEFORE_ROOT','FUTURE_PACKAGE_VALUE':future},prefix+definitions),
        'create':render(CREATE,{'ROOT_VALUE':str(ROOT)}),
        'beforeUnit':render(PREFLIGHT,{**common,'PHASE_VALUE':'BEFORE_UNIT','FUTURE_PACKAGE_VALUE':0},prefix+definitions),
        'unit':render(LAUNCH,{**common,'PINS_VALUE':pins})}
