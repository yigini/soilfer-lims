"""Before-create main-journal admission for the two retained capture writers.

The supported rollback profile is deliberately narrow. Main-file growth,
statement journals, SQL scratch, journal originals and physical allocation
remain separate obligations; a closed admission does not qualify a writer.
"""
import json
import pathlib
from kit_contract import canonical,require,sha
from kit_rollback_journal import rollback_journal_plan
from kit_app_snapshots import regular,unchanged_source,SUFFIXES

CAPTURE_JOURNAL_SITES={'capture-206-prepare':'capture-206-main-journal',
    'capture-214-prepare':'capture-214-main-journal'}
# For M=N*P, P>=512, N>=1, the conditional content bound is at most
# (257+1/64)*M+262144. Rounding plus one entry/inode allowance adds <=12287.
# At M>=512 this is <794*M. The ordinary 25% stage margin is additional.
# This is a conservative held ceiling, never a claim that capacity fits.
JOURNAL_DB_COST=794
PROOF_NAME='capture-writer-journal-source.json'


def journal_disk_original(label):
    require(label in CAPTURE_JOURNAL_SITES,'Exact capture writer journal label required')
    key=CAPTURE_JOURNAL_SITES[label]+'\0scientific-database/dev.db-journal'
    return 'copy-admission-'+sha(key.encode())[:32]+'.json'


JOURNAL_ORIGINALS=frozenset(name for label in CAPTURE_JOURNAL_SITES for name in (
    label+'-retained-temp/writer-journal-admission.json',
    label+'-retained-temp/writer-journal-closure.json',journal_disk_original(label)))


def caller_proof():
    raw=pathlib.Path(__file__).with_name(PROOF_NAME).read_bytes()
    value=json.loads(raw)
    require(value.get('scope')=='CAPTURE_206_214_MAIN_ROLLBACK_JOURNAL_ONLY' and
        value.get('completeMainJournalCallerReview') is True and
        value.get('completeWriterFilesystemReview') is False and
        value.get('maximumSectorBytes')==65536 and
        set(value.get('labels',[]))==set(CAPTURE_JOURNAL_SITES),
        'Exact capture main-journal caller proof required')
    return sha(raw)


def capture_journal_plan(spec):
    from kit_capture_owned import validate_capture_spec,CAPTURE_ROOT
    validate_capture_spec(spec)
    require(spec['label'] in CAPTURE_JOURNAL_SITES and spec['dataWritable'] is True,
        'Only the two compiled capture preparation writers are supported')
    target=CAPTURE_ROOT/'scientific-database/dev.db'
    require(pathlib.Path(spec['mounts'][0]['Source'])==target.parent,
        'Capture journal target differs from its retained writable bind')
    plan=rollback_journal_plan(target)
    plan.update(version=2,scope='CAPTURE_MAIN_ROLLBACK_JOURNAL_ADMISSION',label=spec['label'],
        callerProofSha256=caller_proof(),directoryIdentity=[target.parent.stat().st_dev,target.parent.stat().st_ino],
        containerSource='/app/server/prisma/dev.db',writerGraphAdmissionImplemented=True,
        completeWriterFilesystemReview=False)
    require(len(canonical(plan)+b'\n')<=8192,'Full capture journal admission exceeds its immutable envelope')
    return plan


def recheck_capture_journal(plan):
    require(plan.get('label') in CAPTURE_JOURNAL_SITES and plan.get('callerProofSha256')==caller_proof(),
        'Foreign or changed capture journal caller proof')
    unchanged_source(plan['source'],plan)
    journal=pathlib.Path(plan['journal'])
    require(not journal.exists() and not journal.is_symlink(),'Journal appeared before writer creation')


def close_capture_journal(plan):
    require(plan.get('scope')=='CAPTURE_MAIN_ROLLBACK_JOURNAL_ADMISSION' and
        plan.get('callerProofSha256')==caller_proof(),'Original capture journal admission required')
    target=pathlib.Path(plan['source']);parent=target.parent
    require([parent.stat().st_dev,parent.stat().st_ino]==plan['directoryIdentity'] and
        parent.resolve()==parent and not parent.is_symlink(),'Capture journal directory changed')
    require({p.name for p in parent.iterdir()}<={'dev.db','dev.db-wal','dev.db-shm'},
        'Capture writer left a journal or foreign entry')
    profile=rollback_journal_plan(target);after=profile['originalFiles']
    before=plan['originalFiles'][''];main=after['']
    require(main is not None and all(main[key]==before[key] for key in ('device','inode','mode')),
        'Capture writer replaced its independent main file')
    for suffix in ('-wal','-shm'):
        row=after[suffix]
        require(row is None or row['bytes']==0,'Capture writer left WAL or shared-memory content')
    # Absence is only a postcondition. The maximum comes from the held source
    # bound and caller review, never from this final observation.
    return {'version':2,'label':plan['label'],'admissionSha256':sha(canonical(plan)+b'\n'),
        'afterProfile':profile,
        'maximumJournalBytes':plan['bound']['maximumJournalBytes'],'journalAbsentAfterChildClose':True,
        'mainInodePreserved':True,'journalOriginalBytesRetained':False,'continuousPeakMeasured':False,
        'mainDatabaseGrowthBounded':False,'statementOrSqlScratchBounded':False,
        'physicalFilesystemClosureClaimed':False,'completeWriterFilesystemReview':False}
