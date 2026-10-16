"""Concrete Linux runtime construction for the reviewed exact release root.

Import is inert. construct() requires a valid complete immutable frozen kit
and exact controller cgroup before any Docker/API call. All application
mutations still occur only through ProductionOps after fresh gate consumption.
The proposed root has not been created or run by developing this source.
"""
import os
import pathlib
import time
from kit_contract import HEAD,IMAGE,IMAGE_BYTES,READY_SECONDS,canonical,sha,require
from retained_contract import ROOT,LIVE_DATA,exact_json
from kit_journal import Journal,exclusive_record
from kit_stop_lifecycle import frozen_hook_authority,private_file
from kit_frozen import kit_review
from kit_authority import Authority,reviewed_plan
from kit_provider import GitHubProvider
from kit_io import CommandRunner
from kit_docker import ContainerReader,configure_reader
from retained_controller import ControllerGuard
from retained_memory import MemoryHistory
from retained_privacy import initialize_private_key
from retained_health import load_health
from kit_budget import Budget,RECOVERY_FIXED,RECOVERY_DB_COPIES
from kit_disk import Disk,measure_inputs
from kit_owned import OwnedCli,filesystem_controls
from kit_stop import EmergencyCommands,stop_cli_owners
from kit_emergency_ingress import EmergencyIngress
from kit_ingress import CONF,Http,Ingress
from kit_runtime import PREDECESSOR_ID,CANDIDATE_OWNER,candidate_spec,ExactPredecessor,Candidate
from kit_ops import ProductionOps,BudgetedCli
from kit_install import Installations
from kit_natural import NaturalIntake
from kit_readiness import Readiness
from kit_recovery import RecoveryReadiness
from kit_probes import Probes
from kit_no_writers import assert_no_volume_writers
from kit_consumer_inventory import collect
from kit_evidence import bind_runtime,admit_evidence


class ResourceGuard:
    def __init__(self,controller,clock=time.monotonic):
        self.controller=controller;self.clock=clock;self.disk=None;self.number=0;self.last=None
    def bind(self,disk):
        require(self.disk is None,'Production resource guard already bound');self.disk=disk
    def __call__(self,needed=0):
        require(self.disk is not None,'No production command before full measured budget binding')
        self.disk.check(needed)
        now=self.clock()
        if self.last is None or now-self.last>=1:
            self.number+=1
            self.controller.observe('watch-'+str(self.number).zfill(6));self.last=now


def exact_candidate_tmp(root):
    path=pathlib.Path(root)/'candidate-retained-temp'
    require(path.parent==pathlib.Path(root) and not path.is_symlink(),'Exact candidate retained temp required')
    path.mkdir(mode=0o700)
    require(not list(path.iterdir()),'New candidate temp must be empty')


def construction_inputs(root):
    require(os.name=='posix' and pathlib.Path(root)==ROOT,'Linux exact production root required')
    root=pathlib.Path(root);manifest=frozen_hook_authority(root)
    read=lambda name:exact_json(private_file(root,name))
    index=read('source-index.json');source=read('source-review.json');kit=read('exact-kit-review.json')
    result=kit_review(kit,manifest,index,source)
    confirmation=read('yy-confirmation.json');disclosure=read('whole-outage-disclosure.json')
    plan=reviewed_plan(manifest,disclosure,result)
    profile=read('tooling/predecessor-copy-source-binding.json')
    from kit_recovery_copy import HEAD as OLD_HEAD,FIXED_BYTES
    require(profile.get('head')==OLD_HEAD and profile.get('maximumStartupDatabaseCopies')==RECOVERY_DB_COPIES==0 and
        profile.get('fixedAllocationBytesIncludingMarkersAndDirectories')==RECOVERY_FIXED==FIXED_BYTES,
        'Frozen same-predecessor source/budget branch differs')
    return root,manifest,index,source,kit,confirmation,disclosure,plan


def construct(root=ROOT):
    root,manifest,index,source,kit,confirmation,disclosure,plan=construction_inputs(root)
    evidence=bind_runtime(root)
    # The independent standalone hook compares this exact BEFORE boundary to
    # its post-stop numeric PID/cgroup reads. No call uses /proc/self aliases.
    controller=ControllerGuard(root);controller.observe('before')
    inputs=measure_inputs()
    budget=Budget(inputs['databaseAllocatedBytes'],inputs['assetsAllocatedBytes'],IMAGE_BYTES)
    guard=ResourceGuard(controller)
    runner=CommandRunner(root,guard)
    reader=ContainerReader(runner,PREDECESSOR_ID)
    disk=Disk(root,reader,runner,budget);guard.bind(disk);guard(0)
    configure_reader(reader)
    exclusive_record(root,'runtime-measured-inputs.json',inputs)
    # Preserve the accepted private-key initializer unchanged. Its fixed
    # 32-byte key JSON has a full pre-write allocation in the common ledger.
    admit_evidence(root/'private-value-hmac-key.json',512)
    initialize_private_key(root)
    journal=Journal(root,str(root),sha(canonical(manifest)))
    emergency=EmergencyCommands(root,namespace='controller')
    def stop_clis(labels=None):return stop_cli_owners(emergency,labels)
    provider=GitHubProvider(runner,'runtime-authority')
    original=private_file(root,'ingress-original.conf');held=private_file(root,'ingress-held.conf')
    # Read current ingress bytes without interpreting or altering historical
    # templates. Its complete desired bytes have independent source/kit review.
    def ingress_reader():
        for part in (CONF,*CONF.parents):require(not part.is_symlink(),'Current Apache path alias refused')
        require(CONF.is_file() and CONF.stat().st_size<=1024**2,'Bounded existing Apache configuration required')
        return CONF.read_bytes()
    def image_reader():
        raw,err,_=runner.run(['docker','image','inspect',IMAGE],'current-qualified-image',15)
        rows=exact_json(raw);require(not err and isinstance(rows,list) and len(rows)==1,'One exact current qualified image required')
        return rows[0]
    authority=Authority(root,provider,manifest,index,source,kit,confirmation,disclosure,
        lambda label:collect(reader,runner,namespace='runtime-consumer-'+label),ingress_reader,image_reader)
    http=Http(root,runner)
    ingress=Ingress(root,runner,http,original,held,manifest['originalIngressSha256'],manifest['heldIngressSha256'])
    emergency_ingress=EmergencyIngress(root,emergency,original,held,manifest['originalIngressSha256'],manifest['heldIngressSha256'])
    observed=reader.inspect(PREDECESSOR_ID)
    predecessor=ExactPredecessor(observed,runner,reader,emergency,journal)
    spec=candidate_spec(observed,load_health(root/'tooling'))
    candidate=Candidate(spec,runner,reader,journal,lambda:exact_candidate_tmp(root))
    prepare,read_completion,publish_permit=filesystem_controls(root)
    owned=OwnedCli(runner,reader,journal,lambda label,identity,owner:MemoryHistory(root,label,identity,owner),
        prepare,read_completion,publish_permit,stop_clis)
    cli=BudgetedCli(owned,disk)
    no_writers=lambda:assert_no_volume_writers(reader)
    installations=Installations(root,pathlib.Path(LIVE_DATA)/'dev.db',cli,journal,disk.check,no_writers,authority.review_impact)
    events=exact_json(private_file(root,'tooling/startup-expectations.json'))
    require(events.get('head')==HEAD and events.get('entrypointVerifiers')==27,'Exact startup expectations required')
    def monitor_factory(identity,began,inspect_candidate):
        return Readiness(root,runner,inspect_candidate,MemoryHistory(root,'candidate',identity,CANDIDATE_OWNER),events['events'],began)
    natural_factory=lambda baseline,state,inspect_candidate:NaturalIntake(root,baseline,state,cli,runner,inspect_candidate,None,journal)
    probes_factory=lambda monitor:Probes(root,root/'tooling',runner,cli,monitor,journal)
    recovery=RecoveryReadiness(root,runner,exact_json(private_file(root,'tooling/predecessor-startup-expectations.json')))
    ops=ProductionOps(authority,root,journal,runner,reader,disk,controller,cli,ingress,emergency_ingress,
        predecessor,candidate,installations,natural_factory,monitor_factory,probes_factory,stop_clis,recovery)
    return ops,plan
