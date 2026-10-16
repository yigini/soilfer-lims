"""Single-use reviewed snapshot -> owned installation -> stopped startup proof; never deploy."""
import os,pathlib,sys,datetime
from proof_contract import *
from proof_files import *
from proof_disk import Disk
from proof_docker import Docker,inspect,all_containers,preserved_containers
from proof_jobs import qualification
from proof_budget import copy_site_guard,EXPECTED_SITES
from proof_inputs import prior_records,retained_guard,record_inputs
from proof_health import load_health
from provenance_privacy import initialize_private_key,public_failure
from controller_guard import ControllerGuard
from proof_app_sources import APP_PINS,validate_sources,sources_from_tree
from proof_budget import capacity_probe_source,capacity_gate

def run():
    root=pathlib.Path(__file__).resolve().parent;exact_root(root)
    require(os.geteuid()==0 and sys.flags.optimize==0 and os.environ.get('NODE_OPTIONS','')=='','Plain root Python and blank outer heap required')
    spec=exact_json((root/'proof-input.json').read_bytes());index=exact_json((root/'tooling-source-index.json').read_bytes());review=exact_json((root/'source-review-original.json').read_bytes());approval(review,index)
    require(spec['scope']==SCOPE and spec['root']==str(ROOT) and spec['head']==CANDIDATE and spec['tree']==TREE and spec['image']==IMAGE and spec['toolingCommit']==index['head'] and spec['sourceReviewId']==review['id'],'Exact current proof specification required')
    require(spec['labAndHubBuildsOwnedByYY'] is True and spec['releaseWindowControl']=='RELEASE_DAY_DISK_ABORTS_ACCEPTED','YY workload pins missing')
    require(set(spec['packageHashes'])==FILES|set(PRIOR_FILES)|{'tooling-source-index.json','source-review-original.json','build-receipt.json','qualified-image-inspect-original.json','source-index.json','current-evidence.json','compose-source.yml'},'Closed package inventory required')
    require({p.name for p in root.iterdir()}==set(spec['packageHashes'])|{'proof-input.json'},'Consumed/expanded root')
    for name,digest in spec['packageHashes'].items():require(file_state(root/name)['sha256']==digest and file_state(root/name)['mode']==0o400,'Immutable package changed '+name)
    for name,digest in graph(index).items():require(file_state(root/name)['sha256']==digest,'Executed graph differs')
    copy_site_guard({n:(root/n).read_bytes() for n in EXPECTED_SITES})
    evidence=exact_json((root/'current-evidence.json').read_bytes());current(evidence['main'],evidence['ci'],evidence['prs'],evidence['verdicts'],evidence['comments']);rule_authorities(evidence['rules'],evidence['r2Accepted']);post_reboot_authorities(evidence['postRebootAuthorities']);memory_authority(evidence['memoryDirection']);jobs_scope_authority(evidence['jobsScope']);diagnostic_accepted(evidence['diagnosticAccepted'])
    step2_authorities(evidence['step2Authorities']);attempt_authorities(evidence['attemptAuthorities'])
    require(evidence['review']==review,'Bound source approval changed');no_later_failure(evidence['sourceComments'],review,index)
    raw=(root/'build-receipt.json').read_bytes();original_image=exact_json((root/'qualified-image-inspect-original.json').read_bytes())[0]
    qualified(exact_json(raw),raw,original_image)
    manifest=exact_json((root/'source-index.json').read_bytes());require(manifest['head']==CANDIDATE and manifest['tree']==TREE and sha((root/'source-index.json').read_bytes())==exact_json(raw)['applicationIndexSha256'],'Qualified raw application manifest differs')
    # Re-read original qualified artifacts; never rewrite/relaunch the build root.
    require(file_state(pathlib.Path(BUILD_ROOT)/'build-receipt.json')['sha256']==BUILD_RECEIPT_SHA and file_state(pathlib.Path(BUILD_ROOT)/'build-receipt.json')['mode']==0o400,'Remote qualified receipt changed')
    fresh_image=subprocess.check_output(['docker','image','inspect',IMAGE],timeout=15);require(exact_json(fresh_image)==[original_image],'Entire qualified image inspection differs')
    rows={r['path']:r for r in manifest['entries']}
    require(set(spec['applicationSourceFiles'])==set(APP_PINS) and spec.get('retryAllowed') is False,'Exact source graph and one attempt required')
    derivation=validate_sources(sources_from_tree(pathlib.Path(BUILD_ROOT)/'source'),rows);require(derivation==spec['applicationCopyDerivation'],'Application copy derivation changed')
    for n in spec['applicationSourceFiles']:
        require(n in rows and file_state(pathlib.Path(BUILD_ROOT)/'source'/n)['sha256']==rows[n]['sha256'],'Pinned build application source changed '+n)
    write_new(root/'proof-intent.json',{'status':'ATTEMPTED_ONCE_NOT_DEPLOYMENT','startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':SCOPE,'newProductionSnapshots':0,'priorEvidenceCommit':PRIOR_EVIDENCE,'productionSqliteConnections':0,'neverReplay':True})
    initialize_private_key(root);controller=ControllerGuard(root)
    import signal
    def interrupted(*_):raise RuntimeError('Controller termination: owned-stop and retain all, never retry')
    signal.signal(signal.SIGTERM,interrupted)
    disk=Disk(root);docker=Docker(root,disk);prior=None
    try:
        controller.observe('before')
        before=healthy_predecessor(inspect(PREDECESSOR_ID));write_new(root/'predecessor-before-selected.json',before)
        prior=all_containers();write_new(root/'container-inventory-before.json',prior)
        disk.topology_check('before');disk.sample('before')
        accepted=file_state(pathlib.Path(ACCEPTED_STARTUP_ROOT)/'proof-receipt.json');require(accepted['sha256']==ACCEPTED_STARTUP_RECEIPT_SHA and accepted['mode']==0o400,'Accepted233000 original startup receipt changed')
        inputs=prior_records(root);raw,assets=retained_guard(inputs)
        db_bytes=sum(max(r['allocatedBytes'],((r['bytes']+4095)//4096)*4096) for r in raw.values() if r)
        backup_state=file_state(PRIOR_BACKUP);db_bytes=max(db_bytes,max(backup_state['allocatedBytes'],((backup_state['bytes']+4095)//4096)*4096))
        capacity_raw=subprocess.check_output(['/usr/bin/python3','-B','-'],input=capacity_probe_source(PRIOR_RAW_DATA,PRIOR_RAW_ASSETS,PRIOR_BACKUP,'RUNTIME_BIND'),timeout=45)
        capacity=exact_json(capacity_raw);write_new(root/'fresh-r4-before-proof-copies.json',capacity);capacity_gate(capacity,'RUNTIME_BIND',0)
        require(capacity['databaseReserveBytes']==db_bytes and capacity['assetReserveBytes']==assets['allocatedBytes'],'Fresh stat and fullhash input allocation differ')
        disk.bind(db_bytes,assets['allocatedBytes']);installed,installed_state=record_inputs(root,inputs)
        write_new(root/'derived-healthcheck.json',load_health(root))
        startups=qualification(root,installed,installed_state,pathlib.Path(PRIOR_RAW_ASSETS),docker,disk,spec['expectedReadyEvents'],spec['expectedEntrypointVerifiers'],lambda:retained_guard(inputs))
        docker.stop_all();retained_guard(inputs)
        require(healthy_predecessor(inspect(PREDECESSOR_ID))==before,'Normal predecessor changed')
        preserved_containers(prior,all_containers());disk.topology_check('after')
        require(disk.budget.completed==len(TABLE) and disk.budget.active is None,'Declared forward stages incomplete');accounting=disk.sample('terminal')
        write_new(root/'live-evolution-terminal.json',live_metadata_observation())
        controller.observe('after')
        write_new(root/'proof-receipt.json',{'status':'STEP2_RUNTIME_CHECKS_COMPLETE_AWAITING_EXEC_STOP_POST_NOT_DEPLOYED','closedUtc':utc_now(),'head':CANDIDATE,'tree':TREE,'image':IMAGE,'qualifiedBuildReceiptSha256':BUILD_RECEIPT_SHA,'toolingCommit':index['head'],'sourceReviewId':review['id'],'scope':SCOPE,'priorEvidenceCommit':PRIOR_EVIDENCE,'priorProofRoot':str(PRIOR_ROOT),'newProductionSnapshots':0,'newInstallerOrPolicyCalls':0,'diagnosticAcceptedId':6206990387,'prechecksAcceptedId':6210719791,'prechecksAcceptanceSemanticSha256':ATTEMPT_AUTHORITY_PINS['6210719791'],'controllerMemoryGuardPassed':True,'stopPostRequiredBeforeIndependentAcceptance':True,'qualificationPendingExecStopPost':True,'publicValuesHmacSha256':True,'installed209InputsByHashStatOnly':True,'derivedHealthcheck':load_health(root),'productionMutations':0,'productionSqliteConnections':0,'installedBackup':str(installed),'startups':startups,'allOwnedContainersStoppedRetained':True,'allHistoricalStoppedContainersPreserved':True,'rawMasterNeverOpenedSqlite':True,'accounting':accounting,'databaseHandoffUtc':inputs['prior-fresh-actual-baseline.json']['databaseHandoffUtc'],'assetHandoffUtc':inputs['prior-fresh-actual-baseline.json']['assetHandoffUtc'],'databaseAssetsCrossFileAtomicityClaimed':False,'laterLiveEvolutionIsObservationOnly':True,'jobsOnQualificationStillRequired':False,'nonzeroImpactListsNeedYYBeforeGate':True,'exactKitReviewRequired':True,'freshSingleUseGateRequired':True,'releaseKit':None,'gate':None,'deployments':0,'neverReplay':True})
    except BaseException as error:
        stop_error=None
        try:docker.stop_all()
        except BaseException as stopped:stop_error=public_failure(stopped)
        observation_error=None
        try:
            if not (root/'live-evolution-terminal.json').exists():write_new(root/'live-evolution-terminal.json',live_metadata_observation())
        except BaseException as observed:observation_error=public_failure(observed)
        write_new(root/'proof-terminal-refusal.json',{'status':'FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY','closedUtc':utc_now(),'error':public_failure(error),'ownedStopError':stop_error,'terminalMetadataObservationError':observation_error,'allRawFilesAndStoppedContainersMustRemain':True,'productionMutations':0,'productionSqliteConnections':0,'newProductionSnapshots':0,'neverRetry':True,'recovery':'SEPARATELY_AUDITED_FORWARD_FIX_ONLY'})
        raise RuntimeError('Proof refused; private details retained, no retry') from None
if __name__=='__main__':
    import subprocess
    run()
