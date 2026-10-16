"""Build the independent capture-only hook as source; never execute it here."""
import ast
import pathlib
from build_stop_post import nodes

HERE=pathlib.Path(__file__).resolve().parent
SPECS={
    'kit_contract.py':('IMAGE','MEMORY_MAX','canonical','require','sha'),
    'retained_contract.py':('exact_json',),
    'controller_output.py':('CONTROLLER_OUTPUT_BYTES','CONTROLLER_NAMES'),
    'kit_evidence.py':('BLOCK','SHARES','MAIN_POOL_BYTES','HOOK_RECORD_LIMIT','HOOK_RESULT_NAMES',
        'HOOK_NAMESPACE_BYTES','APACHE_TRANSITION_LIMIT','APACHE_NAMESPACE_BYTES','EMERGENCY_CALL_LIMIT',
        'EMERGENCY_STREAM_LIMITS','EMERGENCY_METADATA_LIMIT','EMERGENCY_NAMESPACE_BYTES',
        'INDEPENDENT_EMERGENCY_BYTES','_runtime','allocation','fixed_envelope_bounds','EvidenceLedger',
        'EvidenceWindow','bind_runtime','admit_evidence'),
    'kit_journal.py':('real_directory','exclusive_record'),
    'kit_io.py':('OUTPUT_LIMIT','READ_CHUNK','drain_streams'),
    'kit_stop.py':('MAX_OUTPUT','EmergencyCommands'),
    'kit_owned.py':('selected_fields','same_retained'),
    'kit_apache_capture.py':('CAPTURE_ROOT',),
    'kit_capture_owned.py':('CAPTURE_ROOT','CAPTURE_UNIT','CAPTURE_LABEL','CAPTURE_DATABASE',
        'CAPTURE_COMMANDS','capture_spec','validate_capture_spec','capture_selected','stop_capture_owners'),
}
MAIN='''
def main():
    require(os.name=='posix','Linux fresh-capture stop-post required')
    root=pathlib.Path(CAPTURE_ROOT)
    call=EmergencyCommands(root,True,namespace='stop-post')
    # Stop attempts precede ALL source, controller, receipt and filesystem
    # authority reads. Capture has no serving permit or production restart.
    result=stop_capture_owners(call)
    exclusive_record(root,'stop-post-result.json',result,True,independent_namespace='hook-results')
    return 0 if not result['errors'] and not call.retention_errors else 1

if __name__=='__main__':
    try:code=main()
    except BaseException:code=1
    sys.exit(code)
'''

def render():
    chunks=['"""GENERATED independent capture-only stop-post; no import actions or local imports."""',
        'import hashlib,io,json,os,pathlib,re,stat,subprocess,sys,time']
    for filename,names in SPECS.items():
        chunks.append('# Exact AST definitions from '+filename)
        for node in nodes((HERE/filename).read_text(encoding='utf-8'),names):
            if filename=='kit_apache_capture.py':
                node=ast.parse('APACHE_CAPTURE_ROOT='+ast.unparse(node.value)).body[0]
            chunks.append(ast.unparse(node))
    chunks.append(MAIN);value='\n\n'.join(chunks)+'\n'
    compile(value,'capture_stop_post.py','exec')
    require_no_imports=all(not isinstance(node,ast.ImportFrom) for node in ast.parse(value).body)
    assert require_no_imports,'Capture hook must be self-contained'
    return value

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-unreviewed-source',action='store_true');args=parser.parse_args()
    value=render();output=HERE/'capture_stop_post.py'
    if args.write_unreviewed_source:
        assert HERE.name=='batch-release-kit-be837974-20261016' and not str(HERE).startswith('/opt/')
        output.write_text(value,encoding='utf-8',newline='\n')
    else:assert output.read_text(encoding='utf-8')==value,'Generated capture hook stale'
    print('Independent capture stop-post SOURCE built; NOT executed; no host calls')
