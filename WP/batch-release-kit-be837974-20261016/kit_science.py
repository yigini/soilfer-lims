"""Full scientific lists compared independently of retained-copy paths/time.

This does not collect a production snapshot or upgrade historical impact into
fresh evidence. Exact-kit preparation must supply a separately authorized
fresh capture. The installer independently verifies all retained allocations.
"""
import copy
import re
from kit_contract import HEAD,IMAGE,canonical,sha,require
from retained_contract import ROOT,impact_gate


def scientific_projection(issue,value):
    require(isinstance(value,dict),'Complete original scientific impact object required')
    result=copy.deepcopy(value)
    if issue=='206':
        require(value=={'issue':'206','additiveEmptyTablesOnly':True},'Only additive empty206 tables permitted')
    elif issue=='214':
        require(value.get('access')=='SQLITE_READONLY_SNAPSHOT' and value.get('productionMutations')==0 and
            isinstance(value.get('controlChartContexts'),list) and isinstance(value.get('affectedRuns'),list) and
            isinstance(value.get('sequenceRefusals'),list) and isinstance(value.get('counts'),dict),
            'Complete chart contexts, unstarted/unbound runs and sequence refusals required')
        require(isinstance(value.get('observedAt'),str),'Original chart observation timestamp required')
        # Only wall-clock collection time is excluded. Every chart context,
        # value, rule/policy setting, affected run, count and refusal survives.
        del result['observedAt']
    elif issue=='209':
        require(value.get('access')=='RETAINED_SNAPSHOT_ONLY' and value.get('originalFilesPreserved') is True and
            value.get('productionMutations')==0 and type(value.get('totalChanges')) is int and value['totalChanges']==0 and
            type(value.get('backfilledCount')) is int and value['backfilledCount']==0,
            'Read-only exact order impact required')
        impact_gate(value)
        snapshot=value.get('readonlySnapshot');allocation=value.get('retainedAllocation')
        require(isinstance(snapshot,dict) and set(snapshot)=={'originalDbWalShmSha256','originalFilesPreserved','path'} and
            snapshot['originalFilesPreserved'] is True and isinstance(allocation,dict) and
            set(allocation)=={'allocationMeasured','conservativeAllocationBytes','files','logicalBytes','root'} and
            allocation['allocationMeasured'] is True,'Complete known retention metadata required')
        require(re.fullmatch('[a-f0-9]{64}',value.get('sourceSha256','')),'Order impact source binding missing')
        # These fields describe the new retained files, not scientific
        # decisions. Their bytes/allocations remain mandatory independent
        # checks in Installations.verify_impact_allocations, before comparison.
        for name in ('readonlySnapshot','retainedAllocation','originalDbWalShmSha256'):result.pop(name)
    else:raise RuntimeError('Unreviewed scientific impact issue')
    return result


def validate_scientific_capture(value):
    from kit_capture_owned import CAPTURE_ROOT
    from kit_capture_budget import CAPTURE_TABLE_SHA
    require(isinstance(value,dict) and type(value.get('version')) is int and value['version']==2 and
        value.get('root')==CAPTURE_ROOT.as_posix() and value.get('releaseRoot')==str(ROOT) and
        value.get('captureTableSha256')==CAPTURE_TABLE_SHA and
        value.get('head')==HEAD and value.get('image')==IMAGE and
        value.get('context')=='FRESH_REVIEWED_PRODUCTION_COPY_BEFORE_RELEASE_GATE' and
        type(value.get('productionSqliteConnections')) is int and value['productionSqliteConnections']==0 and
        type(value.get('captureSourceReviewId')) is int and value['captureSourceReviewId']>6213266959 and
        isinstance(value.get('capturedAt'),str),'Fresh source-reviewed production-copy impact capture required')
    require(set(value.get('issues',{}))=={'206','214','209'} and set(value.get('originalReferences',{}))=={'214','209'},
        'Both complete actual scientific impact lists and original references required')
    require(set(value.get('preparationReferences',{}))=={'206','214'},'Both clone preparation original and preservation records required')
    references=[]
    for issue in ('214','209'):
        references.append((value['originalReferences'][issue],'actual-impact-'+issue+'.json'))
    for issue,records in value['preparationReferences'].items():
        require(isinstance(records,dict) and set(records)=={'original','preservation'},'Complete preparation record pair required')
        references.extend([(records['original'],'capture-'+issue+'-prepare-original.json'),
            (records['preservation'],'capture-'+issue+'-preservation.json')])
    for reference,name in references:
        require(isinstance(reference,dict) and set(reference)=={'file','sha256','bytes'} and
            reference['file']==name and re.fullmatch('[a-f0-9]{64}',reference.get('sha256','')) and
            type(reference.get('bytes')) is int and 0<reference['bytes']<=16*1024**2,'Exact retained full impact original required')
    return value


def verify_scientific_originals(value,read_private):
    validate_scientific_capture(value)
    from retained_contract import exact_json
    for issue,reference in value['originalReferences'].items():
        raw=read_private(reference['file'])
        require(sha(raw)==reference['sha256'] and len(raw)==reference['bytes'],'Actual scientific original bytes changed')
        require(scientific_projection(issue,exact_json(raw))==value['issues'][issue],
            'Frozen scientific projection omitted or changed original list fields')
    require(value['issues']['206']==scientific_projection('206',{'issue':'206','additiveEmptyTablesOnly':True}),
        'Additive206 impact binding differs')
    from retained_contract import plan
    from kit_install import CHAIN
    for issue,records in value['preparationReferences'].items():
        originals={}
        for kind,reference in records.items():
            raw=read_private(reference['file'])
            require(sha(raw)==reference['sha256'] and len(raw)==reference['bytes'],'Capture preparation original changed')
            originals[kind]=exact_json(raw)
        plan(originals['original'],issue,'APPLIED')
        tables,marker=CHAIN[issue]
        require(originals['preservation']=={'allOriginalRowsAndReceiptsPreserved':True,
            'priorStateFromBoundRecordNoSql':True,'newTables':sorted(tables),'emptyEvidenceTables':True,
            'backfilledCount':0,'marker':marker,'totalTables':108 if issue=='206' else 112,
            'schemaReceiptCount':40 if issue=='206' else 41},'Full capture preparation preservation report differs')
    return value


def verify_reviewed_impact(capture,issue,actual):
    validate_scientific_capture(capture)
    require(scientific_projection(issue,actual)==capture['issues'][issue],
        'Fresh stopped scientific impact differs from complete exact-kit reviewed lists')
    return True
