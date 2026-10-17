"""Prepare one immutable LOCAL source-reviewed capture package; no host calls."""
import argparse
import os
import pathlib
from kit_contract import canonical,require,sha
from kit_capture_owned import CAPTURE_ROOT
from kit_capture_copy import capture_source_review
from kit_capture_inputs import MANIFEST,capture_input_manifest,verify_capture_inputs
from kit_package import read_package,write_new_file
from retained_contract import exact_json
from prepare_release import REPO,REL,raw_git,executing_source_matches,exclusive_directory,fresh_authority

PACKAGE=REPO/REL/('capture-package-'+CAPTURE_ROOT.name)


def prepare(index_file,source_file,destination=PACKAGE):
    def read(path):
        with pathlib.Path(path).open('rb') as stream:raw=stream.read(16*1024**2+1)
        require(0<len(raw)<=16*1024**2,'Bounded complete capture authority input required')
        return raw
    index=exact_json(read(index_file));source=exact_json(read(source_file))
    capture_source_review(index,source);executing_source_matches(index)
    raw=raw_git(index['sourceCommit'],[REL+n for n in index['files']])
    require(all(raw[REL+n][1]==p for n,p in index['files'].items()),'Capture published source index differs')
    files={'source-index.json':canonical(index)+b'\n','source-review.json':canonical(source)+b'\n',
        **{'tooling/'+n:raw[REL+n][0] for n in index['files']}}
    manifest=capture_input_manifest(files);files[MANIFEST]=canonical(manifest)+b'\n'
    checked=verify_capture_inputs(files)
    destination=pathlib.Path(destination);require(destination==PACKAGE,'Exact one-use LOCAL capture package required')
    evidence=exclusive_directory(destination.with_name(destination.name+'-prepare-evidence'))
    fresh_authority(evidence,index,source,'capture-prepare')
    exclusive_directory(destination)
    for name,data in sorted(files.items()):write_new_file(destination,name,data,os.name=='posix')
    require(verify_capture_inputs(read_package(destination,require_posix_permissions=os.name=='posix'))==checked,
        'Capture package changed after immutable write')
    return {'status':'CAPTURE_PACKAGE_PREPARED_NOT_DISPATCHED','root':CAPTURE_ROOT.as_posix(),
        'manifestSha256':sha(canonical(manifest)),'hostCalls':0,'gateCreated':False,'neverRetry':True}


def main():
    p=argparse.ArgumentParser();p.add_argument('--index',required=True);p.add_argument('--source',required=True)
    a=p.parse_args();print(canonical(prepare(a.index,a.source)).decode())


if __name__=='__main__':main()
