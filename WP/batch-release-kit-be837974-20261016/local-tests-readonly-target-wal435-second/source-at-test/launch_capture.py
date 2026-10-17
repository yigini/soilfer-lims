"""One source-reviewed capture dispatch. Never retries or creates a gate."""
import argparse
import os
import pathlib
from kit_contract import IMAGE_BYTES,canonical,require,sha
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT
from kit_capture_budget import CaptureBudget,CAPTURE_TABLE_SHA,CAPTURE_DB_EQUIVALENTS
from kit_capture_inputs import verify_capture_inputs
from kit_capture_launch import remote_capture_programs
from kit_package import read_package,write_new_file
from kit_disk import free_gate
from kit_io import CommandRunner
from retained_contract import exact_json
from prepare_release import REPO,REL,executing_source_matches,exclusive_directory,fresh_authority
from prepare_capture import PACKAGE

HOST='root@46.19.33.37'
EVIDENCE=REPO/REL/('capture-launch-'+CAPTURE_ROOT.name)


def capacity_record(raw,phase,future):
    value=exact_json(raw)
    require(value.get('phase')==phase and value.get('root')==CAPTURE_ROOT.as_posix() and value.get('metadataOnly') is True and
        type(value.get('productionSqliteConnections')) is int and value['productionSqliteConnections']==0 and
        value.get('neverRetry') is True and type(value.get('futurePackageAllocationBytes')) is int and
        value['futurePackageAllocationBytes']==future and value.get('tableSha256')==CAPTURE_TABLE_SHA and
        type(value.get('databaseEquivalents')) is int and value['databaseEquivalents']==CAPTURE_DB_EQUIVALENTS,
        'Exact fresh capture capacity record required')
    inputs=value['inputs'];budget=CaptureBudget(inputs['databaseAllocatedBytes'],inputs['assetsAllocatedBytes'],IMAGE_BYTES)
    require(type(value.get('remainingCopyBytes')) is int and value['remainingCopyBytes']==budget.remaining() and
        type(value.get('requiredBytes')) is int and value['requiredBytes']==budget.required()+future,
        'Capture capacity arithmetic differs from its exact source table')
    free_gate(value['hardware'],value['requiredBytes']);return value


def launch(package=PACKAGE,evidence=EVIDENCE):
    package=pathlib.Path(package);evidence=pathlib.Path(evidence)
    require(package==PACKAGE and evidence==EVIDENCE,'Exact one-use capture package and evidence paths required')
    files=read_package(package,require_posix_permissions=os.name=='posix')
    checked=verify_capture_inputs(files);executing_source_matches(checked['index'])
    programs=remote_capture_programs(checked['filePins'])
    exclusive_directory(evidence)
    write_new_file(evidence,'capture-launch-intent.json',canonical({'root':CAPTURE_ROOT.as_posix(),'unit':CAPTURE_UNIT,
        'manifestSha256':sha(canonical(checked['manifest'])),'allRemoteProgramsCompiledBeforeAnySsh':True,
        'releaseGateConsumed':False,'neverRetry':True})+b'\n',os.name=='posix')
    for name,raw in programs.items():write_new_file(evidence,name+'-rendered.py',raw,os.name=='posix')
    fresh_authority(evidence,checked['index'],checked['source'],'capture-before-root')
    runner=CommandRunner(evidence,lambda needed:None,os.name=='posix',programs=frozenset(('ssh','scp')))
    ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-']
    def remote(name,timeout=45):return runner.run(ssh,name.lower(),timeout,input_bytes=programs[name])[0]
    first=capacity_record(remote('beforeRoot'),'BEFORE_ROOT',checked['futurePackageAllocationBytes'])
    remote('create')
    entries=sorted({n.split('/')[0] for n in files})
    runner.run(['scp','-p','-r',*[str(package/n) for n in entries],HOST+':'+CAPTURE_ROOT.as_posix()+'/'],'upload',180)
    require(read_package(package,require_posix_permissions=os.name=='posix')==files,'Capture package changed during upload')
    fresh_authority(evidence,checked['index'],checked['source'],'capture-before-unit')
    second=capacity_record(remote('beforeUnit'),'BEFORE_UNIT',0)
    require({p:r['device'] for p,r in first['hardware'].items()}=={p:r['device'] for p,r in second['hardware'].items()},
        'Capture hardware changed before dispatch')
    result=exact_json(remote('unit'))
    require(result.get('unit')==CAPTURE_UNIT and result.get('root')==CAPTURE_ROOT.as_posix() and
        type(result.get('exitCode')) is int and result['exitCode']==0 and result.get('neverRetry') is True,
        'Unknown capture dispatch; observe SAME unit and never retry')
    write_new_file(evidence,'capture-dispatch-result.json',canonical(result)+b'\n',os.name=='posix')
    return result


def main():
    argparse.ArgumentParser().parse_args();print(canonical(launch()).decode())


if __name__=='__main__':main()
