"""Separate silent capture transport; common bounded pipes, exact capture argv.

Import is inert. Package/source reads are bounded and precede child dispatch;
fresh primary authority remains the capture child's first operational duty.
No controller deadline, signal, gate or serving authority is added here.
"""
import os
import pathlib
import sys
from controller_output import (CONTROLLER_OUTPUT_BYTES,CONTROLLER_STREAM_LIMIT,
    CONTROLLER_METADATA_LIMIT,CONTROLLER_NAMES,output_require,output_canonical,
    output_root,output_pin,output_record,output_read_record,capture_controller)
from kit_capture_owned import CAPTURE_ROOT
from kit_capture_copy import capture_source_review
from kit_frozen import frozen_source_bytes
from retained_contract import exact_json


def capture_controller_argv(root):
    root=pathlib.Path(root)
    output_require(root.as_posix()==CAPTURE_ROOT.as_posix(),'Exact separate capture transport root required')
    return ['/usr/bin/python3','-B',str(root/'tooling/run_capture.py'),'--root',str(root)]


def capture_controller_inputs(root):
    capture_controller_argv(root)
    root=output_root(root);values={}
    for name in ('source-index.json','source-review.json'):
        pin=output_pin(root/name,16*1024**2)
        with (root/name).open('rb') as stream:raw=stream.read(16*1024**2+1)
        output_require(output_pin(root/name,16*1024**2)==pin and
            pin=={'bytes':len(raw),'sha256':__import__('hashlib').sha256(raw).hexdigest()},
            'Capture source input changed while reading')
        values[name]=exact_json(raw)
    index=values['source-index.json'];source=values['source-review.json']
    capture_source_review(index,source)
    frozen_source_bytes(root/'tooling',index)
    return index,source


def capture_controller_transport(root,index,source,sync=True,spawn=None):
    # Pure stored-source authority precedes root stat, file creation and spawn.
    capture_source_review(index,source)
    argv=capture_controller_argv(root)
    kwargs={} if spawn is None else {'spawn':spawn}
    return capture_controller(root,argv,sync,**kwargs)


def capture_controller_closure(root):
    expected_argv=capture_controller_argv(root);root=output_root(root)
    intent=output_read_record(root,'controller-output-intent.json')
    expected={'version':1,'childArgv':expected_argv,'maximumStreamBytes':CONTROLLER_STREAM_LIMIT,
        'sentinelBytes':1,'namespaceBytes':CONTROLLER_OUTPUT_BYTES,'newControllerDeadline':False,
        'controllerTerminationOnCaptureFailure':False,'neverRetry':True,'filesystemClosureClaimed':False}
    output_require(output_canonical(intent)==output_canonical(expected),
        'Exact capture before-child transport admission required')
    closed=output_read_record(root,'controller-output-closed.json')
    output_require(set(closed)=={'version','childArgv','status','errorType','streams','completeOriginals',
        'controllerSignalledByCapture','neverRetry'} and type(closed['version']) is int and closed['version']==1 and
        closed['childArgv']==expected_argv and type(closed['status']) is int and closed['status']==0 and
        closed['errorType'] is None and closed['completeOriginals'] is True and
        closed['controllerSignalledByCapture'] is False and closed['neverRetry'] is True and
        isinstance(closed['streams'],dict) and set(closed['streams'])=={'stdout','stderr'},
        'Complete exit-zero capture controller transport required')
    output_require(all(not (root/name).exists() and not (root/name).is_symlink() for name in
        ('controller-output-bootstrap-failure.json','controller-output-bootstrap-failure.json.pending')),
        'Capture bootstrap failure retained')
    for name,record in closed['streams'].items():
        pin=output_pin(root/('controller-original.'+name),CONTROLLER_STREAM_LIMIT)
        output_require(isinstance(record,dict) and set(record)=={'bytes','sha256','eof','overflow','unretainedBytesObserved'} and
            type(record['bytes']) is int and {'bytes':record['bytes'],'sha256':record['sha256']}==pin and
            record['eof'] is True and record['overflow'] is False and record['unretainedBytesObserved'] is False,
            'Full unchanged capture controller originals required')
    return closed


def main():
    root=None
    try:
        output_require(os.name=='posix' and sys.argv[1:]==['--root',str(CAPTURE_ROOT)],
            'Exact Linux capture transport required')
        index,source=capture_controller_inputs(CAPTURE_ROOT)
        candidate=output_root(CAPTURE_ROOT)
        output_require(all(not (candidate/name).exists() and not (candidate/name).is_symlink() for name in CONTROLLER_NAMES),
            'Consumed capture namespace cannot receive a new failure record')
        root=candidate
        closed=capture_controller_transport(root,index,source)
        return 0 if closed['completeOriginals'] and type(closed['status']) is int and closed['status']==0 else 1
    except BaseException as failure:
        if root is not None:
            try:output_record(root,'controller-output-bootstrap-failure.json',{'version':1,
                'errorType':type(failure).__name__,'completeOriginals':False,'neverRetry':True})
            except BaseException:pass
        return 1


if __name__=='__main__':sys.exit(main())
