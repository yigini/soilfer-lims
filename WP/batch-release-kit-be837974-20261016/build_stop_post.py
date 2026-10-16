"""Generate the standalone hook from exact AST bodies; LOCAL source build only.

No host command or hook execution occurs here. Updating this unconsumed source
invalidates every earlier source hash/review. Tests require render()==the saved
hook and structural AST identity for each embedded function/class.
"""
import ast
import pathlib

HERE=pathlib.Path(__file__).resolve().parent
SPECS={
    'kit_contract.py':('HEAD','IMAGE','TREE','BUILD_RECEIPT_SHA','ACCEPTANCE_ID','TIMING_DIRECTION_ID',
        'POSTFLIGHT_POLICY','MEMORY_MAX','canonical','require','sha'),
    'retained_contract.py':('ROOT_NAME','ROOT','MEMORY','LIVE_DATA','LIVE_ASSETS','exact_json'),
    'controller_output.py':('CONTROLLER_OUTPUT_BYTES','CONTROLLER_STREAM_LIMIT','CONTROLLER_METADATA_LIMIT','CONTROLLER_NAMES',
        'output_require','output_canonical','output_root','output_pin','output_read_record','controller_argv','controller_output_closure'),
    'kit_evidence.py':('BLOCK','SHARES','MAIN_POOL_BYTES','HOOK_RECORD_LIMIT','HOOK_RESULT_NAMES',
        'HOOK_NAMESPACE_BYTES','APACHE_TRANSITION_LIMIT','APACHE_NAMESPACE_BYTES','EMERGENCY_CALL_LIMIT','EMERGENCY_STREAM_LIMITS',
        'EMERGENCY_METADATA_LIMIT','EMERGENCY_NAMESPACE_BYTES','INDEPENDENT_EMERGENCY_BYTES',
        '_runtime','allocation','fixed_envelope_bounds','EvidenceLedger','EvidenceWindow','bind_runtime','admit_evidence'),
    'kit_journal.py':('real_directory','exclusive_record'),
    'kit_owned.py':('LABEL','DATABASE','INSTALLERS','ALLOWED','cli_spec','validate_spec','selected','same_retained'),
    'kit_integrity.py':('DATA_MOUNT',),
    'retained_health.py':('assert_healthcheck',),
    'kit_runtime.py':('PREDECESSOR_ID','PREDECESSOR_IMAGE','PREDECESSOR_HEAD','CANDIDATE_OWNER','VOLUMES',
        'full_mounts','environment','predecessor_projection','candidate_projection'),
    'kit_io.py':('OUTPUT_LIMIT','READ_CHUNK','drain_streams'),
    'kit_stop.py':('MAX_OUTPUT','EmergencyCommands','stop_cli_owners'),
    'kit_emergency_ingress.py':('CONF','BASE','attributes','atomic_config','EmergencyIngress'),
    'kit_frozen.py':('SOURCE_SCOPE','REQUIRED_SOURCE','source_index','actual_claude','require_tokens','source_review',
        'kit_review','frozen_source_bytes'),
    'retained_controller.py':('UNIT','MAX_BYTES','parse_events','numeric_membership_path','actual_reader','own_snapshot'),
    'kit_stop_lifecycle.py':('private_file','frozen_hook_authority','serving_permit','stop_candidate_compiled',
        'stop_restarted_predecessor','stop_post_lifecycle'),
}


def nodes(source,names):
    found={}
    for node in ast.parse(source).body:
        if isinstance(node,(ast.ClassDef,ast.FunctionDef)):found[node.name]=node
        elif isinstance(node,ast.Assign):
            for name in node.targets:
                if isinstance(name,ast.Name):found[name.id]=node
    assert set(names)<=set(found),'Missing embedded definition'
    return [found[name] for name in names]


MAIN='''
def main():
    root=pathlib.Path(ROOT)
    # Missing/aliased evidence cannot suppress compiled exact-owner stops.
    # Source/package/receipt reads below reject aliases before trusting a permit.
    require(os.name=='posix','Linux stop-post process required')
    call=EmergencyCommands(root,True,namespace='stop-post')
    controller_number=0
    def controller():
        nonlocal controller_number
        controller_number+=1;raws=[]
        try:
            value=own_snapshot(evidence=lambda path,raw:raws.append({'path':str(path),'rawAscii':raw.decode('ascii'),
                'sha256':sha(raw),'bytes':len(raw)}))
            original=exact_json(private_file(root,'controller-memory-before.json'))
            require(all(value[k]==original[k] for k in ('unit','membershipRaw','cgroupDevice','cgroupInode')),
                'Stop-post controller cgroup differs from actual before snapshot')
            return value
        finally:
            exclusive_record(root,'stop-post-controller-'+str(controller_number)+'.json',{'raws':raws},True,independent_namespace='hook-results')
    def validate():
        manifest=frozen_hook_authority(root)
        return serving_permit(root,manifest,call)
    def hold():
        manifest=exact_json(private_file(root,'frozen-manifest.json'))
        original=private_file(root,'ingress-original.conf',1024**2)
        held=private_file(root,'ingress-held.conf',1024**2)
        return EmergencyIngress(root,call,original,held,manifest['originalIngressSha256'],
            manifest['heldIngressSha256'],namespace='stop-post')()
    result=stop_post_lifecycle(root,call,validate,hold,controller,
        lambda value:exclusive_record(root,'stop-post-result.json',value,True,independent_namespace='hook-results'))
    # The complete result is retained above. This hook emits no journal stream.
    return 0 if not result['errors'] and not result['postStopErrors'] else 1

if __name__=='__main__':
    try:code=main()
    except BaseException:code=1
    sys.exit(code)
'''


def render():
    chunks=['"""GENERATED self-contained exact-root stop-post. No local imports; no import actions."""',
        'import datetime,hashlib,io,json,os,pathlib,re,stat,subprocess,sys,time']
    for filename,names in SPECS.items():
        source=(HERE/filename).read_text(encoding='utf-8')
        chunks.append('# Exact AST definitions from '+filename)
        chunks.extend(ast.unparse(node) for node in nodes(source,names))
        if filename=='kit_owned.py':
            loops=[node for node in ast.parse(source).body if isinstance(node,ast.For)]
            assert len(loops)==1;chunks.append(ast.unparse(loops[0]))
    chunks.append(MAIN)
    value='\n\n'.join(chunks)+'\n';compile(value,'stop_post.py','exec')
    tree=ast.parse(value)
    assert all(not isinstance(node,ast.ImportFrom) for node in tree.body),'Standalone hook cannot have local imports'
    return value


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write-unreviewed-source',action='store_true')
    args=parser.parse_args();value=render()
    if args.write_unreviewed_source:
        output=HERE/'stop_post.py'
        # This generator only edits this checkout's unconsumed source, never a
        # /opt release, frozen package, old receipt, gate, or consumed operator.
        assert HERE.name=='batch-release-kit-be837974-20261016' and not str(HERE).startswith('/opt/')
        output.write_text(value,encoding='utf-8',newline='\n')
    else:assert (HERE/'stop_post.py').read_text(encoding='utf-8')==value,'Generated standalone hook is stale'
    print('Standalone stop-post source built; NOT executed; no host calls')
