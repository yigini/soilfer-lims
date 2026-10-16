"""Unchanged reviewed reader predicates plus the NEW kit owner root. No operator I/O."""
import hashlib,json,pathlib,re
ROOT_NAME='workflow-batch-release-be837974-20261016T150000Z'
ROOT=pathlib.PurePosixPath('/opt/lims/releases')/ROOT_NAME
MEMORY=805306368
BYTE_LIMIT=32*1024**3
FILE_LIMIT=200000
LIVE_DATA='/var/lib/docker/volumes/lims_lims-data/_data'
LIVE_ASSETS='/var/lib/docker/volumes/lims_lims-assets/_data'
COMPOSE_PIN={'path':'docker-compose.yml','bytes':1214,'sha256':'2c540b13af52ada8cf475ad8aed19757deafd2997bf1e60fc63848d6e5153226','blob':'4e5bfd31f6c0bcc52419f0a55f7f6edbb8f85eec'}
def require(ok,message):
    if not ok:raise RuntimeError(message)

def sha(raw):return hashlib.sha256(raw).hexdigest()

def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()

def exact_json(raw):
    def pairs(items):
        out={}
        for k,v in items:require(k not in out,'Duplicate JSON key');out[k]=v
        return out
    return json.loads(raw,object_pairs_hook=pairs)

def child_path(root,value):
    r,p=pathlib.Path(root).resolve(),pathlib.Path(value).resolve()
    require(r in p.parents and p!=r and not pathlib.Path(value).is_symlink(),'Only a distinct owned child is allowed')
    for q in [pathlib.Path(value),*pathlib.Path(value).parents]:require(not q.is_symlink(),'Path aliases refused')
    return p

def plan(value,issue,mode):
    require(value.get('classification')==('PRE_'+issue if mode=='DRY_RUN' else 'COMPLETE_'+issue) and value.get('mode')==mode,'Installer mode/classification differs')
    require(type(value.get('backfilledCount')) is int and value['backfilledCount']==0 and type(value.get('totalChanges')) is int and value['totalChanges']==(1 if mode=='APPLIED' else 0),'Installer wrote beyond one receipt or backfilled')
    if mode=='APPLIED':require(value.get('previousClassification')=='PRE_'+issue and value.get('receipt',{}).get('originalRowsPreserved') is True,'Original-row receipt missing')

def policy_gate(value):
    require(value.get('classification')=='PRESENT' and value.get('shape')=='CANONICAL' and value.get('mode')=='NO_OP' and value.get('totalChanges')==0 and value.get('dataWrites')==0 and value.get('readonlySnapshot',{}).get('originalFilesPreserved') is True,'POLICY_PRESENT_CANONICAL_NO_OP_OR_STOP')

def impact_gate(value):
    impact=value.get('impact',{})
    for n in ['prospectiveApprovedAmendmentSampleCount','invalidStoredAnalysisSampleCount','noActiveRevisionCount','noMatchingLineCount']:
        require(type(impact.get(n)) is int and impact[n]>=0,'Complete scientific impact missing '+n)
    require(isinstance(impact.get('invalidStoredAnalyses'),list) and len(impact['invalidStoredAnalyses'])==impact['invalidStoredAnalysisSampleCount'],'Invalid stored-analysis ID list missing')
    require(all(isinstance(r.get('sampleId'),str) and r['sampleId'] and isinstance(r.get('workItemIds'),list) and all(isinstance(id,str) and id for id in r['workItemIds']) for r in impact['invalidStoredAnalyses']),'Malformed-analysis sample/owner IDs missing')
    require(len(impact.get('approvedAmendmentSampleIds',[]))==impact['prospectiveApprovedAmendmentSampleCount'],'Approved-amendment IDs missing')
    require(impact['prospectiveApprovedAmendmentSampleCount']==0 and impact.get('approvedAmendmentKitGate')=='NO_APPROVED_AMENDMENT_REFUSALS','STOP_APPROVED_AMENDMENT_REMEDIATION_REQUIRED: show actual list to YY; separately Claudio-reviewed forward remedy only')
