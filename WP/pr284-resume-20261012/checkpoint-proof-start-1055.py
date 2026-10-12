"""Document the actual single build and proof; preserve every earlier record."""
import datetime
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent


def main():
    built = json.loads((ROOT / 'build-5dd5488d-104515/independent-verification.json').read_bytes())
    observed = json.loads((ROOT / 'proof-observation-1055.json').read_bytes())
    assert built['unitState']['ActiveState'] == 'inactive' and built['unitState']['ExecMainStatus'] == '0'
    assert 'ActiveState=active' in observed['unitState'] and 'rehearsal-receipt.json' not in observed['files']
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    text = (
        f'PR284 single build/proof checkpoint {timestamp}: actual NEW proof/build SourcePASS6122670828 '
        'at10:43:17UTC forf5e59428c1bbf19247db2555f5158bc3a2ac5fad independently validated/all31 rawbytes/'
        'primarytokens/currentmain5dd5488d/mainCI38233444989SUCCESS360/5473/both Docker. '
        'ONE originalbuild /opt/lims/releases/instrument-import-build-5dd5488d-20261012T104515Z '
        'completed10:49:28.538863UTC/inactiveexit0/BUILT_ONLY_NOT_DEPLOYED0400receipt '
        '92be0f7ce246fd94f2dfd39c9b26e3e9fe84d35b5a28e1687f6199428576058f. '
        'Image sha256:57575a88c02aa6b9c0e801c2c6a6e7da0de298c41d093aeba5cc75480c3aa930/'
        '413730674B/exact5ddrevision/2286Gitblobs independentlyverified; archive7ff63524d4983f833705eded3789f15c0eb19dc1739ce7b564737860b7de68b7/'
        'index4dd19e51f83180c11896b85e7917769f21b35a15315c364191ae051a0e558041. '
        'NEVER rebuild/replay this completed root/unit. Targetpinbc2b5dffd45e2db59d02bfe9ec26c8780eb9c67a70b0ebaec8389b2ca5c77d50 '
        'bindsactualreview6122670828/bothpins. ONE NEW isolatedproof /opt/lims/releases/instrument-import-proof-5dd5488d-20261012T105200Z, '
        'unit lims-owned-instrument-import-proof-5dd5488d-20261012t105200z.service is ACTIVERUNNING '
        'at10:53:36UTC; original31filesourceindexcbeae2e04e6803511e62c506438e4c049a6982cf48a0769b3091bd39e4946279/'
        'coordinator73fd8dc57cc85332f499caa4fbd01912217295b51048d5c05cddefc1c6e5c894 unchanged. '
        'Fresh protected-state capture underway; no proofPASS/FAILED yet, no owned startupcontainer yet atthatobservation. '
        'Continue SAME unit, never newwriter/relaunch/retry; retain actual terminalreceipt and all originals. '
        'Separate proposed production source d994991753618c1f88858f7cba6d4e9a0ea890f7 bindsactualf5e/'
        'sourcePASS6122670828/all31bytesunchanged;164/164Win+164/164Linux guards0errors/failures/skips/no productionDBaccess. '
        '39rawproductionsources60frozenfiles/13retainedDBallocations. Source request162/6122760425 '
        'posted10:49:07UTC/native delivery verified and actualClackreviewing d994 at10:51UTC. '
        'Production coordinator2c16c9af8c4270a2307d26d9869af5a928e4a77374aa8a43dd0ea7f7fcc5f589/'
        'contracte2623b4215fb86c07f7ea4f1e81374fdcc451cd6fa1d38a2ac5bf70a91ac2304. '
        'NEW productionSourcePASS STILLPENDING; no frozenkit/gate/productioninstaller/quiesce/mutation/cleanup/cards. '
        'RealWALmountwitness/rawfailures/mainCI/sourceAPI committed3fa36fbc; all completedPR293 artifacts '
        'and healthy51f/d4eb production stay retained. SAMEwriter continuesproof/productionreview->originalstoppedPASSkit/'
        'NEWexactkitreview/ONEfreshgate/forwarddeploy/Clactualpostcheckhandoff; other app merges held until#200live/postchecked.')
    for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
        path = ROOT.parent.parent / relative
        path.write_bytes((text + '\r\n\r\nPrevious checkpoint follows:\r\n\r\n').encode() + path.read_bytes())
    print(json.dumps({'observedUtc': timestamp, 'proofRunning': True, 'productionSourcePass': False,
        'proofObservationSha256': hashlib.sha256((ROOT / 'proof-observation-1055.json').read_bytes()).hexdigest()}))


if __name__ == '__main__': main()
