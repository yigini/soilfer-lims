"""Independent capture stop outcome; no release or scientific approval.

Stops always precede evidence reads. A positive result binds closed transport,
the original unit cgroup and all34 immutable content references. Full content
semantics and fresh source authority remain mandatory package checks later.
"""
import pathlib
from kit_contract import HEAD,IMAGE,canonical,require,sha
from retained_contract import ROOT,exact_json
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT,CAPTURE_COMMANDS,stop_capture_owners
from kit_capture_budget import CAPTURE_TABLE_SHA
from kit_capture_review import CAPTURE_REVIEW_FILES,CONTROL_FILES
from kit_capture_controller import capture_controller_same_group
from capture_controller_output import capture_controller_closure
from controller_output import output_pin,output_read_record


def capture_content_commitment(root):
    root=pathlib.Path(root)
    require(root.as_posix()==CAPTURE_ROOT.as_posix(),'Exact independent capture outcome root required')
    receipt_pin=output_pin(root/'capture-receipt.json',16*1024**2)
    with (root/'capture-receipt.json').open('rb') as stream:raw=stream.read(16*1024**2+1)
    require(receipt_pin=={'bytes':len(raw),'sha256':sha(raw)} and
        output_pin(root/'capture-receipt.json',16*1024**2)==receipt_pin,'Capture content receipt changed')
    receipt=exact_json(raw)
    require(type(receipt.get('version')) is int and receipt['version']==2 and
        receipt.get('status')=='REVIEW_CAPTURE_CONTENT_COMPLETE' and receipt.get('root')==root.as_posix() and
        receipt.get('releaseRoot')==str(ROOT) and receipt.get('unit')==CAPTURE_UNIT and
        receipt.get('head')==HEAD and receipt.get('image')==IMAGE and receipt.get('captureTableSha256')==CAPTURE_TABLE_SHA and
        type(receipt.get('productionSqliteConnections')) is int and receipt['productionSqliteConnections']==0 and
        receipt.get('releaseGateConsumed') is False and receipt.get('releaseAuthorityGranted') is False and
        receipt.get('physicalFilesystemClosureClaimed') is False and receipt.get('neverRetry') is True and
        isinstance(receipt.get('files'),dict) and set(receipt['files'])==CAPTURE_REVIEW_FILES,
        'Exact capture content commitment required')
    for name,claimed in receipt['files'].items():
        pin=output_pin(root/name,16*1024**2,2 if name in CONTROL_FILES else 1)
        require(isinstance(claimed,dict) and set(claimed)=={'bytes','sha256'} and
            type(claimed.get('bytes')) is int and canonical(pin)==canonical(claimed),'Capture original content seal differs')
        if name in CONTROL_FILES:output_read_record(root,name)
    require(output_pin(root/'capture-receipt.json',16*1024**2)==receipt_pin,'Capture receipt changed after originals')
    return {'receipt':{'file':'capture-receipt.json',**receipt_pin},'originalFileCount':len(CAPTURE_REVIEW_FILES),
        'allOriginalContentPinsVerified':True,'fullContentSemanticsRechecked':False,
        'independentFullSemanticPackageReviewStillRequired':True}


def capture_run_commitment(root):
    root=pathlib.Path(root)
    require(root.as_posix()==CAPTURE_ROOT.as_posix(),'Exact capture run commitment root required')
    name='capture-controller-complete.json';path=root/name
    expected=output_pin(path,16*1024**2,2);pending=root/(name+'.pending')
    require(output_pin(pending,16*1024**2,2)==expected and
        (path.stat().st_dev,path.stat().st_ino)==(pending.stat().st_dev,pending.stat().st_ino),
        'Capture run completion requires its original immutable control pair')
    with path.open('rb') as stream:raw=stream.read(16*1024**2+1)
    require(expected=={'sha256':sha(raw),'bytes':len(raw)} and
        output_pin(path,16*1024**2,2)==expected,'Capture run completion changed')
    value=exact_json(raw)
    require(raw==canonical(value)+b'\n' and type(value.get('version')) is int and value['version']==1 and
        value.get('root')==CAPTURE_ROOT.as_posix() and value.get('captureTableSha256')==CAPTURE_TABLE_SHA and
        value.get('neverRetry') is True and value.get('releaseAuthorityGranted') is False and
        value.get('releaseGateConsumed') is False,'Canonical exact capture completion required')
    pins=value.get('memoryFiles');require(isinstance(pins,dict) and 0<len(pins)<=60000,'Complete bounded memory pin map required')
    for original,pin in pins.items():
        require(isinstance(original,str) and pathlib.PurePosixPath(original).name==original and
            (original.startswith('controller-memory-') or any(original.startswith(label+'-memory-') for label in CAPTURE_COMMANDS)) and
            'refus' not in original,'Unknown or refused memory original')
        actual=output_pin(root/original,16*1024**2,2 if original.startswith('controller-memory-') and original.endswith('.json') else 1)
        require(canonical(actual)==canonical(pin),'Capture memory original changed before independent unit outcome')
    receipt=output_pin(root/'capture-receipt.json',16*1024**2)
    require(canonical(value.get('contentReceipt'))==canonical({'file':'capture-receipt.json',**receipt}),
        'Run completion does not bind the closed content receipt')
    return {'completion':{'file':name,**expected},'originalMemoryFileCount':len(pins),
        'allOriginalMemoryPinsVerified':True,'fullMemorySemanticsRechecked':False,
        'independentFullSemanticPackageReviewStillRequired':True}


def capture_stop_outcome(root,call,controller_probe,store):
    # Do not move any evidence, cgroup or receipt authority read above stops.
    stops=stop_capture_owners(call)
    errors=[];controller=None;transport=None;content=None;run=None
    for phase,operation in (
        ('controller',lambda:controller_probe()),
        ('transport',lambda:capture_controller_closure(root)),
        ('content',lambda:capture_content_commitment(root)),
        ('controllerRun',lambda:capture_run_commitment(root))):
        try:
            value=operation()
            if phase=='controller':
                before=output_read_record(pathlib.Path(root),'controller-memory-before.json')
                capture_controller_same_group(before,value);controller=value
            elif phase=='transport':transport=value
            elif phase=='content':content=value
            else:run=value
        except BaseException as failure:errors.append({'phase':phase,'errorType':type(failure).__name__})
    retention=list(call.retention_errors)
    # An aborted early capture can legitimately have absent owners, but a
    # closed content capture must still retain every one of its six owners.
    if content is not None and (stops['observedAbsentOwners'] or
        stops['nonvacuousStoppedOwnerCount']!=len(CAPTURE_COMMANDS)):
        errors.append({'phase':'retainedOwners','errorType':'IncompleteRetainedCaptureOwnerSet'})
    complete=not stops['errors'] and not retention and not errors
    result={'version':1,'root':CAPTURE_ROOT.as_posix(),'unit':CAPTURE_UNIT,'captureTableSha256':CAPTURE_TABLE_SHA,
        'status':'CAPTURE_CONTROLLER_CLOSED_CONTENT_SEALED_PENDING_PACKAGE_REVIEW' if complete else
            'CAPTURE_STOPPED_OR_REFUSED_RETAIN_ALL',
        'stops':stops,'errors':errors,'retentionErrors':retention,'controller':controller,
        'transport':transport,'contentCommitment':content,'controllerRunCommitment':run,'allChecksComplete':complete,
        'fullContentSemanticsRechecked':False,'releaseAuthorityGranted':False,'releaseGateConsumed':False,
        'productionRestartPermitted':False,'servingPermitGranted':False,'neverRetry':True}
    store(result)
    return result
