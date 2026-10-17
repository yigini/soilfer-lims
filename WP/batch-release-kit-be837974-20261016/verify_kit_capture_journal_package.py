"""LOCAL native control pairs plus synthetic package/provider/host boundaries."""
import copy
import os
import unittest
from kit_contract import canonical,sha
from retained_contract import exact_json
from controller_output import output_read_record
from kit_capture_journal import JOURNAL_ORIGINALS,CAPTURE_JOURNAL_SITES,journal_disk_original
from kit_capture_journal_package import verify_capture_journals
import kit_capture_review as review
import kit_capture_package as unit
import kit_package as package
import verify_kit_package as package_fixtures
import verify_kit_capture_package as unit_fixtures
import verify_kit_capture_review as review_fixtures


def rebind_content(files):
    receipt=exact_json(files['capture-receipt.json'])
    receipt['files']={n:package.file_pin(files[n],n) for n in review.CAPTURE_REVIEW_FILES}
    files['capture-receipt.json']=canonical(receipt)+b'\n'
    originals={n[len(unit.PREFIX):]:r for n,r in files.items() if n.startswith(unit.PREFIX)}
    complete=exact_json(originals['capture-controller-complete.json'])
    complete['contentReceipt']={'file':'capture-receipt.json',**unit.pin(files['capture-receipt.json'])}
    originals['capture-controller-complete.json']=canonical(complete)+b'\n'
    outcome=exact_json(originals['stop-post-result.json'])
    outcome['contentCommitment']['receipt']=complete['contentReceipt']
    outcome['controllerRunCommitment']['completion']={'file':'capture-controller-complete.json',
        **unit.pin(originals['capture-controller-complete.json'])}
    originals['stop-post-result.json']=canonical(outcome)+b'\n'
    files.update(unit_fixtures.repack(originals))
    return receipt


class CaptureJournalPackage(unittest.TestCase):
    def test_real_local_two_commits_replay_all_six_originals_without_sql_or_file_rereads(self):
        with review_fixtures.review_fixture() as current:
            receipt=current.review_controller.execute()
            files={name:(current.root/name).read_bytes() for name in review.CAPTURE_REVIEW_FILES}
            result=verify_capture_journals(files,current.root)
            self.assertEqual(result['originalJournalControlCount'],6)
            self.assertTrue(result['allJournalControlSemanticsRechecked'])
            self.assertFalse(any(result[key] for key in ('journalOriginalBytesRetained','continuousPeakMeasured',
                'physicalFilesystemClosureClaimed','completeWriterFilesystemReview')))
            self.assertEqual(len(receipt['files']),28)
            for name in JOURNAL_ORIGINALS:
                value=output_read_record(current.root,name)
                self.assertEqual(files[name],canonical(value)+b'\n')
                self.assertTrue(os.path.samefile(current.root/name,current.root/(name+'.pending')))
            first=exact_json(files['capture-206-prepare-retained-temp/writer-journal-closure.json'])
            second=exact_json(files['capture-214-prepare-retained-temp/writer-journal-admission.json'])
            self.assertEqual(first['afterProfile']['sourceDbWalShm'],second['sourceDbWalShm'])

    def test_each_missing_journal_original_refuses_even_if_its_outer_pin_is_removed(self):
        files,index,source,*_=package_fixtures.package_fixture()
        for name in JOURNAL_ORIGINALS:
            changed=dict(files);del changed[name]
            receipt=exact_json(changed['capture-receipt.json']);del receipt['files'][name]
            with self.subTest(name=name),self.assertRaises((RuntimeError,KeyError)):
                review.verify_capture_receipt(receipt,lambda n:changed[n],index,source)

    def test_recomputed_every_outer_hash_cannot_hide_native_profile_or_admission_forgery(self):
        baseline,index,source,*_=package_fixtures.package_fixture()
        label='capture-206-prepare';name=label+'-retained-temp/writer-journal-admission.json'
        for fault in ('bound','layout','source-proof','header-wal','header-autovacuum','header-page-count',
            'boolean-pages','foreign-target','main-inode','directory-inode','continued-rollback','foreign-field'):
            files=dict(baseline);value=exact_json(files[name])
            if fault=='bound':value['bound']['maximumJournalBytes']-=1
            elif fault=='layout':value['layout']['declaredAllocationBytes']-=4096
            elif fault=='source-proof':value['callerProofSha256']='f'*64
            elif fault.startswith('header-'):
                header=bytearray.fromhex(value['headerHex'])
                header[18 if fault=='header-wal' else 52 if fault=='header-autovacuum' else 31]=2
                value['headerHex']=header.hex()
            elif fault=='boolean-pages':value['bound']['originalPages']=True
            elif fault=='foreign-target':value['source']='/foreign/dev.db'
            elif fault=='main-inode':value['originalFiles']['']['inode']+=1
            elif fault=='directory-inode':value['directoryIdentity'][1]+=1
            elif fault=='continued-rollback':value['requiresNoContinuingWritesAfterRollbackOrSqliteError']=False
            else:value['undeclaredProof']=True
            files[name]=canonical(value)+b'\n'
            closed_name=label+'-retained-temp/writer-journal-closure.json';closed=exact_json(files[closed_name])
            closed['admissionSha256']=sha(files[name]);files[closed_name]=canonical(closed)+b'\n'
            rebind_content(files)
            with self.subTest(fault=fault),self.assertRaises((RuntimeError,KeyError)):
                package.freeze_manifest(files,index,source,4800)

    def test_rebound_closure_cannot_invent_peak_or_writer_closure_or_change_after_profile(self):
        baseline,index,source,*_=package_fixtures.package_fixture()
        name='capture-214-prepare-retained-temp/writer-journal-closure.json'
        for fault in ('continuousPeakMeasured','journalOriginalBytesRetained','mainDatabaseGrowthBounded',
            'statementOrSqlScratchBounded','physicalFilesystemClosureClaimed','completeWriterFilesystemReview',
            'missing-after','after-wal','after-main-inode','after-boolean','wrong-admission','wrong-label'):
            files=dict(baseline);value=exact_json(files[name])
            if fault=='missing-after':del value['afterProfile']
            elif fault=='after-wal':value['afterProfile']['originalFiles']['-wal']={**value['afterProfile']['originalFiles'][''],'bytes':1}
            elif fault=='after-main-inode':value['afterProfile']['originalFiles']['']['inode']+=1
            elif fault=='after-boolean':value['afterProfile']['originalFiles']['']['bytes']=True
            elif fault=='wrong-admission':value['admissionSha256']='f'*64
            elif fault=='wrong-label':value['label']='capture-206-prepare'
            else:value[fault]=True
            files[name]=canonical(value)+b'\n';receipt=rebind_content(files)
            with self.subTest(fault=fault),self.assertRaises((RuntimeError,KeyError)):
                review.verify_capture_receipt(receipt,lambda n:files[n],index,source)

    def test_both_separate_disk_receipts_require_exact_site_path_layout_ceiling_and_before_create(self):
        baseline,index,source,*_=package_fixtures.package_fixture()
        for label in CAPTURE_JOURNAL_SITES:
            name=journal_disk_original(label)
            for fault in ('site','destination','layout','maximumBytes','beforeDestinationCreation','stageTableSha256','neverRetry'):
                files=dict(baseline);value=exact_json(files[name])
                if fault=='layout':value[fault]['entryAndInodeAllowanceBytes']=0
                elif fault=='maximumBytes':value[fault]=10**30
                elif fault in ('beforeDestinationCreation','neverRetry'):value[fault]=False
                else:value[fault]='FOREIGN'
                files[name]=canonical(value)+b'\n';receipt=rebind_content(files)
                with self.subTest(label=label,fault=fault),self.assertRaises((RuntimeError,KeyError)):
                    review.verify_capture_receipt(receipt,lambda n:files[n],index,source)

    def test_transaction_order_and_final_scientific_source_are_independently_bound(self):
        baseline,index,source,*_=package_fixtures.package_fixture()
        for fault in ('prior-bytes','final-bytes','swapped-controls','noncanonical'):
            files=dict(baseline)
            if fault=='prior-bytes':
                name='capture-214-prepare-retained-temp/writer-journal-admission.json';value=exact_json(files[name])
                value['originalFiles']['']['sha256']='f'*64;value['sourceDbWalShm']['']['sha256']='f'*64
                files[name]=canonical(value)+b'\n';name2='capture-214-prepare-retained-temp/writer-journal-closure.json'
                value=exact_json(files[name2]);value['admissionSha256']=sha(files[name]);files[name2]=canonical(value)+b'\n'
            elif fault=='final-bytes':
                name='capture-214-prepare-retained-temp/writer-journal-closure.json';value=exact_json(files[name])
                value['afterProfile']['originalFiles']['']['sha256']='f'*64
                value['afterProfile']['sourceDbWalShm']['']['sha256']='f'*64;files[name]=canonical(value)+b'\n'
            elif fault=='swapped-controls':
                a,b=[label+'-retained-temp/writer-journal-closure.json' for label in CAPTURE_JOURNAL_SITES]
                files[a],files[b]=files[b],files[a]
            else:
                name=journal_disk_original('capture-206-prepare');files[name]+=b'\n'
            receipt=rebind_content(files)
            with self.subTest(fault=fault),self.assertRaises((RuntimeError,KeyError)):
                review.verify_capture_receipt(receipt,lambda n:files[n],index,source)

    def test_same_bytes_foreign_pending_inode_refuses_independent_physical_commitment(self):
        with review_fixtures.review_fixture() as current:
            current.review_controller.execute()
            name='capture-206-prepare-retained-temp/writer-journal-admission.json'
            path=current.root/name;pending=current.root/(name+'.pending');raw=pending.read_bytes()
            pending.rename(pending.with_name(pending.name+'.original-retained'))
            pending.write_bytes(raw);pending.chmod(0o400)
            os.link(pending,pending.with_name(pending.name+'.foreign-retained'))
            self.assertEqual(path.stat().st_nlink,2);self.assertEqual(pending.stat().st_nlink,2)
            with self.assertRaises(RuntimeError):output_read_record(current.root,name)

