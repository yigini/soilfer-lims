"""Read-only #190 plan on the retained fresh production copy."""
import json, pathlib, subprocess
import release_support as s
ROOT = pathlib.Path(__file__).resolve().parent
if __name__ == '__main__':
    assert ROOT.parent == pathlib.Path('/opt/lims/releases') and ROOT.name.startswith('combined-eb6de2e8-')
    source = ROOT / 'fresh-production-copy.db'
    before = s.sha(source)
    build = json.loads((ROOT / 'build-receipt.json').read_text())
    assert build['head'] == s.HEAD
    result = s.command(ROOT, ['docker','run','--rm','--network','none','--memory','768m',
        '--mount','type=bind,src='+str(source)+',dst=/proof/dev.db,readonly',
        '--entrypoint','node',build['image'],'/app/server/scripts/install_work_attempt_contract.js',
        '--db','/proof/dev.db','--dry-run'], '190-independent-dry')
    dry = json.loads(result.stdout)
    assert s.sha(source) == before and dry['mode'] == 'DRY_RUN' and dry['totalChanges'] == 0
    plan = dry.get('plan',{})
    summary = {'status':'READ_ONLY_ATTEMPT_PLAN','head':s.HEAD,'utc':s.utc(),
        'sourceCopySha256':before,'classification':dry['classification'],'planStatus':plan.get('status'),
        'planSha256':plan.get('planSha256'),'newAttemptCount':len(plan.get('newAttempts',[])),
        'linkedResultCount':len(plan.get('links',[])),
        'flaggedGroupCount':len(plan.get('flaggedGroups',[])),
        'missingOrderedWorkCount':plan.get('missingOrderedWorkCount'),
        'samplesWithMissingOrderedWorkCount':plan.get('samplesWithMissingOrderedWorkCount'),
        'totalChanges':0,'productionExecution':False,'copyBytesPreserved':True,
        'dryRunSha256':s.sha(ROOT/'190-independent-dry.stdout')}
    with (ROOT/'190-dry-summary.json').open('x') as stream:
        json.dump(summary,stream,indent=2)
    (ROOT/'190-dry-summary.json').chmod(0o400)
    print(json.dumps(summary),flush=True)
