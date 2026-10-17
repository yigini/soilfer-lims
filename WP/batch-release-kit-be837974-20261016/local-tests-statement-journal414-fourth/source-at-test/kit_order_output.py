"""Before-create admissions and stopped-child closure for order-impact pipes.

Only the read-only --dry-run impact child uses this transport. APPLY owners,
their transaction handling and the existing600-second owner clock are unchanged.
Original streams are complete on success; an overflow prefix is never a PASS.
"""
import pathlib
from kit_contract import require
from retained_contract import exact_json
from retained_files import file_state
from kit_evidence import admit_evidence

STREAM_LIMIT=64*1024**2
METADATA_LIMIT=8192
OUTPUT_ADMISSION={'version':1,'maximumStdoutBytes':STREAM_LIMIT,'maximumStderrBytes':STREAM_LIMIT,
    'sentinelBytes':1,'metadataMaximumBytes':METADATA_LIMIT,'readOnlyDryRunOnly':True,
    'filesystemClosureClaimed':False}


def reserve_output(directory):
    directory=pathlib.Path(directory)
    held={}
    for name,maximum in (('order-impact.stdout',STREAM_LIMIT+1),
                         ('order-impact.stderr',STREAM_LIMIT+1),('order-impact-exit.json',METADATA_LIMIT)):
        claim=admit_evidence(directory/name,maximum,reservation=True,future_directory=directory)
        require(claim is not None,'Order-impact output requires its bound shared evidence ledger before mkdir')
        held[name]=claim
    return held


def close_output(directory,held,source_identity):
    directory=pathlib.Path(directory);meta=file_state(directory/'order-impact-exit.json')
    require(meta is not None and meta['bytes']<=METADATA_LIMIT,'Bounded original impact exit record required')
    with (directory/'order-impact-exit.json').open('rb') as stream:raw=stream.read(METADATA_LIMIT+1)
    require(len(raw)==meta['bytes'],'Impact exit record changed while reading')
    value=exact_json(raw)
    require(set(value)=={'version','childArgv','status','signal','errorType','streams','completeOriginals','neverRetry',
        'sourceBefore','sourceAfter'} and type(value['version']) is int and value['version']==1 and
        value['childArgv']==['/app/server/scripts/install_order_revisions.js',
        '--db','/app/server/prisma/dev.db','--dry-run'] and type(value['status']) is int and value['status']==0 and
        value['signal'] is None and value['errorType'] is None and value['completeOriginals'] is True and
        value['neverRetry'] is True,'Incomplete or failed read-only order-impact output; retain originals, never retry')
    source_hashes={s:None if row is None else row['sha256'] for s,row in source_identity.items()}
    require(value['sourceBefore']==value['sourceAfter']==source_hashes,
        'Order impact source triple differs from before-create admission')
    require(isinstance(value['streams'],dict) and set(value['streams'])=={'stdout','stderr'},
        'Both original impact streams required')
    actual={'order-impact-exit.json':meta['bytes']}
    for name in ('stdout','stderr'):
        path=directory/('order-impact.'+name);row=file_state(path);expected=value['streams'][name]
        require(isinstance(expected,dict) and set(expected)=={'bytes','sha256','eof','overflow'} and
            row is not None and row['bytes']<=STREAM_LIMIT and
            type(expected['bytes']) is int and row['bytes']==expected['bytes'] and row['sha256']==expected['sha256'] and
            expected['eof'] is True and expected['overflow'] is False and path.lstat().st_nlink==1,
            'Original impact stream hash/length/EOF/bound differs')
        actual[path.name]=row['bytes']
    require((directory/'order-impact-exit.json').lstat().st_nlink==1 and
        file_state(directory/'order-impact-exit.json')==meta,'Impact exit record identity changed')
    for name,claim in held.items():claim[0].settle(claim[1],actual[name])
    return {'completeOriginals':True,'files':actual,'bothStreamsBoundedBeforeCreation':True,
        'readOnlyDryRunOnly':True,'filesystemClosureClaimed':False}
