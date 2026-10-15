"""Single-use reviewed snapshot -> owned installation -> stopped startup proof; never deploy."""
import os,pathlib,sys,datetime
from proof_contract import *
from proof_files import *
from proof_disk import Disk
from proof_docker import Docker,inspect,all_containers,preserved_containers
from proof_install import install
from proof_startup import startup
from proof_budget import copy_site_guard,EXPECTED_SITES

def run():
    root=pathlib.Path(__file__).resolve().parent;exact_root(root)
    require(os.geteuid()==0 and sys.flags.optimize==0 and os.environ.get('NODE_OPTIONS','')=='','Plain root Python and blank outer heap required')
    spec=exact_json((root/'proof-input.json').read_bytes());index=exact_json((root/'tooling-source-index.json').read_bytes());review=exact_json((root/'source-review-original.json').read_bytes());approval(review,index)
    require(spec['scope']==SCOPE and spec['root']==str(ROOT) and spec['head']==CANDIDATE and spec['tree']==TREE and spec['image']==IMAGE and spec['toolingCommit']==index['head'] and spec['sourceReviewId']==review['id'],'Exact current proof specification required')
    require(spec['labAndHubBuildsOwnedByYY'] is True and spec['releaseWindowControl']=='RELEASE_DAY_DISK_ABORTS_ACCEPTED','YY workload pins missing')
    require(set(spec['packageHashes'])==FILES|{'tooling-source-index.json','source-review-original.json','build-receipt.json','qualified-image-inspect-original.json','source-index.json','current-evidence.json'},'Closed package inventory required')
    require({p.name for p in root.iterdir()}==set(spec['packageHashes'])|{'proof-input.json'},'Consumed/expanded root')
    for name,digest in spec['packageHashes'].items():require(file_state(root/name)['sha256']==digest and file_state(root/name)['mode']==0o400,'Immutable package changed '+name)
    for name,digest in graph(index).items():require(file_state(root/name)['sha256']==digest,'Executed graph differs')
    copy_site_guard({n:(root/n).read_bytes() for n in EXPECTED_SITES})
    evidence=exact_json((root/'current-evidence.json').read_bytes());current(evidence['main'],evidence['ci'],evidence['prs'],evidence['verdicts'],evidence['comments'])
    require(evidence['review']==review,'Bound source approval changed');no_later_failure(evidence['sourceComments'],review,index)
    raw=(root/'build-receipt.json').read_bytes();original_image=exact_json((root/'qualified-image-inspect-original.json').read_bytes())[0]
    qualified(exact_json(raw),raw,original_image)
    manifest=exact_json((root/'source-index.json').read_bytes());require(manifest['head']==CANDIDATE and manifest['tree']==TREE and sha((root/'source-index.json').read_bytes())==exact_json(raw)['applicationIndexSha256'],'Qualified raw application manifest differs')
    # Re-read original qualified artifacts; never rewrite/relaunch the build root.
    require(file_state(pathlib.Path(BUILD_ROOT)/'build-receipt.json')['sha256']==BUILD_RECEIPT_SHA and file_state(pathlib.Path(BUILD_ROOT)/'build-receipt.json')['mode']==0o400,'Remote qualified receipt changed')
    fresh_image=subprocess.check_output(['docker','image','inspect',IMAGE],timeout=15);require(exact_json(fresh_image)==[original_image],'Entire qualified image inspection differs')
    rows={r['path']:r for r in manifest['entries']}
    for n in spec['applicationSourceFiles']:
        require(n in rows and file_state(pathlib.Path(BUILD_ROOT)/'source'/n)['sha256']==rows[n]['sha256'],'Pinned build application source changed '+n)
    write_new(root/'proof-intent.json',{'status':'ATTEMPTED_ONCE_NOT_DEPLOYMENT','startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':SCOPE,'rawSnapshotCollected':False,'productionSqliteConnections':0,'neverReplay':True})
    disk=Disk(root);docker=Docker(root,disk);prior=None;raw_master=None
    try:
        before=healthy_predecessor(inspect(PREDECESSOR_ID));write_new(root/'predecessor-before-selected.json',before)
        prior=all_containers();write_new(root/'container-inventory-before.json',prior)
        disk.topology_check('before');disk.sample('before')
        source=pathlib.Path(LIVE_DATA)/'dev.db';original=triple(source,root);assets=tree_state(LIVE_ASSETS,root)
        db_bytes=sum(max(r['allocatedBytes'],((r['bytes']+4095)//4096)*4096) for r in original.values() if r)
        disk.bind(db_bytes,assets['allocatedBytes']);disk.begin_stage('fresh-snapshot')
        # All SQLite I/O is inside seal's detached reader; source is filesystem-only.
        baseline,state=seal(root,'fresh-production-snapshot',source,disk.check,live_source=True)
        raw_master=root/'fresh-production-snapshot/raw/dev.db';raw_identity=triple(raw_master)
        raw_assets=root/'raw-production-assets';copy_tree(LIVE_ASSETS,raw_assets,disk.check,live_source=True,handoff_path=root/'assets-snapshot-handoff.json')
        db_handoff=exact_json((root/'fresh-production-snapshot/raw/snapshot-handoff.json').read_bytes());asset_handoff=exact_json((root/'assets-snapshot-handoff.json').read_bytes())
        write_new(root/'live-evolution-after-snapshot.json',live_metadata_observation())
        require(healthy_predecessor(inspect(PREDECESSOR_ID))==before,'Predecessor changed during collection')
        write_new(root/'fresh-actual-baseline.json',{'tableCount':len(state['tables']),'schemaReceiptCount':state['tables']['_schema_migrations']['count'],'snapshotBackup':str(baseline),'sourceCountsObservedOnlyAfterReviewedCopy':True,'databaseHandoffUtc':db_handoff['handoffUtc'],'assetHandoffUtc':asset_handoff['handoffUtc'],'databaseAssetsCrossFileAtomicityClaimed':False,'allDbWalShmRetained':True,'productionSqliteConnections':0})
        require(len(state['tables'])==106 and state['tables']['_schema_migrations']['count']==39 and state['tables']['User']['count']>0,'Actual baseline differs; no seed/schema initialization authorized')
        disk.finish_stage('fresh-snapshot')
        installed,installed_state=install(root,baseline,docker,disk)
        startups=startup(root,installed,installed_state,raw_assets,docker,disk,spec['expectedReadyEvents'],spec['expectedEntrypointVerifiers'])
        docker.stop_all();require(triple(raw_master)==raw_identity,'Raw production master changed')
        require(identity_record(tree_state(raw_assets)['files'])==asset_handoff['rawCopyByteIdentity'],'Raw asset master changed')
        write_new(root/'live-evolution-terminal.json',live_metadata_observation())
        healthy_predecessor(inspect(PREDECESSOR_ID));preserved_containers(prior,all_containers());disk.topology_check('after');require(disk.budget.completed==len(TABLE) and disk.budget.active is None,'Declared proof stages incomplete');accounting=disk.sample('terminal')
        write_new(root/'proof-receipt.json',{'status':'STOPPED_COPY_INSTALLATION_AND_JOBS_OFF_STARTUP_PASS_NOT_RELEASE_QUALIFIED','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':CANDIDATE,'tree':TREE,'image':IMAGE,'qualifiedBuildReceiptSha256':BUILD_RECEIPT_SHA,'toolingCommit':index['head'],'sourceReviewId':review['id'],'scope':SCOPE,'productionMutations':0,'productionSqliteConnections':0,'installedBackup':str(installed),'startups':startups,'allOwnedContainersStoppedRetained':True,'allHistoricalStoppedContainersPreserved':True,'rawMasterNeverOpenedSqlite':True,'accounting':accounting,'databaseHandoffUtc':db_handoff['handoffUtc'],'assetHandoffUtc':asset_handoff['handoffUtc'],'databaseAssetsCrossFileAtomicityClaimed':False,'laterLiveEvolutionIsObservationOnly':True,'jobsOnQualificationStillRequired':True,'nonzeroImpactListsNeedYYBeforeGate':True,'exactKitReviewRequired':True,'freshSingleUseGateRequired':True,'releaseKit':None,'gate':None,'deployments':0,'neverReplay':True})
    except BaseException as error:
        stop_error=None
        try:docker.stop_all()
        except BaseException as stopped:stop_error=str(stopped)
        observation_error=None
        try:
            if not (root/'live-evolution-terminal.json').exists():write_new(root/'live-evolution-terminal.json',live_metadata_observation())
        except BaseException as observed:observation_error=type(observed).__name__+': '+str(observed)
        write_new(root/'proof-terminal-refusal.json',{'status':'FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'error':type(error).__name__+': '+str(error),'ownedStopError':stop_error,'terminalMetadataObservationError':observation_error,'allRawFilesAndStoppedContainersMustRemain':True,'productionMutations':0,'productionSqliteConnections':0,'neverRetry':True,'recovery':'SEPARATELY_AUDITED_FORWARD_FIX_ONLY'})
        raise
if __name__=='__main__':
    import subprocess
    run()
