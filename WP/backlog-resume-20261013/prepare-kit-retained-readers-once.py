"""Copy reviewed pure readers into the new graph, changing import names only."""
import ast
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_evidence import *
N=W/'WP/batch-proof-mount-order-forward-be837974-20261016'
K=W/'WP/batch-release-kit-be837974-20261016'
mapping={'proof_files':'retained_files','provenance_privacy':'retained_privacy',
         'provenance_rules':'retained_provenance','kobo_copy_preservation':'retained_intake',
         'capture_kobo_fetch':'retained_fetch','runtime_proof_policies':'retained_runtime_policy',
         'proof_health':'retained_health','proof_memory':'retained_memory','controller_guard':'retained_controller'}
imports={**mapping,'proof_contract':'retained_contract','proof_docker':'kit_docker'}
records=[]
for old,new in mapping.items():
    before=(N/(old+'.py')).read_bytes()
    assert git('show','187636984895aec44044635fb63498b0fcb3102e:'+str((N/(old+'.py')).relative_to(W)).replace('\\','/'))==before
    text=before.decode();tree=ast.parse(text)
    for node in ast.walk(tree):
        if isinstance(node,ast.ImportFrom) and node.module in imports:
            text=text.replace('from '+node.module+' import','from '+imports[node.module]+' import')
    after=text.encode();a=ast.parse(before);b=ast.parse(after)
    for node in ast.walk(b):
        if isinstance(node,ast.ImportFrom):
            reverse={v:k for k,v in imports.items()}
            if node.module in reverse:node.module=reverse[node.module]
    assert ast.dump(a,include_attributes=False)==ast.dump(b,include_attributes=False),'A predicate changed outside imports'
    save(K,new+'.py',after)
    records.append({'oldPath':str((N/(old+'.py')).relative_to(W)).replace('\\','/'),'sourceCommit':'187636984895aec44044635fb63498b0fcb3102e',
        'oldSha256':sha(before),'oldGitBlobOid':oid(before),'oldBytes':len(before),'newFile':new+'.py',
        'newSha256':sha(after),'newBytes':len(after),'allFunctionBodiesStructurallyIdentical':True,'onlyModuleImportsChanged':True})
source=(N/'proof_contract.py').read_text();tree=ast.parse(source)
names={'require','sha','canonical','exact_json','child_path','plan','policy_gate','impact_gate'}
functions=[ast.get_source_segment(source,node) for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in names]
assert len(functions)==len(names)
constants="""import hashlib,json,pathlib,re
ROOT_NAME='workflow-batch-release-be837974-20261016T150000Z'
ROOT=pathlib.PurePosixPath('/opt/lims/releases')/ROOT_NAME
MEMORY=805306368
BYTE_LIMIT=32*1024**3
FILE_LIMIT=200000
LIVE_DATA='/var/lib/docker/volumes/lims_lims-data/_data'
LIVE_ASSETS='/var/lib/docker/volumes/lims_lims-assets/_data'
COMPOSE_PIN={'path':'docker-compose.yml','bytes':1214,'sha256':'2c540b13af52ada8cf475ad8aed19757deafd2997bf1e60fc63848d6e5153226','blob':'4e5bfd31f6c0bcc52419f0a55f7f6edbb8f85eec'}
"""
save(K,'retained_contract.py',('"""Unchanged reviewed reader predicates plus the NEW kit owner root. No operator I/O."""\n'+constants+'\n\n'.join(functions)+'\n').encode())
save(K,'compose-source.yml',(N/'compose-source.yml').read_bytes())
save(K,'retained-reader-source-map.json',canonical({'preparedUtc':utc(),'newRootProposedOnly':'/opt/lims/releases/workflow-batch-release-be837974-20261016T150000Z',
    'remoteRootCreated':False,'operatorsInvoked':0,'hostCalls':0,'readers':records,
    'contractFunctionsCopiedWithoutBodyChanges':sorted(names),'legacyCanonicalEnsureAsciiFalseRetained':True,
    'historicalOperatorImportOrInvocation':False})+b'\n')
print(json.dumps({'copiedReaders':len(records),'predicateBodiesPreserved':True,'hostCalls':0,'proposedRootOnly':True}))
