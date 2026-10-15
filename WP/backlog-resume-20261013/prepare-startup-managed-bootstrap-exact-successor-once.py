"""Exact-format successor after a pre-edit source-match refusal."""
import hashlib,json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015/managed-bootstrap-exact-preparation-once'
assert not D.exists();D.mkdir()
p=R/'server/tests/helpers/qcGateFixture.js';b=p.read_bytes();(D/'qcGateFixture.before-original.js').write_bytes(b);s=b.decode().replace('\r\n','\n')
old="['install_nonconformity_reports','installNonconformityReports']]) require(`../../scripts/${script}`)[method]({ dbPath: file, apply: true });"
assert s.count(old)==1
s=s.replace(old,"""['install_nonconformity_reports','installNonconformityReports']]) {
        if (managedStartup && script === 'install_proficiency_evidence')
            require('../../scripts/bootstrap_pt_nonconformity').bootstrapPtNonconformity({ dbPath: file, apply: true });
        require(`../../scripts/${script}`)[method]({ dbPath: file, apply: true });
    }""")
p.write_bytes(s.encode())
runner=R/'WP/backlog-resume-20261013/verify-startup-managed-bootstrap-focused-once.py';assert not runner.exists();s=(R/'WP/backlog-resume-20261013/verify-startup-managed-context-focused-once.py').read_text(encoding='utf-8').replace('managed-context-focused-once','managed-bootstrap-focused-once');runner.write_bytes(s.encode())
(D/'preparation.json').write_text(json.dumps({'status':'FIXTURE_ONLY_SUCCESSOR','beforeFailedRun':'managed-context-focused-once','initialBootstrapPreparation':'pre-edit source-match assertion refused; no source modification; successor runner absent then attempted and exited2; TOOL_OUTPUT_TRANSCRIPTION','beforeSha256':hashlib.sha256(b).hexdigest(),'afterSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'runtimeSourceChanged':False,'managedFixtureUsesExistingGuardedPtNcrBootstrap':True,'existingPolicyChartOrderTestsUnchanged':True},indent=2),encoding='utf-8')
print(json.dumps({'status':'MANAGED_BOOTSTRAP_FIXTURE_PREPARED','runtimeSourceChanged':False}))
