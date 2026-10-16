"""Prepare a new unique closed guard runner; never execute any old helper."""
import pathlib
W=pathlib.Path(__file__).resolve().parents[2]
old=W/'WP/backlog-resume-20261013/verify-controller-forward420-final-local-host-once.py'
new=W/'WP/backlog-resume-20261013/verify-mount-order-attempt-local-host-first-once.py'
assert not new.exists();s=old.read_text(encoding='utf-8')
for before,after,count in [
 ('WP/batch-proof-controller-forward-step2-be837974-20261016','WP/batch-proof-mount-order-forward-be837974-20261016',2),
 ('source-local-host-controller-forward-final-once','source-local-host-mount-order-first-once',1),
 ('lims-controller-forward-step2-guards-final-20261016T045000Z','lims-mount-order-guards-first-20261016T081500Z',2),
 ("['verify_proof_guards.py','verify_jobs_guards.py','verify_provenance_guards.py']","['verify_proof_guards.py','verify_jobs_guards.py','verify_provenance_guards.py','verify_mount_order_guards.py']",1),
 ("['verify_proof_guards','verify_jobs_guards','verify_provenance_guards']","['verify_proof_guards','verify_jobs_guards','verify_provenance_guards','verify_mount_order_guards']",2),
 ("'verify_jobs_guards.py','verify_provenance_guards.py']:","'verify_jobs_guards.py','verify_provenance_guards.py','verify_mount_order_guards.py']:",1),
 ("repo=pathlib.Path(__file__)","sys.dont_write_bytecode=True\nrepo=pathlib.Path(__file__)",1)]:
 assert s.count(before)==count,(before,s.count(before));s=s.replace(before,after)
needle="env={**os.environ,"
assert s.count(needle)==1
before="writer=subprocess.run(['node',str(source/'writer_fingerprint.cjs')],cwd=source,capture_output=True,timeout=15)\nsave('actual-local-node-writer-stdout-original.json',writer.stdout);save('actual-local-node-writer-stderr-original.log',writer.stderr)\nassert writer.returncode==0 and not writer.stderr\nwriter_value=json.loads(writer.stdout);writer_value['producer']='ACTUAL_LOCAL_NODE_UNPATCHED_BOUND_CONTROLLER'\nassert writer_value['sourceSha256']==before['writer-controller-original.js'] and writer_value['fingerprint']=='345bfa7727c61604'\nwriter_json=json.dumps(writer_value)\n"
s=s.replace(needle,before+needle)
s=s.replace("'LIMS_PROOF_GUARD_FIXTURE_DIR':str(","'LIMS_ACTUAL_WRITER_PROBE_JSON':writer_json,'LIMS_PROOF_GUARD_FIXTURE_DIR':str(")
s=s.replace("encoded=ENCODED_VALUE;expected=EXPECTED_VALUE","encoded=ENCODED_VALUE;expected=EXPECTED_VALUE\nos.environ['LIMS_ACTUAL_WRITER_PROBE_JSON']=WRITER_VALUE")
s=s.replace("'COUNT_VALUE':count}","'COUNT_VALUE':count,'WRITER_VALUE':writer_json}")
compile(s,str(new),'exec');new.write_text(s,encoding='utf-8',newline='\n')
print(new.relative_to(W).as_posix())
