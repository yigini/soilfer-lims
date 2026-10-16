"""Independent capture stop outcome; no release or scientific approval.

Stops always precede evidence reads. A positive result binds closed transport,
the original unit cgroup and all19 immutable content references. Full content
semantics and fresh source authority remain mandatory package checks later.
"""
import pathlib
from kit_contract import HEAD,IMAGE,canonical,require,sha
from retained_contract import ROOT,exact_json
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT,stop_capture_owners
from kit_capture_budget import CAPTURE_TABLE_SHA
from kit_capture_review import CAPTURE_REVIEW_FILES,CONTROL_FILES
from kit_capture_controller import capture_controller_same_group
from capture_controller_output import capture_controller_closure
from controller_output import output_pin,output_read_record


def capture_content_commitment(root):
    root=pathlib.Path(root)
    require(root.as_posix()==CAPTURE_ROOT.as_posix(),'Exact independent capture outcome root required')
    receipt_pin=output_pin(root/'capture-receipt.json',16*1024**2)
    raw=(root/'capture-receipt.json').read_bytes()
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


def capture_stop_outcome(root,call,controller_probe,store):
    # Do not move any evidence, cgroup or receipt authority read above stops.
    stops=stop_capture_owners(call)
    errors=[];controller=None;transport=None;content=None
    for phase,operation in (
        ('controller',lambda:controller_probe()),
        ('transport',lambda:capture_controller_closure(root)),
        ('content',lambda:capture_content_commitment(root))):
        try:
            value=operation()
            if phase=='controller':
                before=output_read_record(pathlib.Path(root),'controller-memory-before.json')
                capture_controller_same_group(before,value);controller=value
            elif phase=='transport':transport=value
            else:content=value
        except BaseException as failure:errors.append({'phase':phase,'errorType':type(failure).__name__})
    retention=list(call.retention_errors)
    complete=not stops['errors'] and not retention and not errors
    result={'version':1,'root':CAPTURE_ROOT.as_posix(),'unit':CAPTURE_UNIT,'captureTableSha256':CAPTURE_TABLE_SHA,
        'status':'CAPTURE_CONTROLLER_CLOSED_CONTENT_SEALED_PENDING_PACKAGE_REVIEW' if complete else
            'CAPTURE_STOPPED_OR_REFUSED_RETAIN_ALL',
        'stops':stops,'errors':errors,'retentionErrors':retention,'controller':controller,
        'transport':transport,'contentCommitment':content,'allChecksComplete':complete,
        'fullContentSemanticsRechecked':False,'releaseAuthorityGranted':False,'releaseGateConsumed':False,
        'productionRestartPermitted':False,'servingPermitGranted':False,'neverRetry':True}
    store(result)
    return result
