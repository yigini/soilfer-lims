"""Immutable staged package construction and verification, without host access.

The manifest binds the payload. Later review and human records bind that
manifest; they are separate append-only inputs, never members of its own hash.
No approval, human acceptance or production operation is created here.
"""
import hashlib
import os
import pathlib
import re
import stat
from kit_contract import HEAD,TREE,IMAGE,BUILD_RECEIPT_SHA,canonical,require,sha,whole_outage_disclosure
from retained_contract import ROOT,exact_json
from kit_frozen import SOURCE_SCOPE,source_index,source_review,kit_review,human_gate_comment
from kit_science import verify_scientific_originals

MAX_PACKAGE_FILES=1024
MAX_PACKAGE_BYTES=128*1024**2
MAX_FILE_BYTES=16*1024**2
POST_MANIFEST_FILES={'frozen-manifest.json','exact-kit-review.json','yy-confirmation.json','yy-comment-original.json'}
REQUIRED_PAYLOAD={'source-index.json','source-review.json','whole-outage-disclosure.json',
    'consumer-inventory.json','consumer-review.json','actual-scientific-impact.json',
    'actual-impact-214.json','actual-impact-209.json','ingress-original.conf','ingress-held.conf',
    'qualified-build-receipt.json','qualified-image-inspect-original.json','application-index.json',
    'capture-receipt.json','apache-capture.json',
    'capture-206-prepare-original.json','capture-206-preservation.json',
    'capture-214-prepare-original.json','capture-214-preservation.json'}


def package_name(name):
    require(isinstance(name,str) and re.fullmatch('[A-Za-z0-9][A-Za-z0-9_./-]{0,200}',name) and
        all(part not in ('','.','..') for part in name.split('/')),'Exact relative package path required')
    return name


def file_pin(raw):
    require(isinstance(raw,bytes) and 0<len(raw)<=MAX_FILE_BYTES,'Bounded nonempty package input required')
    return {'sha256':sha(raw),'bytes':len(raw)}


def payload_map(files):
    require(isinstance(files,dict) and REQUIRED_PAYLOAD<=set(files) and
        not set(files)&POST_MANIFEST_FILES and 1<=len(files)<=MAX_PACKAGE_FILES,
        'Complete payload required; later review/gate inputs cannot enter the manifest hash')
    pins={package_name(name):file_pin(raw) for name,raw in sorted(files.items())}
    require(sum(p['bytes'] for p in pins.values())<=MAX_PACKAGE_BYTES,'Package total byte bound exceeded')
    return pins


def allocation(pins):
    """4096-byte file/directory allocation bound, including all parent directories."""
    require(isinstance(pins,dict) and 1<=len(pins)<=MAX_PACKAGE_FILES+4,'Bounded full package map required')
    directories={''};total=0
    for name,pin in pins.items():
        package_name(name)
        require(isinstance(pin,dict) and set(pin)=={'sha256','bytes'} and
            re.fullmatch('[a-f0-9]{64}',pin.get('sha256','')) and type(pin.get('bytes')) is int and
            0<pin['bytes']<=MAX_FILE_BYTES,'Invalid complete package pin')
        total+=((pin['bytes']+4095)//4096)*4096
        parents=name.split('/')[:-1]
        for end in range(1,len(parents)+1):directories.add('/'.join(parents[:end]))
    require(sum(p['bytes'] for p in pins.values())<=MAX_PACKAGE_BYTES,'Package total byte bound exceeded')
    # A directory is not bounded by its mere existence: hundreds of child
    # names can consume more than two blocks. Reserve one complete block for
    # every directory entry plus two base/index blocks per directory. Include
    # child-directory entries as well as file names; never assume compression.
    directory_entries=len(pins)+len(directories)-1
    return total+len(directories)*8192+directory_entries*4096


def verified_source_payload(files,index,source):
    source_review(source,index)
    require(exact_json(files['source-index.json'])==index and exact_json(files['source-review.json'])==source,
        'Retained exact source originals differ')
    tooling={'tooling/'+name for name in index['files']}
    require({name for name in files if name.startswith('tooling/')}==tooling,
        'Complete exact tooling inventory required')
    for name,pin in index['files'].items():
        raw=files['tooling/'+name]
        require(file_pin(raw)=={key:pin[key] for key in ('sha256','bytes')} and
            hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==pin['gitBlob'],
            'Raw reviewed Git source differs')
    return True


def freeze_manifest(files,index,source,whole_outage_seconds):
    """Validate actual capture inputs before creating a reviewable manifest."""
    pins=payload_map(files);verified_source_payload(files,index,source)
    disclosure=exact_json(files['whole-outage-disclosure.json'])
    require(disclosure==whole_outage_disclosure(disclosure.get('phaseEstimates')) and
        type(whole_outage_seconds) is int and disclosure['expectedOutageSeconds']<=whole_outage_seconds<=4800,
        'Exact honestly disclosed whole outage and reviewed boundary required')
    science=exact_json(files['actual-scientific-impact.json'])
    verify_scientific_originals(science,lambda name:files[name])
    from kit_provider import timestamp
    require(science['captureSourceReviewId']==source['id'] and
        timestamp(science['capturedAt'])>=timestamp(source['created_at']),
        'Fresh scientific capture must follow this exact source PASS')
    capture=exact_json(files['capture-receipt.json'])
    from kit_apache_capture import verify_apache_capture
    verify_apache_capture(exact_json(files['apache-capture.json']),files['ingress-original.conf'],
        files['ingress-held.conf'],index,source)
    from kit_capture_owned import CAPTURE_ROOT
    from kit_capture_budget import CAPTURE_TABLE_SHA
    require(capture.get('root')==CAPTURE_ROOT.as_posix() and capture.get('releaseRoot')==str(ROOT) and
        capture.get('captureTableSha256')==CAPTURE_TABLE_SHA and capture.get('head')==HEAD and
        capture.get('sourceReviewId')==source['id'] and capture.get('productionSqliteConnections')==0 and
        capture.get('scienceSha256')==sha(canonical(science)) and
        capture.get('apacheCaptureSha256')==sha(files['apache-capture.json']),
        'Fresh actual retained-copy capture receipt required')
    inventory=exact_json(files['consumer-inventory.json']);review=exact_json(files['consumer-review.json'])
    from kit_consumer_inventory import require_reviewed_inventory
    # These review assertions become authority only when the later actual
    # Exact-kit review binds this manifest and this complete review record.
    require_reviewed_inventory(inventory,review)
    require(files['ingress-original.conf']!=files['ingress-held.conf'],
        'Reviewed held ingress must differ from original ingress')
    require(sha(files['qualified-build-receipt.json'])==BUILD_RECEIPT_SHA,'Exact qualified build receipt required')
    from retained_authority import qualified
    inspected=exact_json(files['qualified-image-inspect-original.json'])
    require(isinstance(inspected,list) and len(inspected)==1,'Complete original qualified image inspection required')
    qualified(exact_json(files['qualified-build-receipt.json']),files['qualified-build-receipt.json'],inspected[0])
    application=exact_json(files['application-index.json'])
    require(sha(files['application-index.json'])==exact_json(files['qualified-build-receipt.json'])['applicationIndexSha256'],
        'Application index differs from qualified build receipt')
    from retained_app_copy import APP_PINS,validate_sources
    app_names={'application/'+name for name in APP_PINS}
    require({name for name in files if name.startswith('application/')}==app_names,
        'All actual pinned application sources required')
    validate_sources({name:files['application/'+name] for name in APP_PINS},
        {row['path']:row for row in application['entries']})
    allowed=REQUIRED_PAYLOAD|tooling_names(index)|app_names
    require(set(files)==allowed,'Expanded unreviewed package payload refused')
    result=source_review(source,index)
    return {'version':1,'scope':SOURCE_SCOPE,'root':str(ROOT),'head':HEAD,'tree':TREE,'image':IMAGE,
        'sourceIndexSha256':result['sourceIndexSha256'],'sourceReviewBodySha256':result['bodySha256'],
        'sourceReviewId':source['id'],'consumerConfigurationSha256':inventory['configurationSha256'],
        'consumerReviewSha256':sha(canonical(review)),
        'originalIngressSha256':sha(files['ingress-original.conf']),'heldIngressSha256':sha(files['ingress-held.conf']),
        'wholeOutageDisclosureSha256':sha(canonical(disclosure)),
        'actualScientificImpactSha256':sha(canonical(science)),
        'wholeOutageSeconds':whole_outage_seconds,'packageFiles':pins,'packageFilesSha256':sha(canonical(pins)),
        'payloadAllocationBoundBytes':allocation(pins),'neverRetry':True,
        'laterAppendOnlyFiles':sorted(POST_MANIFEST_FILES-{'frozen-manifest.json'})}


def tooling_names(index):return {'tooling/'+name for name in index['files']}


def validate_payload(files,manifest,index,source):
    pins=payload_map(files);verified_source_payload(files,index,source)
    require(pins==manifest.get('packageFiles') and sha(canonical(pins))==manifest.get('packageFilesSha256') and
        allocation(pins)==manifest.get('payloadAllocationBoundBytes'),'Exact frozen payload differs')
    require(manifest.get('laterAppendOnlyFiles')==sorted(POST_MANIFEST_FILES-{'frozen-manifest.json'}) and
        manifest.get('neverRetry') is True,'Exact staged package contract required')
    require(freeze_manifest(files,index,source,manifest.get('wholeOutageSeconds'))==manifest,
        'Frozen manifest metadata differs from full actual input validation')
    return True


def verify_final(files,now):
    require(isinstance(files,dict) and POST_MANIFEST_FILES<=set(files),'Complete later review/human records required')
    payload={name:raw for name,raw in files.items() if name not in POST_MANIFEST_FILES}
    manifest=exact_json(files['frozen-manifest.json']);index=exact_json(payload['source-index.json'])
    source=exact_json(payload['source-review.json']);review=exact_json(files['exact-kit-review.json'])
    validate_payload(payload,manifest,index,source)
    result=kit_review(review,manifest,index,source)
    science=exact_json(payload['actual-scientific-impact.json'])
    from kit_provider import timestamp
    require(timestamp(science['capturedAt'])<=timestamp(review['created_at']),
        'Kit review must follow actual full scientific capture')
    disclosure=exact_json(payload['whole-outage-disclosure.json'])
    confirmation=exact_json(files['yy-confirmation.json']);human=exact_json(files['yy-comment-original.json'])
    human_gate_comment(human,confirmation,now,disclosure,sha(canonical(manifest)),result)
    pins={name:file_pin(raw) for name,raw in files.items()}
    require(len(pins)<=MAX_PACKAGE_FILES+4,'Expanded final package refused')
    return {'manifest':manifest,'index':index,'source':source,'kit':review,'confirmation':confirmation,
        'human':human,'filePins':pins,'futurePackageAllocationBytes':allocation(pins)}


def sync_directory(path,required=True):
    synced=False
    if os.name=='posix':
        fd=os.open(str(path),os.O_RDONLY|getattr(os,'O_DIRECTORY',0))
        try:os.fsync(fd);synced=True
        finally:os.close(fd)
    require(synced or not required,'Operational package requires POSIX directory fsync')


def write_new_file(root,name,raw,require_directory_sync=True):
    """Independent immutable file; no hardlink, replacement or removal."""
    root=pathlib.Path(root);package_name(name);file_pin(raw)
    require(root.is_absolute() and root.is_dir(),'Existing absolute new package directory required')
    path=root/name
    for part in (root,*root.parents):require(not part.is_symlink(),'Package root alias refused')
    current=root
    for part in path.parent.relative_to(root).parts:
        current=current/part
        require(not current.is_symlink(),'Package directory alias refused')
        if not current.exists():current.mkdir(mode=0o700);sync_directory(current.parent,require_directory_sync)
        require(current.is_dir(),'Package parent is not a directory')
    fd=os.open(str(path),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
    try:
        with os.fdopen(fd,'wb',closefd=False) as stream:stream.write(raw);stream.flush();os.fsync(fd)
        os.chmod(path,0o400)
        os.fsync(fd) # The immutable inode mode follows the already-fsynced bytes.
    finally:os.close(fd)
    sync_directory(path.parent,require_directory_sync)
    return file_pin(raw)


def read_package(root,allow_later=False,require_posix_permissions=True):
    root=pathlib.Path(root)
    require(root.is_absolute() and root.is_dir(),'Existing absolute package directory required')
    for part in (root,*root.parents):require(not part.is_symlink(),'Package ancestor alias refused')
    files={};total=0;count=0;directories={''}
    for path in sorted(root.rglob('*')):
        count+=1;require(count<=MAX_PACKAGE_FILES*3,'Package node inventory bound exceeded')
        require(not path.is_symlink(),'Package entry alias refused')
        mode=path.lstat()
        if stat.S_ISDIR(mode.st_mode):directories.add(path.relative_to(root).as_posix());continue
        require(stat.S_ISREG(mode.st_mode) and mode.st_nlink==1 and
            (not require_posix_permissions or stat.S_IMODE(mode.st_mode)==0o400),
            'Independent immutable regular package file required')
        name=path.relative_to(root).as_posix();package_name(name)
        require(0<mode.st_size<=MAX_FILE_BYTES,'Complete bounded package file required')
        with path.open('rb') as stream:raw=stream.read(MAX_FILE_BYTES+1)
        after=path.stat()
        require((mode.st_dev,mode.st_ino,mode.st_size,mode.st_mtime_ns)==
            (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns) and len(raw)==mode.st_size,
            'Package input changed during read')
        files[name]=raw;total+=len(raw)
        require(len(files)<=MAX_PACKAGE_FILES+4 and total<=MAX_PACKAGE_BYTES,'Package inventory/byte bound exceeded')
    if not allow_later:require(not set(files)&(POST_MANIFEST_FILES-{'frozen-manifest.json'}),
        'Unexpected later review input in initial frozen stage')
    wanted={''}
    for name in files:
        parts=name.split('/')[:-1]
        for end in range(1,len(parts)+1):wanted.add('/'.join(parts[:end]))
    require(directories==wanted,'Expanded or empty package directory refused')
    return files
