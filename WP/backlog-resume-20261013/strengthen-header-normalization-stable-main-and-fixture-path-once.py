from pathlib import Path
import ast,hashlib,json,subprocess,sys
w=Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013';entry=h/'header-normalization-tail-entry-1317-once'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='42c1fc422fc1ee28e725b5b9780fee6ccc60ab24'
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=w).strip()
folder=k/'local-tests-header-normalization556-first';v=json.loads((folder/'verification.json').read_bytes());log=(folder/'stderr-original.txt').read_text(encoding='utf8')
assert v['exitCode']==1 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==240
assert log.rstrip().endswith('FAILED (errors=1)') and 'Ran 556 tests in 353.080s' in log and 'FileNotFoundError' in log and 'journal-mode-metadata-source-addendum.json' in log
assert all(sha((k/n).read_bytes())==d for n,d in v['sourceBefore'].items())
record_path=entry/'stable-main-and-fixture-path-correction-record.json';assert not record_path.exists()
proof_path=k/'header-normalization-source.json';prior=proof_path.read_bytes();proof=json.loads(prior)
p=k/'kit_header_normalization.py';s=p.read_text(encoding='utf8');a="CONDITIONS=('positiveIntactFixedPageGeometryAndHeader',";assert s.count(a)==1
s=s.replace(a,a+"\n    'stableNAndFullMainBytesNoOtherHandlesWritersSharedCacheOrExternalChanges',")
p.write_text(s,encoding='utf8',newline='')
p=k/'verify_kit_header_normalization.py';s=p.read_text(encoding='utf8');a='proof,_=header.source_proof();root=directory();tool=root/HERE.relative_to(ROOT)';assert s.count(a)==1
s=s.replace(a,"proof,_=header.source_proof();root=directory()\n        # Preserve the same retained fixture while allowing its complete pinned paths.\n        if sys.platform=='win32':root=pathlib.Path('\\\\\\\\?\\\\'+str(root))\n        tool=root/HERE.relative_to(ROOT)")
s=s.replace('import copy,json,pathlib,shutil,sqlite3,tempfile,unittest','import copy,json,pathlib,shutil,sqlite3,sys,tempfile,unittest')
p.write_text(s,encoding='utf8',newline='')
name=(k/'kit_header_normalization.py').relative_to(w).as_posix();raw=(w/name).read_bytes();proof['files'][name]={'bytes':len(raw),'sha256':sha(raw)}
proof['derivation'][0]+=' Strengthened before successor: stable N/full original MAIN bytes, no other handles/writers/shared cache/external changes throughout this whole subphase is explicitly mandatory; source declaration is not observed caller exclusion.'
proof_path.write_bytes(canonical(proof)+b'\n')
for name in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr
p=k/'capture-statement-journal-source.json';value=json.loads(p.read_bytes())
for n in value['files']:
 raw=(k/n).read_bytes();value['files'][n]={'bytes':len(raw),'sha256':sha(raw)}
p.write_bytes(canonical(value)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
record={'firstRunExitCode':v['exitCode'],'firstRunSourceFiles':240,'firstRunSourcesUnchanged':True,'firstRunDurationSeconds':353.080,'failure':'NEW full-source mutation fixture destination path exceeded ordinary Windows path handling; complete native/module/prior-review copy did not complete. No source or production guard failure inferred.','pathCorrection':'Use extended Windows path spelling of SAME retained source-copy fixture, no move/delete/runtime setting change.','duringFreezeStableMainReview':True,'testedSourcesChangedOnlyAfterActualClosure':True,'newStableMainCondition':'stableNAndFullMainBytesNoOtherHandlesWritersSharedCacheOrExternalChanges','priorSourceProofSha256':sha(prior),'sourceProofSha256':sha(proof_path.read_bytes()),'sourceFiles':100,'nativeExcerpts':22,'expectedUniqueTests':556,'hooksRebuiltSourceOnly':True,'hooksExecuted':False,'operators':0}
record_path.open('xb').write(canonical(record)+b'\n');print(json.dumps(record))
