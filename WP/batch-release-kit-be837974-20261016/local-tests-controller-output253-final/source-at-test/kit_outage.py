"""Complete proposed outage disclosure; no new timing measurement or deadline.

All unmeasured phases have explicit allowances for review. Historical CLI
times come from the retained cde8/B5 context. Readiness is from the accepted
acc158100000 startup on an already-installed database. Their sum is not an
observed production sequence. No phase/transaction receives a new kill point.
"""
from kit_contract import HEAD,IMAGE,PHASES,require,whole_outage_disclosure

ALLOWANCES={
    'quiesce503':45,'predecessorStop':25,'noLiveVolumeWriters':30,'stoppedIntegrityFk':60,
    'freshDiskBeforeBackup':120,'stoppedBackup':180,'canonicalPolicyNoOp':60,
    'impactBefore206':5,'preserve206':120,'impactBefore214':90,'preserve214':120,
    'impactBefore209':120,'preserve209':120,'retainStoppedPredecessorName':30,
    'candidateIntent':5,'candidateStart':60,'firstNaturalSync':300,
    'apiAndReadOnlyPostflights':300,'freshDiskBeforeReopen':120,'reopen':60,
}


def proposal(timing):
    require(timing.get('currentHead')==HEAD and timing.get('currentImage')==IMAGE and
        timing.get('historicalInstallerHead')=='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367' and
        timing.get('historicalInstallerImage')=='sha256:b5ab0a0a57aeec4fe24dd8095126f3502cbc0c8629a7f4c1ef9e55034893c6fb' and
        timing.get('comparisonIsNotMeasurementOfOneProductionSequence') is True,
        'Exact retained timing contexts required')
    phases={name:{'kind':'REVIEWED_ALLOWANCE','seconds':seconds,
        'basis':'Proposed explicit allowance pending exact source/kit review; phase has not been measured on this production sequence.'}
        for name,seconds in ALLOWANCES.items()}
    for issue in ('206','214','209'):
        for phase in ('dry','apply','repeat'):
            phases[phase+issue]={'kind':'RETAINED_MEASUREMENT_OTHER_CONTEXT',
                'seconds':timing['historicalInstallMeasurements'][issue][phase],
                'basis':'Retained cde8/B5 '+issue+' '+phase+' command, including its historical transport; new CLI wrapper and production sequence are unmeasured.'}
    phases['candidateReady']={'kind':'RETAINED_MEASUREMENT_OTHER_CONTEXT',
        'seconds':timing['startupMeasurements']['100000-2']['readinessSeconds'],
        'basis':'Accepted acc158100000 ordinary jobs-on startup, already-installed112/42; not a new three-installer production run.'}
    require(set(phases)==set(PHASES),'Every quiesce-through-reopen phase must be disclosed exactly once')
    return whole_outage_disclosure(phases)
