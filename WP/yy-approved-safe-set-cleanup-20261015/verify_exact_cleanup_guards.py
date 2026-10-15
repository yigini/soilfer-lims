"""Guard-only tests; never connect to Docker, SSH, or production."""
import copy,importlib.util,json,pathlib,unittest
from unittest.mock import patch
D=pathlib.Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('cleanup_guarded',D/'cleanup_exact_safe_set.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
PLAN=json.loads((D/'approved-plan.json').read_bytes())
class Guards(unittest.TestCase):
 def test_exact_plan(self):m.validate_plan(PLAN)
 def test_unapproved_proof_refused(self):
  p=copy.deepcopy(PLAN);p['proofs'][0]['root']='/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T050000Z'
  with self.assertRaises(m.Changed):m.validate_plan(p)
 def test_escape_refused(self):
  p=copy.deepcopy(PLAN);p['proofs'][0]['verifiedCopies'][0]['rootRelativePath']='../private'
  with self.assertRaises(m.Changed):m.validate_plan(p)
 def test_distinct_backup_refused(self):
  p=copy.deepcopy(PLAN);p['backup']['path']=p['heldBackupPaths'][0]
  with self.assertRaises(m.Changed):m.validate_plan(p)
 def test_other_image_refused(self):
  p=copy.deepcopy(PLAN);p['image']['id']='sha256:'+'a'*64
  with self.assertRaises(m.Changed):m.validate_plan(p)
 def test_regex_injection_refused(self):
  p=copy.deepcopy(PLAN);p['cache'][0]['id']='.*'
  with self.assertRaises(m.Changed):m.validate_plan(p)
 def test_cache_state_and_graph(self):
  wanted={'bytes':100,'parents':['parent'],'lastUsedAt':'old'};row={'ID':'selected','Size':100,' Parents':['parent'],'InUse':False,'Shared':False,'LastUsedAt':'old'}
  self.assertIsNone(m.cache_problem(row,wanted,[row],{'selected'}))
  for key,value in [('InUse',True),('Shared',True),('Size',101),('LastUsedAt','new')]:
   self.assertIsNotNone(m.cache_problem({**row,key:value},wanted,[row],{'selected'}))
  self.assertIsNotNone(m.cache_problem(row,wanted,[row,{'ID':'outside',' Parents':['selected']}],{'selected'}))
  self.assertIsNone(m.cache_problem(row,wanted,[row,{'ID':'child',' Parents':['selected']}],{'selected','child'}))
 def test_path_not_prefix(self):
  self.assertFalse(m.below('/opt/lims/releases/023000-extra','/opt/lims/releases/023000'))
  self.assertTrue(m.below('/opt/lims/releases/023000/file','/opt/lims/releases/023000'))
 def test_writes_not_during_import(self):self.assertFalse(hasattr(m,'PLAN'))
 def test_hash_and_symlink_guards_on_owned_files(self):
  root=D/'guard-fixture-retained-platform-successor';root.mkdir();p=root/'owned.txt';p.write_bytes(b'evidence');h=m.digest(b'evidence')
  # Linux exercises the real flag; Windows exercises hashes/identity only on an owned regular fixture.
  with patch.object(m.os,'O_NOFOLLOW',getattr(m.os,'O_NOFOLLOW',0),create=True):
   self.assertEqual(m.hash_file(p,h,8)['sha256'],h)
   with self.assertRaises(m.Changed):m.hash_file(p,h,9)
   p.write_bytes(b'tampered')
   with self.assertRaises(m.Changed):m.hash_file(p,h,8)
  with self.assertRaises(m.Changed):m.checked_path(str(p),'/opt/lims/other')
if __name__=='__main__':unittest.main(verbosity=2)
