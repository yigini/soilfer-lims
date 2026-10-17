"""Pure exact capture input package, separate from release/gate packages."""
import hashlib
from kit_contract import HEAD,IMAGE,canonical,require,sha
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT
from kit_capture_budget import CAPTURE_TABLE_SHA
from kit_capture_copy import capture_source_review
from kit_package import file_pin,allocation
from retained_contract import ROOT,exact_json

MANIFEST='capture-package-manifest.json'


def capture_input_manifest(files):
    require(isinstance(files,dict) and {'source-index.json','source-review.json'}<=set(files) and MANIFEST not in files,
        'Complete initial capture input map required')
    index=exact_json(files['source-index.json']);source=exact_json(files['source-review.json'])
    binding=capture_source_review(index,source)
    expected={'source-index.json','source-review.json'}|{'tooling/'+n for n in index['files']}
    require(set(files)==expected and len(files)<=258,'Expanded or incomplete capture package refused')
    pins={}
    for name,raw in files.items():
        pins[name]=file_pin(raw)
        if name.startswith('tooling/'):
            claimed=index['files'][name[8:]]
            require(pins[name]=={k:claimed[k] for k in ('sha256','bytes')} and
                hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==claimed['gitBlob'],
                'Full capture source differs from published raw Git')
    require(sum(p['bytes'] for p in pins.values())<=128*1024**2,'Capture package bound exceeded')
    return {'version':1,'root':CAPTURE_ROOT.as_posix(),'unit':CAPTURE_UNIT,'releaseRoot':str(ROOT),
        'head':HEAD,'image':IMAGE,'captureTableSha256':CAPTURE_TABLE_SHA,'sourceBinding':binding,
        'files':pins,'fileMapSha256':sha(canonical(pins)),'allocationBoundBytes':allocation(pins),
        'releaseAuthorityGranted':False,'releaseGateConsumed':False,'neverRetry':True}


def verify_capture_inputs(files):
    require(isinstance(files,dict) and MANIFEST in files,'Capture input manifest required')
    payload={n:r for n,r in files.items() if n!=MANIFEST};manifest=capture_input_manifest(payload)
    require(canonical(exact_json(files[MANIFEST]))==canonical(manifest),'Exact capture input manifest differs')
    pins={n:file_pin(r) for n,r in files.items()}
    return {'index':exact_json(files['source-index.json']),'source':exact_json(files['source-review.json']),
        'manifest':manifest,'filePins':pins,'futurePackageAllocationBytes':allocation(pins)}
