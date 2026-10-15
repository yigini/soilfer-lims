"""Exactly one forward 206/214/209 installation on an owned copy. No historical applies."""
from proof_contract import *
from proof_files import *

def install(root,baseline_backup,docker,disk):
    target=clone_backup(root,'installation-target',baseline_backup,disk.check)
    # Canonical policy MUST already be present. This graph never creates/normalizes policy.
    policy_before=triple(target/'dev.db')
    policy=docker.cli('policy-canonical-noop',target,'install_lab_policy_schema.js','--apply')
    write_new(root/'policy-result.json',policy)
    policy_gate(policy)
    require(triple(target/'dev.db')==policy_before,'Policy changed original triple')
    previous=baseline_backup;results=[];impact=None
    for issue,script,tables,marker in CHAIN:
        if issue=='209':
            original=triple(target/'dev.db');impact=docker.cli('actual-order-impact',target,'order_revision_impact.js')
            write_new(root/'actual-order-impact.json',impact)
            require(impact.get('access')=='RETAINED_SNAPSHOT_ONLY' and impact.get('originalFilesPreserved') is True and impact.get('totalChanges')==0 and impact.get('backfilledCount')==0 and impact.get('retainedAllocation',{}).get('allocationMeasured') is True,'Retained order impact is incomplete')
            retained=root/'actual-order-impact-retained-temp';allocation=impact['retainedAllocation'];primary=impact.get('readonlySnapshot',{}).get('path','')
            require(primary.startswith('/tmp/') and impact['readonlySnapshot'].get('originalFilesPreserved') is True,'Primary retained snapshot boundary missing')
            primary_host=child_path(retained,retained/primary.removeprefix('/tmp/'))
            require(primary_host.is_file(),'Primary retained snapshot absent')
            snapshots=[]
            for row in allocation.get('files',[]):
                require(row['path'].startswith('/tmp/'),'Retained allocation escaped owned TMPDIR')
                host=child_path(retained,retained/row['path'].removeprefix('/tmp/'));actual=file_state(host)
                require(actual is not None and actual['bytes']==row['bytes'] and actual['sha256']==row['sha256'] and actual['allocatedBytes']==row['allocatedBytes'],'Independent retained allocation hash/physical bytes differ')
                if host.name=='snapshot.db':snapshots.append(str(host))
            require(len(snapshots)>=2 and str(primary_host) in snapshots,'Secondary retained prerequisite snapshot not independently present')
            write_new(root/'order-impact-independent-snapshots.json',{'primary':str(primary_host),'secondarySnapshots':snapshots,'verifiedRetainedFiles':len(allocation['files']),'allocation':allocation,'allOriginalTripleBytesPreserved':True})
            require(triple(target/'dev.db')==original,'Order impact changed target triple');impact_gate(impact)
        if issue=='214':
            # Uses ordinary actual policy/QC precedence on an owned copy; no synthetic production counts.
            chart=docker.cli('actual-chart-prebinding-impact',target,'control_chart_prebinding_impact.js')
            write_new(root/'actual-chart-impact.json',chart)
            require(chart.get('access')=='SQLITE_READONLY_SNAPSHOT' and chart.get('productionMutations')==0 and isinstance(chart.get('controlChartContexts'),list) and isinstance(chart.get('affectedRuns'),list),'Actual chart context/run lists missing')
        dry=clone_backup(root,'dry-'+issue,previous,disk.check);dry_before=triple(dry/'dev.db')
        dry_result=docker.cli('dry-'+issue,dry,script,'--dry-run');plan(dry_result,issue,'DRY_RUN')
        dry_backup,_=seal(root,'dry-'+issue+'-seal',dry/'dev.db',disk.check)
        require(logical(dry_backup)==logical(previous) and byte_identity(triple(dry/'dev.db'))['']==byte_identity(dry_before)[''],'Dry-run changed copied state/main bytes')
        write_new(root/('installer-'+issue+'-attempt.json'),{'forwardOnly':True,'script':script,'image':IMAGE,'neverRetry':True})
        applied=docker.cli('apply-'+issue,target,script,'--apply');plan(applied,issue,'APPLIED')
        installed,state=seal(root,'installed-'+issue,target/'dev.db',disk.check)
        preservation=delta(previous,installed,tables,marker,issue=='209');write_new(root/('preservation-'+issue+'.json'),preservation)
        repeat_before=triple(target/'dev.db');repeat=docker.cli('repeat-'+issue,target,script,'--apply');plan(repeat,issue,'NO_OP')
        repeated,repeated_state=seal(root,'repeat-'+issue+'-seal',target/'dev.db',disk.check)
        require(state==repeated_state and byte_identity(repeat_before)['']==byte_identity(triple(target/'dev.db'))[''],'Immediate NO_OP changed full state or main bytes')
        results.append({'issue':issue,'dry':dry_result,'apply':applied,'repeat':repeat,'preservation':preservation,'backup':str(repeated)})
        write_new(root/('stage-'+issue+'.json'),results[-1]);previous=repeated;disk.sample('after-'+issue)
    require(len(state['tables'])==112 and state['tables']['_schema_migrations']['count']==42,'Actual complete batch counts differ from source-derived expectation')
    write_new(root/'installation-result.json',{'status':'OWNED_COPY_INSTALLATION_PASS','stages':results,'actualImpactCollected':True,'productionMutations':0,'scientificListsNeedYYPresentation':True,'jobsOnQualificationStillRequired':True})
    return previous,state
