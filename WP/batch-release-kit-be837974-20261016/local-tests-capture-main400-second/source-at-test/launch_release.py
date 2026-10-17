"""One exact release dispatch, after actual source/kit/fresh human authority.

Unknown transport outcomes consume the attempt. This launcher never retries,
resumes, cleans up, manufactures human confirmation or redeploys an old root.
Every remote program is compiled before ANY SSH; originals are retained first.
"""
import argparse
import os
import pathlib
import time
from kit_contract import HEAD,canonical,sha,require
from retained_contract import ROOT,ROOT_NAME,exact_json
from kit_package import read_package,verify_final,write_new_file
from kit_launch_programs import UNIT,remote_programs
from prepare_release import REPO,REL,PACKAGE,executing_source_matches,fresh_authority,exclusive_directory
from kit_disk import free_gate,BOUND
from kit_budget import Budget,TABLE_SHA,DB_EQUIVALENTS
from kit_contract import IMAGE_BYTES
from kit_io import CommandRunner

HOST='root@46.19.33.37'
EVIDENCE=REPO/REL/('release-launch-'+ROOT_NAME)


def capacity_record(raw,phase,future):
    value=exact_json(raw)
    require(value.get('phase')==phase and value.get('root')==str(ROOT) and value.get('metadataOnly') is True and
        value.get('productionSqliteConnections')==0 and value.get('neverRetry') is True and
        value.get('futurePackageAllocationBytes')==future and value.get('tableSha256')==TABLE_SHA and
        value.get('databaseEquivalents')==DB_EQUIVALENTS,'Exact fresh capacity record differs')
    inputs=value['inputs'];budget=Budget(inputs['databaseAllocatedBytes'],inputs['assetsAllocatedBytes'],IMAGE_BYTES)
    require(value.get('remainingCopyBytes')==budget.remaining() and value.get('requiredBytes')==budget.required()+future,
        'Fresh capacity arithmetic differs from reviewed runtime budget')
    free_gate(value['hardware'],value['requiredBytes']);return value


def launch(package,evidence,clock=time.time):
    package=pathlib.Path(package)
    require(package==PACKAGE and pathlib.Path(evidence)==EVIDENCE,'Fixed one-use package and launch evidence paths required')
    files=read_package(package,True,os.name=='posix')
    checked=verify_final(files,clock());executing_source_matches(checked['index'])
    programs=remote_programs(checked['filePins']) # render+compile ALL before any SSH
    evidence=exclusive_directory(pathlib.Path(evidence))
    write_new_file(evidence,'launch-intent.json',canonical({'root':str(ROOT),'head':HEAD,'unit':UNIT,
        'manifestSha256':sha(canonical(checked['manifest'])),'futurePackageAllocationBytes':checked['futurePackageAllocationBytes'],
        'allRemoteProgramsCompiledBeforeAnySsh':True,'neverRetry':True,'startedEpoch':clock()})+b'\n',os.name=='posix')
    for name,raw in programs.items():write_new_file(evidence,name+'-rendered.py',raw,os.name=='posix')
    fresh_authority(evidence,checked['index'],checked['source'],'launcher-before-root',checked['kit'],checked['human'])
    # The network snapshot cannot refresh the human confirmation's age.
    verify_final(files,clock())
    runner=CommandRunner(evidence,lambda needed:None,os.name=='posix',programs=frozenset({'ssh','scp'}))
    ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-']
    def remote(name,timeout=45):
        return runner.run(ssh,name.lower(),timeout,input_bytes=programs[name])[0]
    # Stable labels are local private output names; exact programs are immutable.
    first=capacity_record(remote('beforeRoot'),'BEFORE_ROOT',checked['futurePackageAllocationBytes'])
    remote('create')
    # Upload only verified top-level independent files/directories. The Linux
    # launch program rejects missing/extra files AND empty/extra directories.
    entries=sorted({name.split('/')[0] for name in files})
    runner.run(['scp','-p','-r',*[str(package/name) for name in entries],HOST+':'+str(ROOT)+'/'],
        'upload',180)
    require(read_package(package,True,os.name=='posix')==files,'Local package changed during upload')
    fresh_authority(evidence,checked['index'],checked['source'],'launcher-before-unit',checked['kit'],checked['human'])
    verify_final(files,clock())
    second=capacity_record(remote('beforeUnit'),'BEFORE_UNIT',0)
    require({p:r['device'] for p,r in first['hardware'].items()}==
        {p:r['device'] for p,r in second['hardware'].items()},'Hardware changed before unit dispatch')
    result=exact_json(remote('unit',45))
    require(result.get('unit')==UNIT and result.get('root')==str(ROOT) and result.get('exitCode')==0 and
        result.get('neverRetry') is True,'Unknown launch result; inspect SAME unit and never retry')
    write_new_file(evidence,'dispatch-result.json',canonical(result)+b'\n',os.name=='posix')
    return result


def main():
    p=argparse.ArgumentParser();p.add_argument('--package',required=True);p.add_argument('--evidence',required=True)
    a=p.parse_args();print(canonical(launch(a.package,a.evidence)).decode())

if __name__=='__main__':main()
