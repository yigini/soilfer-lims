"""Refusal tests for NEW authority; no network, Docker, or production access."""
import copy
import datetime
import hashlib
import json
import unittest
from unittest.mock import patch

import import_proof_contract as contract
import import_source_graph as graph

RAW_TOOLING = {}  # Injected exact raw Git fixtures by the guard runner.


class AuthorityTests(unittest.TestCase):
    def setUp(self):
        self.original_unbound = (contract.AUDITED_PR_HEAD, contract.CANDIDATE_HEAD,
            contract.AUDITED_PR_TREE, contract.MERGED_TREE, contract.MERGE_PARENTS)
        for name, value in [('AUDITED_PR_HEAD', 'a' * 40), ('CANDIDATE_HEAD', 'b' * 40),
                ('AUDITED_PR_TREE', 'c' * 40), ('MERGED_TREE', 'c' * 40),
                ('MERGE_PARENTS', [contract.MERGE_BASE_HEAD, 'a' * 40]),
                ('PR_NUMBER', 999), ('AUDIT_REVIEW_ID', 123),
                ('EXPECTED_PROOF_ROOT', '/opt/lims/releases/instrument-import-proof-owned')]:
            patcher = patch.object(contract, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.files = {name: hashlib.sha256(raw).hexdigest() for name, raw in RAW_TOOLING.items()}
        self.pin = {'head': contract.CANDIDATE_HEAD, 'baseHead': contract.BASE_HEAD,
            'mergeBaseHead': contract.MERGE_BASE_HEAD,
            'originalProofRoot': contract.EXPECTED_PROOF_ROOT, 'firstProofPolicy': contract.FIRST_PROOF_POLICY,
            'auditedPrHead': contract.AUDITED_PR_HEAD, 'pr': contract.PR_NUMBER, 'tree': contract.MERGED_TREE,
            'auditedTree': contract.AUDITED_PR_TREE, 'mergeParents': contract.MERGE_PARENTS,
            'auditReviewId': 123, 'mainCiRunId': 456, 'image': 'sha256:' + 'd' * 64, 'imageBytes': 400,
            'labAndHubBuildsOwnedByYY': True, 'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
        self.built = {'status': 'BUILT_ONLY_NOT_DEPLOYED', 'head': self.pin['head'],
            'tree': self.pin['tree'], 'productionDatabaseMounts': 0,
            'image': self.pin['image'], 'imageBytes': 400}
        self.image = {'Id': self.pin['image'], 'Size': 400,
            'Config': {'Labels': {'org.opencontainers.image.revision': self.pin['head']}}}

    def source_review(self):
        # Build a positive source verdict from public binding tokens plus the
        # fixed documented policy tokens, never from approval side effects.
        tokens = contract.release_binding_tokens() + ['1' * 40,
            'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED',
            'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10', 'BASELINE_ATTEMPTS_MAX=3',
            'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10',
            'proofBaselineLayoutPolicy=EXACT_HASHED_IMPORT_PROOF_AUTHORITY_LAYOUT',
            'refusalScopeCommentId=' + str(contract.REFUSAL_SCOPE_COMMENT_ID),
            contract.REFUSAL_POLICY, contract.CARDINALITY_POLICY,
            'refusalPairingScopeCommentId=' + str(contract.REFUSAL_PAIRING_SCOPE_COMMENT_ID),
            'schedulerRefusalPairing=' + contract.REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS=1']
        tokens += [name + '=' + digest for name, digest in sorted(self.files.items())]
        return {'id': 9999999999, 'html_url': 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-9999999999',
            'created_at': '2026-10-12T00:00:00Z', 'body': 'Source review: PASS\n' + '\n'.join(tokens)}

    def test_bound_application_identity_cannot_become_unreviewed_or_unmerged(self):
        for name in ['AUDITED_PR_HEAD', 'CANDIDATE_HEAD', 'AUDITED_PR_TREE', 'MERGED_TREE']:
            with self.subTest(name=name), patch.object(contract, name, 'UNMERGED_REFUSE'), self.assertRaises(RuntimeError):
                contract.bound_candidate()

    def test_exact_candidate_accepts_only_bound_tree_image_and_both_pins(self):
        contract.validate_candidate(self.pin, self.built, self.image)
        for key, value in [('head', contract.BASE_HEAD), ('tree', 'e' * 40), ('auditedTree', 'e' * 40),
                ('pr', 293), ('pr', True), ('imageBytes', 401), ('auditReviewId', 0), ('mainCiRunId', None),
                ('labAndHubBuildsOwnedByYY', False), ('releaseWindowControl', 'OTHER')]:
            with self.subTest(key=key, value=value), self.assertRaises(RuntimeError):
                contract.validate_candidate({**self.pin, key: value}, self.built, self.image)

    def test_live_predecessor_and_application_merge_base_are_separately_bound(self):
        self.assertNotEqual(contract.BASE_HEAD, contract.MERGE_BASE_HEAD)
        for key, value in [('baseHead', contract.MERGE_BASE_HEAD),
                ('mergeBaseHead', contract.BASE_HEAD), ('auditReviewId', 124),
                ('auditReviewId', True), ('firstProofPolicy', 'ANY_PASSED_PROOF'),
                ('originalProofRoot', '/opt/lims/releases/instrument-import-proof-another')]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                contract.candidate_identity({**self.pin, key: value})

    def test_only_reviewed_first_root_allowed_and_failed_original_always_refuses(self):
        contract.require_first_proof_root(contract.EXPECTED_PROOF_ROOT)
        for root in [None, '/opt/lims/releases/instrument-import-proof-another',
                '/opt/lims/releases/../releases/instrument-import-proof-owned',
                '/opt/lims/releases/instrument-import-proof-owned/',
                '/tmp/instrument-import-proof-owned', *contract.FAILED_PROOF_ROOTS]:
            with self.subTest(root=root), self.assertRaises(RuntimeError):
                contract.require_first_proof_root(root)
        failed = next(iter(contract.FAILED_PROOF_ROOTS))
        with patch.object(contract, 'EXPECTED_PROOF_ROOT', failed), self.assertRaises(RuntimeError):
            contract.require_first_proof_root(failed)

    def test_unbound_new_pr_review_and_first_root_refuse_without_any_operation(self):
        for name, value in [('PR_NUMBER', 0), ('PR_NUMBER', 284), ('PR_NUMBER', True),
                ('AUDIT_REVIEW_ID', 0), ('AUDIT_REVIEW_ID', 6121933894),
                ('AUDIT_REVIEW_ID', True), ('EXPECTED_PROOF_ROOT', 'UNREVIEWED_FIRST_PROOF_REFUSE')]:
            with self.subTest(name=name), patch.object(contract, name, value), self.assertRaises(RuntimeError):
                contract.release_binding_tokens()

    def test_failed_old_or_production_mounted_build_cannot_feed_proof(self):
        for key, value in [('status', 'FAILED'), ('head', contract.BASE_HEAD), ('productionDatabaseMounts', 1)]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                contract.validate_candidate(self.pin, {**self.built, key: value}, self.image)
        image = copy.deepcopy(self.image)
        image['Config']['Labels']['org.opencontainers.image.revision'] = contract.BASE_HEAD
        with self.assertRaises(RuntimeError): contract.validate_candidate(self.pin, self.built, image)

    def test_parent_order_and_audited_tree_cannot_drift(self):
        merged = {'sha': contract.CANDIDATE_HEAD, 'tree': {'sha': contract.MERGED_TREE},
            'parents': [{'sha': value} for value in contract.MERGE_PARENTS]}
        audited = {'sha': contract.AUDITED_PR_HEAD, 'tree': {'sha': contract.AUDITED_PR_TREE}}
        contract.validate_merge_identity(merged, audited)
        for row in [{**merged, 'parents': list(reversed(merged['parents']))},
                {**merged, 'tree': {'sha': 'e' * 40}}, {**merged, 'sha': contract.BASE_HEAD}]:
            with self.assertRaises(RuntimeError): contract.validate_merge_identity(row, audited)

    def test_positive_new_source_pass_is_bound_to_all_raw_source(self):
        contract.source_review_pass(self.source_review(), '1' * 40, self.files)
        for name, digest in self.files.items():
            changed = self.source_review()
            changed['body'] = changed['body'].replace(name + '=' + digest, name + '=' + 'e' * 64)
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                contract.source_review_pass(changed, '1' * 40, self.files)

    def test_historical_zero_negative_or_boolean_source_reviews_refuse(self):
        for identifier in [0, -1, True, *contract.HISTORICAL_SOURCE_REVIEWS]:
            row = self.source_review(); row['id'] = identifier
            row['html_url'] = 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(identifier)
            with self.subTest(id=identifier), self.assertRaises(RuntimeError):
                contract.source_review_pass(row, '1' * 40, self.files)

    def test_quoted_negated_future_or_other_issue_source_pass_refuses(self):
        positive = self.source_review()
        for body in ['> ' + positive['body'], 'Pending\n' + positive['body'],
                positive['body'] + '\nSource review: FAILED', positive['body'] + '\nAudit failed']:
            with self.subTest(body=body[:30]), self.assertRaises(RuntimeError):
                contract.source_review_pass({**positive, 'body': body}, '1' * 40, self.files)
        for key, value in [('created_at', '2099-01-01T00:00:00Z'),
                ('html_url', positive['html_url'].replace('/162#', '/191#'))]:
            with self.assertRaises(RuntimeError):
                contract.source_review_pass({**positive, key: value}, '1' * 40, self.files)

    def test_primary_exact_pr_verdict_required(self):
        row = {'id': 123, 'html_url': 'https://github.com/yigini/soilfer-lims/pull/999#issuecomment-123',
            'body': 'Audit passed: OK to merge and deploy\n' + contract.AUDITED_PR_HEAD}
        contract.require_pr_review(row)
        for key, value in [('body', '> ' + row['body']), ('body', 'Pending\n' + row['body']),
                ('body', row['body'] + '\nAudit failed'), ('id', True),
                ('body', row['body'].replace(contract.AUDITED_PR_HEAD, contract.BASE_HEAD)),
                ('html_url', row['html_url'].replace('/999#', '/284#'))]:
            with self.subTest(key=key), self.assertRaises(RuntimeError): contract.require_pr_review({**row, key: value})

    def test_source_graph_missing_extra_wrong_shape_or_changed_historical_helper_refuses(self):
        graph.require_source_set(self.files)
        for name in self.files:
            omitted = dict(self.files); omitted.pop(name)
            with self.subTest(missing=name), self.assertRaises(RuntimeError): graph.require_source_set(omitted)
        for changed in [{**self.files, 'foreign.py': 'a' * 64},
                {**self.files, 'rehearse_import.py': 'a' * 63},
                {**self.files, 'known_core_disk_guard_v2.py': 'e' * 64}]:
            with self.assertRaises(RuntimeError): graph.require_source_set(changed)

    def test_raw_git_inventory_blob_identity_mode_and_path_are_checked(self):
        objects = {hashlib.sha1(('blob ' + str(len(raw)) + '\0').encode() + raw).hexdigest(): raw
            for raw in RAW_TOOLING.values()}
        paths = {path: name for name, path in graph.SOURCE_PATHS.items()}
        altered = {}
        def git(*args):
            if args[0] == 'ls-tree':
                path = args[-1]; raw = RAW_TOOLING[paths[path]]
                blob = hashlib.sha1(('blob ' + str(len(raw)) + '\0').encode() + raw).hexdigest()
                return (altered.get('mode', '100644') + ' blob ' + blob + '\t' + altered.get('path', path)).encode()
            return altered.get('raw', objects[args[-1]])
        actual, index = graph.git_source('1' * 40, git)
        self.assertEqual(actual, RAW_TOOLING)
        self.assertEqual({name: row['sha256'] for name, row in index['files'].items()}, self.files)
        for key, value in [('mode', '120000'), ('path', '../foreign'), ('raw', b'changed')]:
            altered[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): graph.git_source('1' * 40, git)
            altered.clear()
