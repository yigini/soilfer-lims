"""SOURCE ONLY: extend unreviewed profile with exact delayed daily backup edges."""
import sys,pathlib,json
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];K=W/'WP/batch-release-kit-be837974-20261016'
sys.path.insert(0,str(K))
from prepare_release import raw_git
from kit_recovery_copy import HEAD,derive,ANCILLARY
from kit_contract import canonical,sha
path=K/'predecessor-copy-source-binding.json';prior=path.read_bytes();profile=json.loads(prior)
assert len(profile['files'])==160
D=K/'predecessor-copy-scheduler-extension-source-only-once';D.mkdir()
(D/'original160-profile.json').write_bytes(prior)
raws={n:r[0] for n,r in raw_git(HEAD,set(profile['files'])|ANCILLARY).items()}
new=derive(raws);path.write_bytes(canonical(new)+b'\n')
(D/'extension-record.json').write_bytes(canonical({'original160Sha256':sha(prior),
    'new162Sha256':sha(path.read_bytes()),'sourceOnly':True,'hostCalls':0,
    'backupExcludedOnlyFor86400000msDelayWithin5400SecondController':True})+b'\n')
print({'files':len(new['files']),'startupRoots':len(new['startupRoots']),
    'localRequireFiles':156,'javascriptRequireNodes':len(new['localRequireEdges']),'hostCalls':0})
