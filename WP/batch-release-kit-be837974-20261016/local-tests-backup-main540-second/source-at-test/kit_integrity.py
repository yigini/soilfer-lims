"""Stopped live integrity through a kernel read-only volume, before backup.

Hash all three original files on both sides, including SHM. Raw inputs are
never opened by a host SQLite connection. A refusal is terminal for this run.
"""
from kit_contract import require
from retained_contract import LIVE_DATA,exact_json
from retained_files import triple
from kit_owned import cli_spec

DATA_MOUNT={'Type':'volume','Name':'lims_lims-data','Source':LIVE_DATA,'Destination':'/app/server/prisma'}
EXPECTED={'integrity':'ok','foreignKeyViolations':0,'readonly':True,'fileMustExist':True,
          'kernelReadOnlyDataMountRequired':True}

def stopped_integrity(cli,journal,assert_no_writers,snapshot=triple):
    assert_no_writers()
    before=snapshot(LIVE_DATA+'/dev.db')
    journal.append('stoppedIntegrityBefore',{'originalTriple':before,'hostSqlConnections':0})
    output,result=cli.run(cli_spec('stopped-integrity',DATA_MOUNT))
    assert_no_writers()
    after=snapshot(LIVE_DATA+'/dev.db')
    journal.append('stoppedIntegrityAfter',{'originalTriple':after,'container':result,
        'originalFullTripleExactlyEqual':before==after,'hostSqlConnections':0})
    require(before==after,'Stopped live DB/WAL/SHM changed during kernel read-only integrity check')
    require(exact_json(output)==EXPECTED,'Complete stopped integrity and FK result required')
    return {**EXPECTED,'beforeTriple':before,'afterTriple':after,'container':result,
            'originalFullTripleExactlyEqual':True,'hostSqlConnections':0}
