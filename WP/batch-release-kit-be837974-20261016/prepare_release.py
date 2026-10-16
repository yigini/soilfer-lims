"""Build an immutable LOCAL package from exact raw Git and actual reviewed capture.

No SSH, production filesystem, Docker, SQL, human message or gate is touched.
Fresh primary authority is mandatory before any new package directory exists.
The later exact-kit review and actual human confirmation are append-only.
"""
import argparse
import hashlib
import os
import pathlib
import re
import subprocess
import time
from kit_contract import HEAD,TREE,IMAGE,BUILD_RECEIPT_SHA,canonical,require,sha
from retained_contract import ROOT,ROOT_NAME,exact_json
from kit_frozen import REQUIRED_SOURCE,SOURCE_SCOPE,source_index,source_review,kit_review,human_gate_comment
from kit_package import (REQUIRED_PAYLOAD,POST_MANIFEST_FILES,freeze_manifest,validate_payload,
    verify_final,read_package,write_new_file,sync_directory)
from kit_provider import GitHubProvider
from kit_authority import standing_authority,no_later_release_direction,review_projection
from kit_io import CommandRunner

REPO=pathlib.Path(__file__).resolve().parents[2]
REL='WP/batch-release-kit-be837974-20261016/'
PACKAGE=REPO/REL/('release-package-'+ROOT_NAME)


def raw_git(commit,paths,repo=REPO):
    require(re.fullmatch('[a-f0-9]{40}',commit or '') and isinstance(paths,(list,tuple,set)) and
        1<=len(paths)<=2048 and len(paths)==len(set(paths)),'Exact published Git commit and bounded distinct paths required')
    result={}
    for name in sorted(paths):
        require(isinstance(name,str) and not name.startswith(('/','-')) and '\\' not in name and
            all(p not in ('','.','..') for p in name.split('/')),'Exact Git path required')
    tree=subprocess.check_output(['git','ls-tree','-rzl',commit,'--',*sorted(paths)],cwd=repo,timeout=30)
    entries={};total=0
    for row in tree.split(b'\0'):
        if not row:continue
        meta,path=row.split(b'\t',1);mode,kind,oid,size=meta.decode('ascii').split();name=path.decode()
        require(name in paths and name not in entries and mode in ('100644','100755') and
            kind=='blob' and size.isdecimal() and 0<int(size)<=16*1024**2,'Complete regular raw Git entry required')
        entries[name]=(oid,int(size));total+=int(size)
    require(set(entries)==set(paths) and total<=128*1024**2,'Missing/expanded/excessive raw Git graph')
    ordered=sorted(paths)
    batch=subprocess.check_output(['git','cat-file','--batch'],cwd=repo,timeout=30,
        input=('\n'.join(entries[name][0] for name in ordered)+'\n').encode())
    require(len(batch)<=total+len(ordered)*128,'Expanded Git batch refused');offset=0
    for name in ordered:
        end=batch.index(b'\n',offset);oid,kind,size=batch[offset:end].decode('ascii').split();offset=end+1
        require(kind=='blob' and (oid,int(size))==entries[name],'Raw Git batch header differs')
        raw=batch[offset:offset+int(size)];offset+=int(size)
        require(batch[offset:offset+1]==b'\n' and len(raw)==int(size) and
            hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==oid,'Raw Git blob size/identity differs')
        offset+=1;result[name]=(raw,{'sha256':sha(raw),'bytes':len(raw),'gitBlob':oid})
    require(offset==len(batch),'Trailing Git batch response refused')
    return result


def build_source_index(commit):
    files=raw_git(commit,[REL+name for name in REQUIRED_SOURCE])
    value={'version':1,'scope':SOURCE_SCOPE,'root':str(ROOT),'head':HEAD,'tree':TREE,'image':IMAGE,
        'buildReceiptSha256':BUILD_RECEIPT_SHA,'sourceCommit':commit,
        'files':{name:files[REL+name][1] for name in sorted(REQUIRED_SOURCE)}}
    source_index(value);return value


def executing_source_matches(index):
    source_index(index)
    for name,pin in index['files'].items():
        raw=(REPO/REL/name).read_bytes()
        require(len(raw)==pin['bytes'] and sha(raw)==pin['sha256'],'Executing preparer/launcher graph differs from reviewed raw Git')


def fresh_authority(evidence,index,source,namespace,kit=None,human=None):
    runner=CommandRunner(evidence,lambda needed:None,os.name=='posix',programs=frozenset({'gh'}))
    provider=GitHubProvider(runner,namespace,transport='gh')
    snapshot=provider.source_snapshot(source['id']) if kit is None else provider.snapshot(source['id'],kit['id'],human['id'])
    standing_authority(snapshot);source_review(snapshot['source'],index)
    require(review_projection(snapshot['source'])==review_projection(source),'Actual exact source review changed')
    no_later_release_direction(snapshot['releaseComments'],source,kit or source)
    if kit is not None:
        require(review_projection(snapshot['kit'])==review_projection(kit) and
            review_projection(snapshot['human'])==review_projection(human),'Actual exact-kit/human record changed')
    return snapshot


def exclusive_directory(path):
    path=pathlib.Path(path)
    require(path.is_absolute() and path.parent.is_dir(),'Existing absolute parent required for exclusive package/evidence directory')
    for part in (path,*path.parents):require(not part.is_symlink(),'Package/evidence ancestor alias refused')
    path.mkdir(mode=0o700);sync_directory(path.parent,os.name=='posix');return path


def prepare(index_file,source_file,capture_directory,destination,whole_outage_seconds):
    index=exact_json(pathlib.Path(index_file).read_bytes());source=exact_json(pathlib.Path(source_file).read_bytes())
    source_review(source,index);executing_source_matches(index)
    # Source publication and local operational files must be identical. A
    # half-written source graph cannot acquire authority from an old PASS.
    raw=raw_git(index['sourceCommit'],[REL+name for name in index['files']])
    require(all(raw[REL+name][1]==pin for name,pin in index['files'].items()),'Published source index differs from raw Git')
    from kit_recovery_copy import HEAD as OLD_HEAD,validate as validate_old
    profile=exact_json(raw[REL+'predecessor-copy-source-binding.json'][0])
    validate_old({n:r[0] for n,r in raw_git(OLD_HEAD,list(profile['files'])).items()},profile)
    capture=read_package(pathlib.Path(capture_directory),require_posix_permissions=os.name=='posix')
    from kit_capture_package import capture_unit_payload
    unit_files=capture_unit_payload(capture,index,source)
    expected=(REQUIRED_PAYLOAD-{'source-index.json','source-review.json','whole-outage-disclosure.json'})|unit_files
    require(set(capture)==expected,'Capture directory contains missing/extra inputs')
    files={**capture,'source-index.json':canonical(index)+b'\n','source-review.json':canonical(source)+b'\n',
        'whole-outage-disclosure.json':raw[REL+'whole-outage-disclosure.json'][0]}
    files.update({'tooling/'+name:raw[REL+name][0] for name in index['files']})
    from retained_app_copy import APP_PINS
    app=raw_git(HEAD,list(APP_PINS))
    files.update({'application/'+name:app[name][0] for name in APP_PINS})
    manifest=freeze_manifest(files,index,source,whole_outage_seconds)
    destination=pathlib.Path(destination)
    require(destination==PACKAGE,'Only the fixed one-use release package destination is authorized')
    evidence=exclusive_directory(destination.with_name(destination.name+'-prepare-evidence'))
    fresh_authority(evidence,index,source,'local-prepare')
    exclusive_directory(destination)
    for name,data in sorted(files.items()):write_new_file(destination,name,data,os.name=='posix')
    write_new_file(destination,'frozen-manifest.json',canonical(manifest)+b'\n',os.name=='posix')
    check=read_package(destination,require_posix_permissions=os.name=='posix')
    validate_payload({n:r for n,r in check.items() if n!='frozen-manifest.json'},manifest,index,source)
    return {'status':'FROZEN_AWAITING_ACTUAL_EXACT_KIT_REVIEW','manifestSha256':sha(canonical(manifest)),
        'root':str(ROOT),'packageFiles':len(files),'hostCalls':0,'productionSqliteConnections':0,'gateCreated':False}


def append_kit_review(package,original_file):
    package=pathlib.Path(package);files=read_package(package,require_posix_permissions=os.name=='posix')
    require(set(files)&POST_MANIFEST_FILES=={'frozen-manifest.json'},'Initial frozen stage required before exact-kit review append')
    manifest=exact_json(files.pop('frozen-manifest.json'));index=exact_json(files['source-index.json']);source=exact_json(files['source-review.json'])
    validate_payload(files,manifest,index,source);executing_source_matches(index)
    raw=pathlib.Path(original_file).read_bytes();review=exact_json(raw);kit_review(review,manifest,index,source)
    # The launcher independently authenticates this original with a fresh
    # primary snapshot. Appending this file never creates or consumes a gate.
    write_new_file(package,'exact-kit-review.json',raw,os.name=='posix')
    return {'status':'EXACT_KIT_RECORD_APPENDED_AWAITING_FRESH_ACTUAL_HUMAN','gateCreated':False}


def append_human(package,confirmation_file,original_file,now=None):
    package=pathlib.Path(package);files=read_package(package,True,os.name=='posix')
    require(set(files)&POST_MANIFEST_FILES=={'frozen-manifest.json','exact-kit-review.json'},
        'Exactly one immutable kit review must precede human append')
    confirmation=pathlib.Path(confirmation_file).read_bytes();human=pathlib.Path(original_file).read_bytes()
    final={**files,'yy-confirmation.json':confirmation,'yy-comment-original.json':human}
    verify_final(final,time.time() if now is None else now)
    # A lost first write leaves a consumed partial package. No replace/delete
    # or "complete it later" path exists; every partial file is retained.
    write_new_file(package,'yy-confirmation.json',confirmation,os.name=='posix')
    write_new_file(package,'yy-comment-original.json',human,os.name=='posix')
    return {'status':'HUMAN_ORIGINALS_APPENDED_NOT_CONSUMED','gateCreated':False}


def main():
    p=argparse.ArgumentParser();sub=p.add_subparsers(dest='mode',required=True)
    a=sub.add_parser('source-index');a.add_argument('--source-commit',required=True)
    a=sub.add_parser('freeze');a.add_argument('--source-index',required=True);a.add_argument('--source-review',required=True)
    a.add_argument('--capture-directory',required=True);a.add_argument('--destination',required=True)
    a.add_argument('--whole-outage-seconds',type=int,required=True)
    a=sub.add_parser('append-kit-review');a.add_argument('--package',required=True);a.add_argument('--original',required=True)
    a=sub.add_parser('append-human');a.add_argument('--package',required=True);a.add_argument('--confirmation',required=True);a.add_argument('--original',required=True)
    a=p.parse_args()
    if a.mode=='source-index':result=build_source_index(a.source_commit)
    elif a.mode=='freeze':result=prepare(a.source_index,a.source_review,a.capture_directory,a.destination,a.whole_outage_seconds)
    elif a.mode=='append-kit-review':result=append_kit_review(a.package,a.original)
    else:result=append_human(a.package,a.confirmation,a.original)
    print(canonical(result).decode())

if __name__=='__main__':main()
