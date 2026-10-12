"""Local-only source preparation. Never run a build, proof, installer or host action."""
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'pr284-release'

def edit(name, changes):
    path = root / name
    source = path.read_text(encoding='utf-8')
    for old, new in changes:
        assert old in source, (name, old)
        source = source.replace(old, new)
    path.write_text(source, encoding='utf-8', newline='\n')

for name in ['prepare_import_build.py', 'export_launch_import_proof.py', 'collect_import_gate.py']:
    edit(name, [
        ("'repos/yigini/soilfer-lims/pulls/284'", "'repos/yigini/soilfer-lims/pulls/' + str(PR_NUMBER)"),
        ("'repos/yigini/soilfer-lims/issues/284/comments?per_page=100'", "'repos/yigini/soilfer-lims/issues/' + str(PR_NUMBER) + '/comments?per_page=100'")
    ] if name != 'collect_import_gate.py' else [
        ("'pulls/284'", "'pulls/' + str(PR_NUMBER)"),
        ("'issues/284/comments?per_page=100'", "'issues/' + str(PR_NUMBER) + '/comments?per_page=100'")
    ])

edit('prepare_import_build.py', [
    ("'merge-tree', '--write-tree', BASE_HEAD, AUDITED_PR_HEAD", "'merge-tree', '--write-tree', MERGE_BASE_HEAD, AUDITED_PR_HEAD"),
    ("'baseHead': BASE_HEAD, 'pr': PR_NUMBER", "'baseHead': BASE_HEAD, 'mergeBaseHead': MERGE_BASE_HEAD, 'pr': PR_NUMBER"),
    ("'auditedPrHead': AUDITED_PR_HEAD, 'auditReviewId': int(review_id)", "'auditedPrHead': AUDITED_PR_HEAD, 'originalProofRoot': EXPECTED_PROOF_ROOT,\n        'firstProofPolicy': FIRST_PROOF_POLICY, 'auditReviewId': int(review_id)")
])
edit('build_import.py', [
    ("spec['mergeParents'] == [spec['baseHead'], spec['auditedPrHead']]", "spec['mergeBaseHead'] == MERGE_BASE_HEAD and\n        spec['mergeParents'] == [MERGE_BASE_HEAD, spec['auditedPrHead']] and\n        type(spec['auditReviewId']) is int and spec['auditReviewId'] == AUDIT_REVIEW_ID and\n        spec['originalProofRoot'] == EXPECTED_PROOF_ROOT and spec['firstProofPolicy'] == FIRST_PROOF_POLICY")
])
edit('export_launch_import_proof.py', [
    ("remote = pathlib.PurePosixPath(root)", "require_first_proof_root(root)\n    remote = pathlib.PurePosixPath(root)"),
    ("'head': pin['head'], 'baseHead': BASE_HEAD, 'auditedPrHead': AUDITED_PR_HEAD", "'head': pin['head'], 'baseHead': BASE_HEAD, 'mergeBaseHead': MERGE_BASE_HEAD,\n        'originalProofRoot': EXPECTED_PROOF_ROOT, 'firstProofPolicy': FIRST_PROOF_POLICY,\n        'auditedPrHead': AUDITED_PR_HEAD")
])
edit('rehearse_import.py', [
    ("    bound_candidate()\n", "    bound_candidate()\n    require_first_proof_root(str(ROOT))\n"),
    ("'proofSourceReviewId': source_review['id'], 'baseHead': BASE_HEAD, 'pr': PR_NUMBER", "'proofSourceReviewId': source_review['id'], 'baseHead': BASE_HEAD,\n        'mergeBaseHead': MERGE_BASE_HEAD, 'auditReviewId': AUDIT_REVIEW_ID,\n        'originalProofRoot': EXPECTED_PROOF_ROOT, 'firstProofPolicy': FIRST_PROOF_POLICY, 'pr': PR_NUMBER")
])
edit('freeze_import.py', [
    ("    proof, target = map(pathlib.Path, sys.argv[1:])", "    proof, target = map(pathlib.Path, sys.argv[1:])\n    require_first_proof_root(str(proof))"),
    ("'baseHead': BASE_HEAD, 'auditedPrTree': AUDITED_PR_TREE", "'baseHead': BASE_HEAD, 'mergeBaseHead': MERGE_BASE_HEAD,\n        'auditReviewId': AUDIT_REVIEW_ID, 'firstProofPolicy': FIRST_PROOF_POLICY,\n        'auditedPrTree': AUDITED_PR_TREE")
])
edit('deploy_import.py', [
    ("'proofSourceReviewId': PROOF_SOURCE_REVIEW_ID, 'baseHead': BASE_HEAD, 'pr': PR_NUMBER", "'proofSourceReviewId': PROOF_SOURCE_REVIEW_ID, 'baseHead': BASE_HEAD,\n        'mergeBaseHead': MERGE_BASE_HEAD, 'auditReviewId': AUDIT_REVIEW_ID,\n        'originalProofRoot': EXPECTED_PROOF_ROOT, 'firstProofPolicy': FIRST_PROOF_POLICY, 'pr': PR_NUMBER")
])
edit('import_release_contract.py', [
    ("REVIEWED_PROOF_SOURCE = 'f5e59428c1bbf19247db2555f5158bc3a2ac5fad'", "REVIEWED_PROOF_SOURCE = 'UNREVIEWED_NATIVE_FORWARD_REFUSE'"),
    ("PROOF_SOURCE_REVIEW_ID = 6122670828", "PROOF_SOURCE_REVIEW_ID = 0"),
    ("    require_bound_proof_source()\n    candidate_identity(pin)", "    require_bound_proof_source()\n    candidate_identity(pin)\n    require_first_proof_root(proof.get('root'))\n    require(proof.get('originalProofRoot') == EXPECTED_PROOF_ROOT and\n        proof.get('firstProofPolicy') == FIRST_PROOF_POLICY and\n        proof.get('mergeBaseHead') == MERGE_BASE_HEAD and\n        type(proof.get('auditReviewId')) is int and proof['auditReviewId'] == AUDIT_REVIEW_ID,\n        'Original first proof/application review binding differs')"),
    ("manifest['baseHead'] == BASE_HEAD and manifest['tree'] == MERGED_TREE", "manifest['baseHead'] == BASE_HEAD and manifest.get('mergeBaseHead') == MERGE_BASE_HEAD and\n        type(manifest.get('auditReviewId')) is int and manifest['auditReviewId'] == AUDIT_REVIEW_ID and\n        manifest.get('firstProofPolicy') == FIRST_PROOF_POLICY and manifest['tree'] == MERGED_TREE"),
    ("    safe_root(manifest['originalProofRoot'], 'instrument-import-proof-')", "    require_first_proof_root(manifest['originalProofRoot'])"),
    ("pr['number'] == 284", "type(pr['number']) is int and pr['number'] == PR_NUMBER")
])

edit('test_import_authority.py', [
    ("('MERGE_PARENTS', [contract.BASE_HEAD, 'a' * 40])", "('MERGE_PARENTS', [contract.MERGE_BASE_HEAD, 'a' * 40]),\n                ('PR_NUMBER', 999), ('AUDIT_REVIEW_ID', 123),\n                ('EXPECTED_PROOF_ROOT', '/opt/lims/releases/instrument-import-proof-owned')"),
    ("'auditedPrHead': contract.AUDITED_PR_HEAD, 'pr': 284", "'mergeBaseHead': contract.MERGE_BASE_HEAD,\n            'originalProofRoot': contract.EXPECTED_PROOF_ROOT, 'firstProofPolicy': contract.FIRST_PROOF_POLICY,\n            'auditedPrHead': contract.AUDITED_PR_HEAD, 'pr': contract.PR_NUMBER"),
    ("/pull/284#issuecomment-123", "/pull/999#issuecomment-123"),
    ("replace('/284#', '/293#')", "replace('/999#', '/284#')")
])
edit('test_import_release.py', [
    ("('MERGE_PARENTS', [release.BASE_HEAD, 'a' * 40])", "('MERGE_PARENTS', [release.MERGE_BASE_HEAD, 'a' * 40]),\n                ('PR_NUMBER', 999), ('AUDIT_REVIEW_ID', 999900004),\n                ('EXPECTED_PROOF_ROOT', '/opt/lims/releases/instrument-import-proof-owned')"),
    ("'head': release.CANDIDATE_HEAD, 'baseHead': release.BASE_HEAD,", "'head': release.CANDIDATE_HEAD, 'baseHead': release.BASE_HEAD,\n            'mergeBaseHead': release.MERGE_BASE_HEAD, 'auditReviewId': release.AUDIT_REVIEW_ID,\n            'firstProofPolicy': release.FIRST_PROOF_POLICY,"),
    ("'baseHead': release.BASE_HEAD, 'pr': 284", "'baseHead': release.BASE_HEAD, 'mergeBaseHead': release.MERGE_BASE_HEAD,\n            'auditReviewId': release.AUDIT_REVIEW_ID, 'root': release.EXPECTED_PROOF_ROOT,\n            'originalProofRoot': release.EXPECTED_PROOF_ROOT, 'firstProofPolicy': release.FIRST_PROOF_POLICY,\n            'pr': release.PR_NUMBER"),
    ("'pr': 284, 'tree': release.MERGED_TREE", "'pr': release.PR_NUMBER, 'originalProofRoot': release.EXPECTED_PROOF_ROOT,\n            'tree': release.MERGED_TREE"),
    ("/pull/284#issuecomment-999900004", "/pull/999#issuecomment-999900004"),
    ("'pr': {'number': 284", "'pr': {'number': release.PR_NUMBER")
])
print('Prepared forward authority source only; all new execution approvals remain unbound.')
