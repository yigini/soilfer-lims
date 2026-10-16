"""Typed retained-clone CLI owners for fresh review capture, never release.

Import is inert. This component is not a capture launcher or source approval.
Only206/214 preparation can write the new retained database. The production
volume, release root,209 APPLY, default startup and ingress are unavailable.
"""
import hashlib
import pathlib
import re
from kit_contract import IMAGE,MEMORY_MAX,require,canonical,sha
from retained_contract import exact_json
from kit_owned import OwnedCli,selected_fields,same_retained,control_callbacks
from kit_apache_capture import CAPTURE_ROOT as APACHE_CAPTURE_ROOT

CAPTURE_ROOT=pathlib.Path('/opt/lims/releases/workflow-batch-review-capture-be837974-20261016T170000Z')
CAPTURE_UNIT='lims-workflow-batch-review-capture-be837974-20261016t170000z.service'
CAPTURE_LABEL='io.soilfer.review-capture-owned'
CAPTURE_DATABASE='/app/server/prisma/dev.db'
CAPTURE_COMMANDS={
    'capture-integrity':('/release/stopped_integrity.cjs',None),
    'capture-canonical-policy':('/app/server/scripts/install_lab_policy_schema.js','--dry-run'),
    'capture-206-prepare':('/app/server/scripts/install_sample_containers.js','--apply'),
    'capture-214-prepare':('/app/server/scripts/install_control_charts.js','--apply'),
    'capture-chart-impact':('/app/server/scripts/control_chart_prebinding_impact.js',None),
    'capture-order-impact':('/release/order_impact.cjs',None),
}
CAPTURE_SNAPSHOTS={'capture-canonical-policy':1,'capture-214-prepare':1,'capture-order-impact':2}
CAPTURE_COPY_SITES={'capture-canonical-policy':'capture-policy-snapshot',
    'capture-214-prepare':'capture-214-snapshot','capture-order-impact':'capture-order-snapshots'}

def capture_spec(label):
    require(label in CAPTURE_COMMANDS,'Only compiled fresh-capture owner permitted')
    require(CAPTURE_ROOT.as_posix()==APACHE_CAPTURE_ROOT,'Apache and scientific capture roots differ')
    owner=CAPTURE_ROOT.as_posix()+':'+label
    name='lims-review-capture-'+hashlib.sha256(owner.encode()).hexdigest()[:24]
    script,mode=CAPTURE_COMMANDS[label]
    child=[script,'--db',CAPTURE_DATABASE]+([] if mode is None else [mode])
    writable=label in ('capture-206-prepare','capture-214-prepare')
    tmp=(CAPTURE_ROOT/(label+'-retained-temp')).as_posix()
    mounts=[{'Type':'bind','Source':(CAPTURE_ROOT/'scientific-database').as_posix(),
        'Destination':'/app/server/prisma','RW':writable},
        {'Type':'bind','Source':(CAPTURE_ROOT/'tooling').as_posix(),'Destination':'/release','RW':False},
        {'Type':'bind','Source':tmp,'Destination':'/tmp','RW':True}]
    environment={'NODE_OPTIONS':'','ALLOW_PRISMA_DB_PUSH':'false','ALLOW_AUTO_SEED':'false',
        'DISABLE_BACKGROUND_JOBS':'true','DATABASE_PATH':CAPTURE_DATABASE,'DATABASE_URL':'file:'+CAPTURE_DATABASE,
        'TMPDIR':'/tmp','TMP':'/tmp','TEMP':'/tmp'}
    args=['docker','create','--name',name,'--label',CAPTURE_LABEL+'='+owner,'--network','none',
        '--memory',str(MEMORY_MAX),'--memory-swap',str(MEMORY_MAX),'--restart','no',
        '--entrypoint','node','--workdir','/app/server','--no-healthcheck','--log-driver','none']
    for key,value in sorted(environment.items()):args+=['-e',key+'='+value]
    for mount in mounts:
        args+=['--mount','type=bind,src='+mount['Source']+',dst='+mount['Destination']+
            ('' if mount['RW'] else ',readonly')]
    args+=[IMAGE,'/release/capture_cli_guard.cjs','/tmp',label,*child]
    return {'label':label,'owner':owner,'name':name,'image':IMAGE,'child':child,
        'tmp':tmp,'mounts':mounts,'environment':environment,'argv':args,'neverRetry':True,'dataWritable':writable}

def validate_capture_spec(spec):
    require(isinstance(spec,dict) and spec==capture_spec(spec.get('label')),
        'Fresh-capture intent differs from compiled specification')
    return spec

def capture_selected(value,spec,running=None,emergency=False):
    validate_capture_spec(spec)
    return selected_fields(value,spec,CAPTURE_LABEL,
        ['/release/capture_cli_guard.cjs','/tmp',spec['label'],*spec['child']],running,emergency)

class CaptureOwnedCli(OwnedCli):
    specification_validator=staticmethod(validate_capture_spec)
    selection=staticmethod(capture_selected)

def capture_filesystem_controls(root,require_directory_sync=True,disk=None,no_writers=None):
    root=pathlib.Path(root)
    require(root.as_posix()==CAPTURE_ROOT.as_posix() and root.resolve()==root and root.is_dir(),
        'Exact existing fresh-capture control root required')
    for part in (root,*root.parents):require(not part.is_symlink(),'Fresh-capture root alias refused')
    def directory(spec):
        validate_capture_spec(spec);p=root/(spec['label']+'-retained-temp')
        require(p.as_posix()==spec['tmp'] and p.parent==root and not p.is_symlink(),
            'Exact private fresh-capture control directory required')
        return p
    return control_callbacks(root,directory,require_directory_sync,disk,no_writers,CAPTURE_SNAPSHOTS,
        CAPTURE_COPY_SITES,'capture-order-impact',())

def stop_capture_owners(call,owners=None):
    """Independent exact-owner stops; no release, predecessor or serving path.

    Lookup works after a lost create/start return. Refused reads or retention
    failures for one owner cannot suppress an attempt for the next owner.
    """
    owners=sorted(CAPTURE_COMMANDS) if owners is None else list(owners)
    require(len(owners)==len(set(owners)) and all(x in CAPTURE_COMMANDS for x in owners),
        'Only compiled fresh-capture stops permitted')
    stopped=[];absent=[];errors=[]
    for label in owners:
        phase='inventory'
        try:
            spec=capture_spec(label)
            raw=call(['docker','ps','-aq','--no-trunc','--filter','label='+CAPTURE_LABEL+'='+spec['owner']])
            require(isinstance(raw,bytes) and len(raw)<=512*1024,'Bounded fresh-capture inventory required')
            ids=raw.decode('ascii').splitlines()
            require(len(ids)<=1 and all(re.fullmatch('[a-f0-9]{64}',x) for x in ids),
                'Duplicate/malformed fresh-capture owner inventory')
            if not ids:absent.append({'owner':spec['owner'],'observedAbsent':True});continue
            identity=ids[0];phase='inspectBefore'
            rows=exact_json(call(['docker','inspect',identity]))
            require(isinstance(rows,list) and len(rows)==1 and isinstance(rows[0],dict) and rows[0].get('Id')==identity,
                'Exact full fresh-capture inspection required')
            before=capture_selected(rows[0],spec,emergency=True)
            runtime_violation=False
            try:capture_selected(rows[0],spec)
            except BaseException:runtime_violation=True
            if before['running']:
                phase='stop';call(['docker','stop','-t','10',identity])
            phase='inspectAfter'
            rows=exact_json(call(['docker','inspect',identity]))
            require(isinstance(rows,list) and len(rows)==1 and isinstance(rows[0],dict) and rows[0].get('Id')==identity,
                'Exact full stopped fresh-capture inspection required')
            after=capture_selected(rows[0],spec,False,emergency=True);same_retained(before,after)
            stopped.append({'before':before,'after':after,'stoppedAndRetained':True,
                'actualExitCode':rows[0]['State'].get('ExitCode'),'runtimeViolationObservedBeforeStop':runtime_violation})
        except BaseException as failure:
            errors.append({'ownerLabel':label,'phase':phase,'errorType':type(failure).__name__})
    return {'stoppedAndRetained':stopped,'observedAbsentOwners':absent,'errors':errors,
        'allObservedExactCaptureOwnersStopped':not errors,'nonvacuousStoppedOwnerCount':len(stopped),
        'noForeignStops':True,'noRemovalOrRestore':True,'productionVolumeMounted':False}
