"""Project retained proof to public counts/hashes, excluding historical row values."""
import hashlib, json, pathlib, sys

def sha(file):
    value = hashlib.sha256()
    with file.open('rb') as stream:
        while block := stream.read(1024 * 1024):
            value.update(block)
    return value.hexdigest()

if __name__ == '__main__':
    root = pathlib.Path(sys.argv[1]).resolve()
    assert root.parent == pathlib.Path('/opt/lims/releases') and root.name.startswith('combined-eb6de2e8-')
    proof = json.loads((root/'rehearsal-receipt.json').read_text())
    assert proof['status'] == 'PASSED' and proof['productionExecution'] is False
    build = json.loads((root/'build-receipt.json').read_text())
    assert proof['head'] == build['head'] and proof['candidateImage'] == build['image']
    rows = []
    count_fields = ['newAttemptCount','linkedResultCount','flaggedAttemptCount','backfilledCount',
        'backfillCount','newSelectionCount','newNcrCount','newAmendmentCount','activationInsertCount','unitInsertCount']
    for row in proof['installers']:
        measured = json.loads((root/(row['key']+'-apply-container.json')).read_text())
        rows.append({'key':row['key'],'script':row['script'],'dryRunClassification':row['dryRun']['classification'],
            'mode':row['apply']['mode'],'totalChanges':row['apply']['totalChanges'],
            'counts':{name:row['apply'][name] for name in count_fields if name in row['apply']},
            'memoryLimitBytes':measured['memoryLimitBytes'],'nodeOptions':measured['nodeOptions'],
            'applyPeakBytes':measured['cgroupMemoryPeak']['releaseCliPeakBytes']})
    dry = proof['attemptDryRun']
    plan = dry['plan']
    summary = {'status':'PASSED_OWNED_COPY_NOT_PRODUCTION','head':proof['head'],
        'root':str(root),'candidateImage':proof['candidateImage'],'startedUtc':proof['startedUtc'],
        'completedUtc':proof['completedUtc'],'productionExecution':False,
        'rehearsalReceiptSha256':sha(root/'rehearsal-receipt.json'),
        'buildReceiptSha256':sha(root/'build-receipt.json'),
        'sourceArchiveSha256':build['sourceArchiveSha256'],'sourceIndexSha256':build['sourceIndexSha256'],
        'verifiedGitBlobCount':build['verifiedGitBlobCount'],'productionCopySha256':proof['productionCopySha256'],
        'preservation':proof['preservation'],'installers':rows,
        'attemptPlan':{'classification':dry['classification'],'status':plan['status'],
            'planSha256':proof['attemptPlanSha256'],'newAttemptCount':len(plan['newAttempts']),
            'linkedResultCount':len(plan['links']),'flaggedGroupCount':len(plan['flaggedGroups']),
            'missingOrderedWorkCount':plan.get('missingOrderedWorkCount'),
            'samplesWithMissingOrderedWorkCount':plan.get('samplesWithMissingOrderedWorkCount'),
            'totalChanges':dry['totalChanges']},
        'repeatTotalChanges':proof['repeatTotalChanges'],'startupChanges':proof['startupChanges'],
        'readOnlyProbeChanges':proof['readOnlyProbeChanges'],
        'repeatInstallDatabaseBytesPreserved':proof['repeatedInstallDatabaseBytesPreserved'],
        'readyEvents':[row['event'] for row in proof['startupReady']],
        'startupMemory':proof['startupMemory'],'health':proof['health'],'apiChecks':proof['apiChecks'],
        'probes':proof['probes'],'benchCredentialCount':proof['benchCredentialCount'],
        'freeBytesAfter':proof['freeBytesAfter']}
    print(json.dumps(summary,indent=2))
