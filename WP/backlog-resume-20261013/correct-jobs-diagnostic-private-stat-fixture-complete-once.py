"""Correct mock accounting, preserve first failure; add alias and approval negatives."""
import pathlib,json
S=pathlib.Path(__file__).resolve().parents[2]/'WP/jobs-row-diagnostic-private-be837974-20261016'
p=S/'verify_diagnostic.py';s=p.read_text();old="with mock.patch.object(pathlib.Path,'lstat',autospec=True,side_effect=lstat),mock.patch.object(pathlib.Path,'read_bytes',side_effect=AssertionError('No hashing/content in BEFORE_ROOT'))";assert s.count(old)==1
s=s.replace(old,"with mock.patch.object(pathlib.Path,'lstat',autospec=True,side_effect=lstat),mock.patch.object(pathlib.Path,'is_symlink',return_value=False),mock.patch.object(pathlib.Path,'read_bytes',side_effect=AssertionError('No hashing/content in BEFORE_ROOT'))")
old="    def test_optional_inaccessible_paths_and_new_review_floor(self):";assert s.count(old)==1
extra=r"""    def test_before_root_duplicate_inode_refuses(self):
        with self.assertRaises(AssertionError):self.preflight('duplicate-inode',lambda v:v.update(inode=100))
    def test_before_root_nonempty_wal_refuses(self):
        # A changed six-file pin is rejected before any content reader exists.
        with self.assertRaises(AssertionError):self.preflight('nonempty',lambda v:v.update(bytes=32))
    def test_old_source_pass_cannot_approve_privacy_revision(self):
        index={'head':'a'*40,'files':{n:{'sha256':'b'*64} for n in c.FILES},'data':{n:{'sha256':'c'*64} for n in c.DATA}}
        review={'id':6206082629,'created_at':'2026-10-16T01:41:00Z','updated_at':'2026-10-16T01:41:00Z','performed_via_github_app':{'id':1236702,'slug':'claude'},'body':'Source review: PASS\n'+'\n'.join(c.tokens(index))}
        with self.assertRaises(RuntimeError):c.approval(review,index)
    def test_five_programs_bind_all_exact_input_stat_pins(self):
        programs=launch.programs({},0);tree=ast.parse(programs['beforeRoot']);assignment=next(n for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='C' for t in n.targets))
        namespace={'json':json,'base64':__import__('base64')};exec(compile(ast.Module(body=[assignment],type_ignores=[]),'closed-rendered-config','exec'),namespace)
        self.assertEqual(namespace['C']['inputPins'],json.loads(pathlib.Path(__file__).with_name('diagnostic-pins.json').read_bytes())['inputPins']);self.assertEqual(len(namespace['C']['inputPins']),6)
"""
s=s.replace(old,extra+old);compile(s,str(p),'exec');p.write_bytes(s.encode())
(S/'guards-private-first-local-host-once/failure-derived.json').write_text(json.dumps({'status':'LOCAL_100_OF_101_PASS_HOST_NOT_STARTED','cause':'Test counted Path.is_symlink internal lstat calls as explicit six-file snapshots:24 rather than12. Runtime guard passed. Fixture now isolates is_symlink; existing real alias guards remain.','sourceGuardChanged':False,'hostOperatorCalls':0}))
print('Unique fixture correction and additional negative guards prepared')
