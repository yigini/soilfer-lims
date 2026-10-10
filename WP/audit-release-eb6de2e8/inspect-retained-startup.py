"""Read partial evidence honestly; never upgrades a failed rehearsal to PASSED."""
import json, pathlib, sys
import release_support as s

if __name__ == '__main__':
    root = pathlib.Path(sys.argv[1]).resolve()
    assert root.parent == pathlib.Path('/opt/lims/releases') and root.name.startswith('combined-eb6de2e8-')
    proof = json.loads((root/'rehearsal-receipt.json').read_text())
    assert proof['status'] == 'REFUSED_OR_FAILED_OWNED_COPY' and proof['productionExecution'] is False
    events = s.ready_logs((root/'startup-ready.stdout').read_text()+'\n'+(root/'startup-ready.stderr').read_text())
    stages = []
    for row in proof['installers']:
        memory = json.loads((root/(row['key']+'-apply-container.json')).read_text())
        stages.append({'key':row['key'],'mode':row['apply']['mode'],'totalChanges':row['apply']['totalChanges'],
            'memoryLimitBytes':memory['memoryLimitBytes'],'nodeOptions':memory['nodeOptions'],
            'peakBytes':memory['cgroupMemoryPeak']['releaseCliPeakBytes']})
    assert len(stages) == 21 and all(row['memoryLimitBytes']==805306368 and row['nodeOptions'] is None
        and 0<row['peakBytes']<=805306368 for row in stages)
    assert proof['repeatTotalChanges'] == 0 and proof['repeatedInstallDatabaseBytesPreserved'] is True
    assert proof['health']['status'] == 'ok'
    print(json.dumps({'status':'PARTIAL_VERIFIED_STARTUP_NOT_COMPLETE_REHEARSAL','retainedStatus':proof['status'],
        'head':proof['head'],'root':str(root),'receiptSha256':s.sha(root/'rehearsal-receipt.json'),
        'failedCoordinatorCheck':proof['error'],'candidateImage':proof['candidateImage'],
        'productionExecution':False,'preservation':proof['preservation'],'installers':stages,
        'repeatTotalChanges':0,'repeatDatabaseBytesPreserved':True,
        'readyEvents':[row['event'] for row in events],'health':proof['health'],
        'startupMemoryLimitBytes':805306368,'startupPeakBytes':None,
        'apiPostflightsComplete':False},indent=2))
