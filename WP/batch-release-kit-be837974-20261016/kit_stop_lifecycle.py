"""Stop-post policy bodies embedded into the standalone generated hook.

All eligible CLI owners are handled before source/receipt/memory validation.
Only a fully validated terminal permit may leave the candidate serving. There
is no restart, restore, retry, cleanup, database connection or imported action.
"""
import pathlib
import re
import stat
from kit_contract import HEAD,IMAGE,canonical,require,sha
from retained_contract import ROOT,exact_json
from kit_journal import exclusive_record
from kit_owned import LABEL
from kit_runtime import (PREDECESSOR_ID,PREDECESSOR_IMAGE,CANDIDATE_OWNER,VOLUMES,
    full_mounts,predecessor_projection,candidate_projection)
from kit_stop import stop_cli_owners
from kit_frozen import frozen_source_bytes,kit_review
from controller_output import controller_output_closure


def private_file(root,name,maximum=16*1024**2):
    root=pathlib.Path(root)
    require(isinstance(name,str) and re.fullmatch('[A-Za-z0-9][A-Za-z0-9_./-]{0,200}',name) and
        not any(part in ('.','..','') for part in name.split('/')),'Exact owned private file path required')
    path=root/name
    for part in (path,*path.parents):require(not part.is_symlink(),'Private hook input alias refused')
    s=path.stat()
    require(stat.S_ISREG(s.st_mode) and stat.S_IMODE(s.st_mode)==0o400 and 0<s.st_size<=maximum,
        'Complete immutable bounded hook input required')
    raw=path.read_bytes();require(len(raw)==s.st_size,'Hook input changed while reading')
    return raw


def frozen_hook_authority(root):
    manifest=exact_json(private_file(root,'frozen-manifest.json'))
    index=exact_json(private_file(root,'source-index.json'))
    source=exact_json(private_file(root,'source-review.json'))
    review=exact_json(private_file(root,'exact-kit-review.json'))
    kit_review(review,manifest,index,source)
    frozen_source_bytes(pathlib.Path(root)/'tooling',index)
    files=manifest.get('packageFiles')
    require(isinstance(files,dict) and 1<=len(files)<=1024 and
        sum(pin.get('bytes',0) for pin in files.values() if isinstance(pin,dict))<=128*1024**2 and
        sha(canonical(files))==manifest['packageFilesSha256'],'Exact full frozen package file map required')
    for name,pin in files.items():
        raw=private_file(root,name)
        require(isinstance(pin,dict) and set(pin)=={'sha256','bytes'} and
            sha(raw)==pin['sha256'] and len(raw)==pin['bytes'],'Frozen package input changed')
    require(all(files.get('tooling/'+name)=={'sha256':pin['sha256'],'bytes':pin['bytes']}
        for name,pin in index['files'].items()),'Frozen package omitted a reviewed tooling file')
    return manifest


def serving_permit(root,manifest,call):
    permit=exact_json(private_file(root,'controller-completion-permit.json'))
    raw=private_file(root,'production-receipt.json');receipt=exact_json(raw)
    require(permit.get('root')==receipt.get('root')==str(ROOT) and
        permit.get('manifestSha256')==receipt.get('sourceManifestSha256')==sha(canonical(manifest)) and
        receipt.get('head')==HEAD and receipt.get('image')==IMAGE and permit.get('status')==receipt.get('status') and
        permit.get('receipt',{}).get('file')=='production-receipt.json' and
        permit['receipt'].get('sha256')==sha(raw) and permit['receipt'].get('bytes')==len(raw),
        'Complete atomic terminal receipt/permit binding required')
    consumed=exact_json(private_file(root,'production-gate-consumed.json'))
    require(consumed.get('manifestSha256')==sha(canonical(manifest)) and consumed.get('exclusive') is True,
        'Actual consumed single-use gate required')
    require(receipt.get('ingressReopened') is True and not receipt.get('holdErrors'),
        'Serving permit may not conceal a failed ingress rehold/owner stop')
    # The transport closes AFTER the real controller exits. A missing, partial,
    # overflowing or mutated original defeats even an otherwise valid permit.
    controller_output_closure(root,0 if receipt['status']=='DEPLOYED_AWAITING_CLAUDIO_POSTCHECK' else 1)
    if receipt['status']=='DEPLOYED_AWAITING_CLAUDIO_POSTCHECK':
        require(receipt.get('anyApplyAttempted') is True and receipt.get('anyEntrypointAttempted') is True and
            permit.get('candidateId')==receipt.get('candidateId') and
            re.fullmatch('[a-f0-9]{64}',receipt.get('candidateId','')),
            'Exact deployed candidate receipt required')
        intent=exact_json(private_file(root,'candidate-stop-intent.json'))
        spec=intent['privateSpecification']
        require(intent.get('intent')==permit.get('candidateIntent')==receipt.get('candidateIntent') and
            intent['intent'].get('specificationSha256')==sha(canonical(spec)),
            'Exact durable candidate specification required')
        rows=exact_json(call(['docker','inspect',receipt['candidateId']]))
        require(isinstance(rows,list) and len(rows)==1,'Exact serving candidate inspection required')
        current=candidate_projection(rows[0],spec,True)
        require(current==receipt.get('candidateStartedIdentity')==exact_json(private_file(root,'candidate-started-identity.json')) and
            rows[0]['State'].get('Health',{}).get('Status')=='healthy' and
            receipt.get('candidateMemory',{}).get('hostBeforeControllerExitEventsChecked') is True and
            receipt.get('firstSync',{}).get('sealedBeforeIngressReopens') is True and
            receipt.get('postflights',{}).get('fullAllColumnStatePreserved') is True and
            receipt.get('secondSync',{}).get('secondReceiptOnlyAfterReopen') is True,
            'Serving candidate changed or final preservation/memory/receipts incomplete')
        return {'status':receipt['status'],'leaveCandidateServing':True,'id':receipt['candidateId']}
    require(receipt['status']=='ABORTED_PRE_APPLY_PREDECESSOR_RECOVERED' and
        receipt.get('anyApplyAttempted') is False and receipt.get('anyEntrypointAttempted') is False and
        receipt.get('preApplyRecoveryProof',{}).get('mainWalShmHashAndLengthExact') is True,
        'No other terminal status permits a serving container')
    ready=receipt.get('predecessorAbortReady',{})
    require(ready.get('id')==PREDECESSOR_ID and ready.get('sameRetainedPredecessor') is True and
        ready.get('configurationChanged') is False and ready.get('noDatabaseRestore') is True,
        'Exact verified same-predecessor recovery required')
    rows=exact_json(call(['docker','inspect',PREDECESSOR_ID]));original=exact_json(private_file(root,'predecessor-inspect-original.json'))
    require(isinstance(rows,list) and len(rows)==1,'Exact recovered predecessor inspection required')
    old=predecessor_projection(original);now=predecessor_projection(rows[0]);state=rows[0]['State']
    old['startedAt']=ready.get('startedAt')
    require(now==old and state.get('Running') is True and state.get('Health',{}).get('Status')=='healthy' and
        state.get('OOMKilled') is False and rows[0].get('RestartCount')==0,
        'Recovered predecessor no longer has its exact verified identity/configuration/health')
    return {'status':receipt['status'],'leaveCandidateServing':False,'leaveSameRecoveredPredecessorServing':True,'id':PREDECESSOR_ID}


def stop_candidate_compiled(call):
    raw=call(['docker','ps','-aq','--no-trunc','--filter','label='+LABEL+'='+CANDIDATE_OWNER])
    ids=raw.decode('ascii').splitlines()
    require(len(raw)<=512*1024 and len(ids)<=1 and len(ids)==len(set(ids)) and
        all(re.fullmatch('[a-f0-9]{64}',identity) for identity in ids),'Complete exact candidate owner inventory required')
    if not ids:return {'observedAbsent':True,'nonvacuousStop':False}
    identity=ids[0];rows=exact_json(call(['docker','inspect',identity]))
    require(isinstance(rows,list) and len(rows)==1 and rows[0].get('Id')==identity,'Exact candidate ID required')
    value=rows[0];mounts=full_mounts(value);named={m.get('Name') for m in mounts if m.get('Type')=='volume'}
    require(named in ({'lims_lims-data','lims_lims-assets'},set(VOLUMES)) and len(mounts)==len(named)+1,
        'Compiled exact candidate named volumes/tmp required before stop')
    expected=[{'Type':'volume','Name':name,'Source':VOLUMES[name][1],'Destination':VOLUMES[name][0],'RW':True}
        for name in sorted(named)]
    expected.append({'Type':'bind','Source':str(ROOT/'candidate-retained-temp'),'Destination':'/tmp','RW':True})
    spec={'owner':CANDIDATE_OWNER,'name':'soilfer-lims','head':HEAD,'image':IMAGE,'neverRetry':True,'mounts':expected}
    before=candidate_projection(value,spec,emergency=True)
    if before['running']:call(['docker','stop','-t','10',identity])
    rows=exact_json(call(['docker','inspect',identity]));require(isinstance(rows,list) and len(rows)==1 and rows[0].get('Id')==identity,
        'Exact retained candidate inspection required')
    after=candidate_projection(rows[0],spec,False,emergency=True)
    require(all(before[k]==after[k] for k in ('id','owner','name','image','startedAt','mounts','configSha256','hostConfigSha256')),
        'Candidate identity/configuration changed during independent stop')
    return {'id':identity,'stoppedAndRetained':True,'nonvacuousStop':True,'actualExitCode':rows[0]['State'].get('ExitCode')}


def stop_restarted_predecessor(root,call):
    # No automatic restart is ever performed by this hook. The original old
    # container is eligible only after the durable one-time early restart intent.
    intents=list(pathlib.Path(root).glob('phase-*-preapplypredecessorrestartintent.json'))
    if not intents:return {'noPreApplyRestartIntentObserved':True}
    require(len(intents)==1 and exact_json(private_file(root,intents[0].name)).get('phase')=='preApplyPredecessorRestartIntent',
        'Ambiguous same-predecessor restart intent')
    original=exact_json(private_file(root,'predecessor-inspect-original.json'))
    rows=exact_json(call(['docker','inspect',PREDECESSOR_ID]));require(isinstance(rows,list) and len(rows)==1,'Exact predecessor inspection required')
    before=predecessor_projection(rows[0]);old=predecessor_projection(original)
    old['startedAt']=before['startedAt'];require(before==old,'Same restarted predecessor configuration differs')
    if rows[0]['State']['Running']:call(['docker','stop','-t','10',PREDECESSOR_ID])
    rows=exact_json(call(['docker','inspect',PREDECESSOR_ID]));require(isinstance(rows,list) and len(rows)==1 and
        predecessor_projection(rows[0])==before and rows[0]['State']['Running'] is False,
        'Same restarted predecessor remains running or changed')
    return {'id':PREDECESSOR_ID,'stoppedAndRetained':True,'actualExitCode':rows[0]['State'].get('ExitCode')}


def stop_post_lifecycle(root,call,validate_serving,hold,controller,retain):
    result={'root':str(ROOT),'head':HEAD,'image':IMAGE,'errors':[],'postStopErrors':[],
        'noRetryRestoreRemovalOrRestart':True,'candidateLeavePermission':None}
    def attempt(phase,action):
        try:return action()
        except BaseException as error:result['errors'].append({'phase':phase,'errorType':type(error).__name__});return None
    result['cliOwners']=attempt('allExactCliOwners',lambda:stop_cli_owners(call))
    if result['cliOwners'] is not None:
        result['errors']+=result['cliOwners']['errors']
    # Source/receipt/controller failures cannot prevent the eligible CLI stops
    # above, or the exact candidate/restarted predecessor stop attempts below.
    leave=attempt('terminalServingPermission',validate_serving) if not result['errors'] else None
    result['controller']=attempt('controllerFinalMemoryEvents',controller)
    if leave is not None and not leave.get('leaveCandidateServing'):
        result['candidate']=attempt('exactCandidateAbsenceAfterRecovery',lambda:stop_candidate_compiled(call))
        if result['candidate'] is not None and result['candidate'].get('observedAbsent') is not True:
            result['errors'].append({'phase':'candidateExistsAfterPreApplyRecovery','errorType':'UnexpectedCandidate'})
    if result['errors'] or getattr(call,'retention_errors',None):leave=None
    if leave is None:
        # A consumed gate can have an unknown503 transition. It is treated as
        # requiring maintenance even if no candidate creation was observed.
        if (pathlib.Path(root)/'production-gate-consumed.json').exists():
            result['hold503']=attempt('independentRehold503',hold)
        if 'candidate' not in result:result['candidate']=attempt('exactCandidateStop',lambda:stop_candidate_compiled(call))
        result['restartedPredecessor']=attempt('samePredecessorRecoveryStop',lambda:stop_restarted_predecessor(root,call))
        result['controllerAfterStops']=attempt('controllerAfterExactStops',controller)
    else:
        result['candidateLeavePermission']=leave
    # Private command-retention failures are material even when the command
    # itself succeeded. Every eligible stop has nevertheless been attempted.
    if getattr(call,'retention_errors',None):
        result['errors'].append({'phase':'originalCommandRetention','errorType':'RetentionIncomplete'})
    try:retain(result)
    except BaseException as error:result['postStopErrors'].append({'phase':'hookReceiptRetention','errorType':type(error).__name__})
    return result
