"""Read retained public originals only; no SQL, network or operator execution."""
import argparse
import hashlib
import json
from pathlib import Path
from kit_contract import *

REPO=Path(__file__).resolve().parents[2]

def derive():
    references=[]
    def read(relative):
        raw=(REPO/relative).read_bytes()
        references.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),
                           'gitBlobOid':hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()})
        return json.loads(raw)
    install_roots={
        '206':'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/',
        '214':'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/',
        '209':'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/',
    }
    installs={}
    for issue,root in install_roots.items():
        installs[issue]={}
        for mode in ('dry','apply','repeat'):
            value=read(root+mode+'-'+issue+'-run-exit.json')
            require(value['exitCode']==0 and value['error'] is None and value['neverRetry'] is True,'Historical CLI did not succeed')
            seconds=value['elapsedSeconds']
            require(type(seconds) in (int,float) and seconds>0,'Historical CLI duration missing')
            installs[issue][mode]=seconds
    n='WP/batch-proof-mount-order-forward-be837974-20261016/mount-order100000-closed-originals-once/remote-originals/'
    starts={}
    for i in (1,2):
        value=read(n+'startup-'+str(i)+'-result.json')['readiness']
        starts['100000-'+str(i)]={
            'readinessSeconds':value['readinessElapsedSeconds'],
            'dockerHealthySeconds':value['timeToFirstHealthySeconds'],
            'observedUnhealthySeconds':value['totalUnhealthySeconds'],
            'includesNewInstallerApply':False,
        }
    old='WP/batch-proof-memory-events-be837974-20261015/proof233000-closed-memory-events-complete-originals-once/remote-originals/'
    for i in (1,2):
        value=read(old+'startup-'+str(i)+'-result.json')
        starts['233000-'+str(i)]={
            'dockerHealthySeconds':value['timeToFirstHealthySeconds'],
            'resultSecondsIncludingStoppedSeal':value['elapsedSeconds'],
            'observedUnhealthySeconds':value['totalUnhealthySeconds'],
            'includesNewInstallerApply':False,
            'resultSecondsAreNotHttpDowntime':True,
        }
    apply_seconds=sum(v['apply'] for v in installs.values())
    all_cli_seconds=sum(sum(v.values()) for v in installs.values())
    fastest_new=min(v['readinessSeconds'] for k,v in starts.items() if k.startswith('100000'))
    lower_comparison=apply_seconds+fastest_new+STOP_GRACE_SECONDS
    return {
        'status':'RETAINED_TIMING_COMPARISON_WHOLE_OUTAGE_FIT_NOT_ESTABLISHED',
        'currentHead':HEAD,'currentImage':IMAGE,
        'historicalInstallerImage':'sha256:b5ab0a0a57aeec4fe24dd8095126f3502cbc0c8629a7f4c1ef9e55034893c6fb',
        'historicalInstallerHead':'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367',
        'historicalInstallMeasurements':installs,'startupMeasurements':starts,
        'threeApplyCallsSeconds':apply_seconds,'nineDryApplyRepeatCallsSeconds':all_cli_seconds,
        'comparisonApplyPlusFastestAcceptedReadinessPlusTenSecondGrace':lower_comparison,
        'comparisonExcludes':['Apache quiesce','writer inventory','stopped integrity/FK',
                              'DB/WAL/SHM backup','asset backup','per-stage preservation',
                              'postflight API checks','disk accounting','Apache reopen'],
        'comparisonIsNotMeasurementOfOneProductionSequence':True,
        'acceptedStartupsUsedAlreadyInstalled112Table42ReceiptDatabase':True,
        '233000IsStartupOnlyNotAThreeInstallerProductionPath':True,
        'wholeSequenceUnder600SecondsProved':False,
        'mustResolveTotalOutageBoundaryBeforeGate':True,
        'references':references,'hostCalls':0,'sqliteConnections':0,
    }

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True)
    output=Path(parser.parse_args().output)
    with output.open('xb') as f:f.write(canonical(derive())+b'\n')

if __name__=='__main__':main()
