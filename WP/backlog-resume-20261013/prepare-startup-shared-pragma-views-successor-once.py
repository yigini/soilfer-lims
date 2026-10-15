"""One SQL check supplies both legacy simple and full-row pragma views."""
import hashlib,json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015/shared-pragma-views-preparation-once';assert not D.exists();D.mkdir()
for rel in ['server/utils/startupReadinessContext.js','server/tests/contracts/startup_readiness_context.test.js']:
 p=R/rel;b=p.read_bytes();(D/(p.name+'.before-original')).write_bytes(b)
p=R/'server/utils/startupReadinessContext.js';s=p.read_text(encoding='utf-8')
old="""                        const cacheKey = JSON.stringify([name, pragmaOptions || null]);
                        if (!checks.has(cacheKey)) checks.set(cacheKey, db.pragma(sql, pragmaOptions));"""
assert s.count(old)==1
s=s.replace(old,"""                        // Some owners request the full rows, others the first
                        // value. Retain one full result and preserve both views.
                        if (!checks.has(name)) checks.set(name, db.pragma(sql));""")
old='                        return structuredClone(checks.get(cacheKey));';assert s.count(old)==1
s=s.replace(old,"""                        const rows = checks.get(name);
                        return structuredClone(pragmaOptions?.simple ? (rows.length ? Object.values(rows[0])[0] : undefined) : rows);""")
p.write_bytes(s.encode())
p=R/'server/tests/contracts/startup_readiness_context.test.js';s=p.read_text(encoding='utf-8');old="if (corruptIntegrity && sql === 'integrity_check') return 'synthetic damaged database';";assert s.count(old)==1
s=s.replace(old,"if (corruptIntegrity && sql === 'integrity_check') return opts?.simple ? 'synthetic damaged database' : [{ integrity_check: 'synthetic damaged database' }];")
p.write_bytes(s.encode())
runner=R/'WP/backlog-resume-20261013/verify-startup-shared-pragma-views-focused-once.py';assert not runner.exists();s=(R/'WP/backlog-resume-20261013/verify-startup-managed-bootstrap-focused-once.py').read_text(encoding='utf-8').replace('managed-bootstrap-focused-once','shared-pragma-views-focused-once');runner.write_bytes(s.encode())
(D/'preparation.json').write_text(json.dumps({'status':'SHARED_PRAGMA_VIEWS_SUCCESSOR','beforeFailedRun':'managed-bootstrap-focused-once','previousResult':'all26 legacy/context reports and three late refusal equivalences passed, but two physical integrity calls because some owners request rows and others simple values','previousTotals':{'suites':3,'tests':17,'passed':15,'failed':2},'allChecksRetained':True,'existingPolicyChartOrderTestsUnchanged':True},indent=2),encoding='utf-8')
print(json.dumps({'status':'SHARED_PRAGMA_VIEWS_PREPARED'}))
