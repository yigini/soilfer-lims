"""Source-first construction of the separate capture controller.

Only immutable package input reads and bounded primary authority collection
precede fresh authority. Production sizing, kernel and Docker observations
follow it. Import is inert; this source has not been run on a host.
"""
import os
import pathlib
import time
from kit_contract import IMAGE_BYTES,canonical,require,sha
from kit_capture_owned import CAPTURE_ROOT,CaptureOwnedCli,capture_filesystem_controls,stop_capture_owners
from kit_capture_copy import capture_source_review,sync_capture_tree
from kit_capture_authority import CaptureAuthority
from kit_capture_controller import CaptureControllerGuard
from kit_capture_memory import capture_memory_history
from kit_capture_science import capture_no_writers
from kit_capture_review import CaptureReview
from kit_capture_budget import CaptureBudget,CaptureDisk,CAPTURE_TABLE_SHA
from capture_controller_output import capture_controller_inputs
from kit_provider import GitHubProvider,MAX_RESPONSE
from kit_io import CommandRunner
from kit_docker import ContainerReader,configure_reader
from kit_runtime import PREDECESSOR_ID
from kit_disk import measure_inputs
from kit_stop import EmergencyCommands
from kit_journal import Journal,exclusive_record
from kit_evidence import bind_runtime


class CaptureSourceRunner:
    """First network collection has no production, kernel or Docker reader."""
    def __init__(self,root,clock=time.monotonic):
        self.clock=clock;self.began=clock();self.root=pathlib.Path(root)
        self.runner=CommandRunner(root,self.check,programs=frozenset(('curl',)))

    def check(self,needed=0):
        require(type(needed) is int and 0<=needed<=15 and self.clock()-self.began+needed<=300,
            'Initial source-only authority collection deadline reached')

    def run(self,argv,label,timeout):
        require(label.startswith('capture-authority-github-') and argv[:4]==
            ['curl','--silent','--show-error','--fail'], 'Only bounded primary source requests before authority')
        return self.runner.run(argv,label,timeout,
            output_limits={'stdout':MAX_RESPONSE,'stderr':64*1024})


class CaptureResourceGuard:
    def __init__(self,controller,clock=time.monotonic):
        self.controller=controller;self.clock=clock;self.disk=None;self.number=0;self.last=None

    def bind(self,disk):
        require(self.disk is None and type(disk) is CaptureDisk,'Capture disk binding is single-use')
        self.disk=disk

    def __call__(self,needed=0):
        require(self.disk is not None,'Capture command requires its measured budget')
        self.disk.check(needed);now=self.clock()
        if self.last is None or now-self.last>=1:
            self.number+=1;self.controller.observe('watch-'+str(self.number).zfill(6));self.last=now


def construct_capture(root=CAPTURE_ROOT):
    require(os.name=='posix' and pathlib.Path(root).as_posix()==CAPTURE_ROOT.as_posix(),
        'Exact separate Linux capture construction required')
    index,source=capture_controller_inputs(root)
    binding=capture_source_review(index,source)
    bind_runtime(root)
    authority=CaptureAuthority(root,index,source,GitHubProvider(CaptureSourceRunner(root),'capture-authority'))
    authority.authorize()
    # The fresh primary snapshot has passed before the first kernel, sizing
    # or Docker observation. The controller consumes it once at execute().
    controller=CaptureControllerGuard(root);controller.observe('before')
    measured=measure_inputs()
    budget=CaptureBudget(measured['databaseAllocatedBytes'],measured['assetsAllocatedBytes'],IMAGE_BYTES)
    guard=CaptureResourceGuard(controller);runner=CommandRunner(root,guard)
    reader=ContainerReader(runner,PREDECESSOR_ID)
    disk=CaptureDisk(root,reader,runner,budget);guard.bind(disk);guard(0)
    configure_reader(reader)
    exclusive_record(root,'capture-runtime-measured-inputs.json',measured)
    journal=Journal(root,str(root),sha(canonical(index)))
    emergency=EmergencyCommands(root,namespace='controller')
    no_writers=lambda:capture_no_writers(root,reader)
    prepare,read_completion,publish_permit=capture_filesystem_controls(root,disk=disk,no_writers=no_writers)
    cli=CaptureOwnedCli(runner,reader,journal,
        lambda label,identity,owner:capture_memory_history(root,label,identity,owner),
        prepare,read_completion,publish_permit,lambda labels:stop_capture_owners(emergency,labels),
        output_reader=read_completion.output)
    review=CaptureReview(root,index,source,authority,disk,reader,cli,journal,no_writers,consumer_runner=runner)
    # A physical baseline is a capture observation, after authority and full
    # measured free-space binding, before the first production handoff.
    disk.sample('capture-before')
    return review,controller,binding


def execute_capture(root=CAPTURE_ROOT):
    review,controller,binding=construct_capture(root)
    result=review.execute()
    controller.observe('after')
    from kit_capture_package import capture_memory_inventory
    memory=capture_memory_inventory(root)
    exclusive_record(root,'capture-controller-complete.json',{
        'version':1,'root':CAPTURE_ROOT.as_posix(),'sourceBinding':binding,
        'captureTableSha256':CAPTURE_TABLE_SHA,'contentReceipt':{
            'file':'capture-receipt.json','sha256':sha(canonical(result)+b'\n'),'bytes':len(canonical(result)+b'\n')},
        'controllerRecords':controller.records,'memoryFiles':memory,
        'releaseAuthorityGranted':False,'releaseGateConsumed':False,'neverRetry':True})
    sync_capture_tree(root)
    # ExecStopPost independently stops all six owners and closes the unit.
    # This return alone is not a complete capture or package approval.
    return result
