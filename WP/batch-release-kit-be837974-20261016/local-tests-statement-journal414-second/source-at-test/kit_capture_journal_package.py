"""Replay every capture main-journal control original without opening a DB.

These are admission/closure observations, not SQLite journal contents. Header
observations, hashes and native-source conditions do not establish continuous
peak retention, physical allocation or complete writer/filesystem admission.
"""
import pathlib
import re
import stat
from kit_contract import canonical,require,sha
from kit_capture_journal import CAPTURE_JOURNAL_SITES,JOURNAL_ORIGINALS,caller_proof,journal_disk_original
from kit_rollback_journal import rollback_header_bound
from kit_copy_admission import copy_layout
from retained_contract import exact_json
from retained_files import identity_record


def journal_profile(value,target):
    """Validate an entire retained profile, including strict JSON field types."""
    require(isinstance(value,dict),'Full original main-journal profile required')
    rows=value.get('originalFiles')
    require(isinstance(rows,dict) and set(rows)=={'','-wal','-shm'} and isinstance(rows[''],dict),
        'Full original independent main/WAL/SHM observations required')
    identities=set();device=rows[''].get('device')
    for suffix,row in rows.items():
        if row is None:continue
        require(isinstance(row,dict) and set(row)=={'sha256','bytes','device','inode','mtimeNs','mode','allocatedBytes'} and
            isinstance(row['sha256'],str) and re.fullmatch('[a-f0-9]{64}',row['sha256']) and
            all(type(row[key]) is int and row[key]>=0 for key in ('bytes','device','mtimeNs','mode','allocatedBytes')) and
            type(row['inode']) is int and row['inode']>0 and row['mode']<=0o7777,
            'Exact original file identity fields required')
        key=(row['device'],row['inode'])
        require(row['device']==device and key not in identities,'Original triple device/inode alias refused')
        identities.add(key)
        if suffix:require(row['bytes']==0 and row['sha256']==sha(b''),'Nonempty or inconsistent WAL/SHM observation refused')
    header=value.get('headerHex')
    require(isinstance(header,str) and re.fullmatch('[a-f0-9]{200}',header),'Full original100-byte native header required')
    bound=rollback_header_bound(bytes.fromhex(header),rows['']['bytes'])
    expected={'version':1,'scope':'CONDITIONAL_SINGLE_MAIN_ROLLBACK_TRANSACTION',
        'source':str(target),'sourceDbWalShm':identity_record(rows),'originalFiles':rows,
        'journal':str(target)+'-journal','headerHex':header,'bound':bound,
        'layout':copy_layout([bound['maximumJournalBytes']],0),
        'requiredBeforeWriterCreation':True,'sourceQuiescenceRequired':True,
        'requiresNoPageMoves':True,'requiresNoAttachVacuumOrJournalSettingChange':True,
        'requiresNoContinuingWritesAfterRollbackOrSqliteError':True,
        'requiresPinnedNativeVfsAndCompleteCallerReview':True,'maximumIsSourceDerivedNotSampledPeak':True,
        'writerGraphAdmissionImplemented':False,'walGrowthBounded':False,'mainDatabaseGrowthBounded':False,
        'statementOrSqlScratchBounded':False,'journalOriginalBytesRetained':False,
        'physicalFilesystemClosureClaimed':False}
    return expected


def verify_capture_journals(files,root):
    """Replay the two transactions and BOTH separately held disk admissions."""
    from kit_capture_budget import CaptureBudget,CAPTURE_TABLE_SHA
    root=pathlib.Path(root);target=root/'scientific-database/dev.db'
    require(JOURNAL_ORIGINALS<=set(files),'Every journal admission, disk reservation and closure original required')
    values={}
    for name in JOURNAL_ORIGINALS:
        raw=files[name]
        require(isinstance(raw,bytes) and 0<len(raw)<=8192,'Bounded original journal control required')
        values[name]=exact_json(raw)
        require(raw==canonical(values[name])+b'\n','Exact canonical journal control original required')
    clone=exact_json(files['capture-clone-provenance.json'])
    initial=clone.get('initialCloneIdentity')
    require(isinstance(initial,dict) and isinstance(initial.get('files'),dict),
        'Original clone inode/directory provenance required for journal admission')
    directory=initial.get('databaseDirectoryIdentity');main=initial['files'].get('dev.db')
    require(isinstance(directory,list) and len(directory)==2 and
        all(type(n) is int and n>=0 for n in directory) and directory[1]>0 and
        isinstance(main,list) and len(main)==7 and all(type(n) is int and n>=0 for n in main) and
        main[0]==directory[0] and main[1]>0 and main[6]==1 and stat.S_ISREG(main[5]),
        'Exact independent original clone identity required')
    stages=exact_json(files['capture-stage-closures.json']);inputs=stages['budgetInputs']
    budget=CaptureBudget(inputs['databaseAllocatedBytes'],inputs['assetsAllocatedBytes'],inputs['imageBytes'])
    prior=clone['initialCloneByteIdentity'];proof=caller_proof()
    for label,site in CAPTURE_JOURNAL_SITES.items():
        admission_name=label+'-retained-temp/writer-journal-admission.json'
        closure_name=label+'-retained-temp/writer-journal-closure.json'
        admission=values[admission_name];closed=values[closure_name]
        profile=journal_profile(admission,target)
        expected={**profile,'version':2,'scope':'CAPTURE_MAIN_ROLLBACK_JOURNAL_ADMISSION','label':label,
            'callerProofSha256':proof,'directoryIdentity':directory,'containerSource':'/app/server/prisma/dev.db',
            'writerGraphAdmissionImplemented':True,'completeWriterFilesystemReview':False}
        require(canonical(admission)==canonical(expected),'Original journal plan, source proof, profile or exact bound differs')
        before=admission['originalFiles']['']
        require(before['device']==main[0] and before['inode']==main[1] and before['mode']==stat.S_IMODE(main[5]) and
            canonical(admission['sourceDbWalShm'])==canonical(prior),
            'Journal transactions do not follow the same original clone and preceding closed bytes')
        after=closed.get('afterProfile')
        require(canonical(after)==canonical(journal_profile(after,target)),
            'Original post-child supported profile differs')
        current=after['originalFiles']['']
        require(all(current[key]==before[key] for key in ('device','inode','mode')) and
            after['bound']['pageSize']==admission['bound']['pageSize'],
            'Main identity or page size changed across the captured writer')
        expected_closed={'version':2,'label':label,'admissionSha256':sha(files[admission_name]),'afterProfile':after,
            'maximumJournalBytes':admission['bound']['maximumJournalBytes'],'journalAbsentAfterChildClose':True,
            'mainInodePreserved':True,'journalOriginalBytesRetained':False,'continuousPeakMeasured':False,
            'mainDatabaseGrowthBounded':False,'statementOrSqlScratchBounded':False,
            'physicalFilesystemClosureClaimed':False,'completeWriterFilesystemReview':False}
        require(canonical(closed)==canonical(expected_closed),'Original journal closure, admission link or authority differs')
        from kit_capture_budget import capture_ceiling
        ceiling=capture_ceiling(budget.db,budget.assets,label,site)
        # Use the compiled producer cost, never a caller-provided ceiling.
        from kit_capture_journal import JOURNAL_DB_COST
        require(JOURNAL_DB_COST==794,'Reviewed maximum-sector journal geometry changed')
        reservation={'site':site,'destination':str(target)+'-journal','layout':admission['layout'],
            'maximumBytes':ceiling,'beforeDestinationCreation':True,'stageTableSha256':CAPTURE_TABLE_SHA,
            'neverRetry':True,'sqliteTemporaryFilesAndGlobalFilesystemClosureClaimed':False}
        require(canonical(values[journal_disk_original(label)])==canonical(reservation) and
            admission['layout']['declaredAllocationBytes']<=ceiling,
            'Original separately held journal capacity admission differs or is insufficient')
        prior=after['sourceDbWalShm']
    impact=exact_json(files['actual-impact-209.json'])
    require(canonical(impact['originalDbWalShmSha256'])==canonical(prior),
        'Final readonly scientific source differs from the last closed journal transaction')
    return {'originalJournalControlCount':len(JOURNAL_ORIGINALS),'allJournalControlSemanticsRechecked':True,
        'journalOriginalBytesRetained':False,'continuousPeakMeasured':False,
        'physicalFilesystemClosureClaimed':False,'completeWriterFilesystemReview':False}
