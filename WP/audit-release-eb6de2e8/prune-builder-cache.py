"""Only the YY-authorized Docker builder cache; no volumes or image prune."""
import datetime, json, pathlib, shutil, subprocess

ROOT = pathlib.Path(__file__).resolve().parent
if __name__ == '__main__':
    assert ROOT.parent == pathlib.Path('/opt/lims/releases') and ROOT.name.startswith('combined-eb6de2e8-')
    assert (ROOT/'build-receipt.json').is_file(), 'Finish candidate build before pruning cache'
    receipt = {'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'command':['docker','builder','prune','--force'],
        'freeBytesBefore':shutil.disk_usage('/opt/lims').free,
        'productionDatabaseOperations':0,'volumeOrImagePrune':False}
    with (ROOT/'builder-prune-after-verified-build.log').open('x') as log:
        result = subprocess.run(receipt['command'],stdout=log,stderr=subprocess.STDOUT,timeout=180)
    receipt['exitCode'] = result.returncode
    receipt['freeBytesAfter'] = shutil.disk_usage('/opt/lims').free
    with (ROOT/'builder-prune-after-verified-build.json').open('x') as output:
        json.dump(receipt,output,indent=2)
    assert result.returncode == 0
    print(json.dumps(receipt),flush=True)
