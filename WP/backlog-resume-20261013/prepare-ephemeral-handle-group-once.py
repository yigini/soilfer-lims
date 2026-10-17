import ast,json,pathlib,hashlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013';sys.path.insert(0,str(k))
from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
p=k/'kit_ephemeral_btree.py';s=p.read_text(encoding='utf8')
needle='\ndef order_status_rhs_bound(page_size):'
addition='''
def ephemeral_btree_group_bound(inventories):
    require(type(inventories) is list and 1<=len(inventories)<=64,
        'Complete explicit bounded list of DISTINCT fresh ephemeral handles required')
    groups=[all_ephemeral_page_sizes(v) for v in inventories]
    lengths=[v['maximumLogicalEphemeralBytes'] for v in groups]
    require(sum(lengths)<=MAX_CONTENT_BYTES,'Complete ALL-handle ephemeral logical envelope exceeds32GiB; never clip')
    return {'version':1,'scope':'COMPLETE_DECLARED_FRESH_EPHEMERAL_HANDLE_GROUP',
        'handlePageSizeDeclarations':groups,'maximumTemporaryDatabaseFileCreations':len(groups),
        'maximumAggregateLogicalEphemeralBytes':sum(lengths),'layout':copy_layout(lengths,0),
        'requiresDistinctFreshHandlesWithoutAliasReuse':True,'completeCallerHandleInventoryVerified':False,
        'actualEphemeralPageSizesObserved':False,'wholeSqlStatementScratchInventoryComplete':False,
        'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
        'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}

'''
assert s.count(needle)==1;s=s.replace(needle,'\n'+addition+needle)
needle="    if record.get('scope')=='RAW_BE_ORDER_STATUS_LITERAL_RHS_ONLY':"
replacement="    if record.get('scope')=='COMPLETE_DECLARED_FRESH_EPHEMERAL_HANDLE_GROUP':\n        expected=ephemeral_btree_group_bound([v['bounds'][0]['declaredInventory'] for v in record['handlePageSizeDeclarations']])\n    elif record.get('scope')=='RAW_BE_ORDER_STATUS_LITERAL_RHS_ONLY':"
assert s.count(needle)==1;s=s.replace(needle,replacement);ast.parse(s);p.write_text(s,encoding='utf8',newline='')
p=k/'verify_kit_ephemeral_btree.py';s=p.read_text(encoding='utf8')
needle="        with self.assertRaisesRegex(RuntimeError,'never clip'):eph.all_ephemeral_page_sizes(large)"
s=s.replace(needle,needle+"\n        with self.assertRaisesRegex(RuntimeError,'never clip'):eph.ephemeral_btree_group_bound([eph.declared_ephemeral('INDEX',1024,9000,'c'*64)]*3)\n        grouped=eph.ephemeral_btree_group_bound([eph.declared_ephemeral('INDEX',4,32,'c'*64)]*2);eph.replay_ephemeral_bound(grouped)\n        bad=copy.deepcopy(grouped);bad['maximumTemporaryDatabaseFileCreations']=1\n        with self.assertRaises(RuntimeError):eph.replay_ephemeral_bound(bad)")
old="plan=eph.all_ephemeral_page_sizes(eph.declared_ephemeral(kind,1024,9000,'d'*64));(root/'conditional-ephemeral-plan.json').write_bytes(canonical(plan))"
new="inventories=([eph.declared_ephemeral('ROWID_TABLE',1024,9000,'d'*64)] if kind=='ROWID_TABLE' else [eph.declared_ephemeral('INDEX',1024,32,'d'*64),eph.declared_ephemeral('INDEX',1024,9000,'d'*64)])\n                plan=eph.ephemeral_btree_group_bound(inventories);(root/'conditional-ephemeral-plan.json').write_bytes(canonical(plan))"
assert s.count(old)==1;s=s.replace(old,new)
old="opens=[r for r in row['program'] if r['opcode']=='OpenEphemeral'];self.assertEqual(len(opens),1)"
assert s.count(old)==2
pos=s.index(old,s.index('def test_actual_pinned_readonly_main'))
s=s[:pos]+s[pos:].replace(old,"opens=[r for r in row['program'] if r['opcode']=='OpenEphemeral'];self.assertEqual(len(opens),1 if kind=='ROWID_TABLE' else 2)\n                self.assertEqual(len({r['p1'] for r in opens}),len(opens));self.assertEqual(plan['maximumTemporaryDatabaseFileCreations'],len(opens))",1)
old="insert='Insert' if kind=='ROWID_TABLE' else 'IdxInsert';self.assertEqual(sum(r['opcode']==insert and r['p1']==opens[0]['p1'] for r in row['program']),1)"
new="insert='Insert' if kind=='ROWID_TABLE' else 'IdxInsert'\n                for opened in opens:self.assertEqual(sum(r['opcode']==insert and r['p1']==opened['p1'] for r in row['program']),1)"
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace("plan['maximumLogicalEphemeralBytes']","plan['maximumAggregateLogicalEphemeralBytes']")
old="bound=next(v for v in plan['bounds'] if v['ephemeralPageSize']==snapshot['pageSize']);self.assertLessEqual(len(actual),bound['maximumLogicalEphemeralBytes'])"
new="maximum=max(next(v for v in group['bounds'] if v['ephemeralPageSize']==snapshot['pageSize'])['maximumLogicalEphemeralBytes'] for group in plan['handlePageSizeDeclarations']);self.assertLessEqual(len(actual),maximum)"
assert s.count(old)==1;s=s.replace(old,new);ast.parse(s);p.write_text(s,encoding='utf8',newline='')
p=k/'ephemeral-btree-source.json';v=json.loads(p.read_bytes());v['files']={name:{'bytes':len((w/name).read_bytes()),'sha256':sha((w/name).read_bytes())} for name in v['files']}
v['derivation'].append('GROUP wrapper requires complete explicit list of DISTINCT fresh handles; each handle independently charged across ALL8 page sizes, separate root/overflow/fullcontent/entry/inode allowances. Sum COMPLETE maxima must fit32GiB; NO sharing/alias/reuse credit. First full native vector-IN fixture proved TWO independent OpenEphemeral cursors/IdxInsert sites (scalar candidate rowid keys plus pair comparison keys); initial one-handle assertion honestlyFAILED. Final fixture declares BOTH1024-attempt handles/fullpayload32 and9000 BEFOREchild, verifies2distinct cursors/each insertion site. Counts remain DECLARATIONS, not whole scientific caller/runtime proof.')
p.write_bytes(canonical(v)+b'\n')
for name in ['build_stop_post.py','build_capture_stop_post.py']:
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={name:{'bytes':len((k/name).read_bytes()),'sha256':sha((k/name).read_bytes())} for name in v['files']};p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
(h/'temp-btree470-entry-0845-once/group-review-after-first-run.json').write_bytes(canonical({'firstFrozenRun':'ephemeral-btree477-first','actualResult':'477 tests/1failure/240.374s','sourceFiles':207,'sourcesUnchanged':True,'failure':'Actual vector IN query opens TWO distinct ephemeral index handles; original expectation1 refused','correction':'Complete explicit group count2/fullpayloads32+9000 per1024 attempts; all8P perhandle/fullsum32GiB refusal','sourceProofSha256':sha((k/'ephemeral-btree-source.json').read_bytes()),'predicateRelaxed':False,'operators':0})+b'\n')
print('Source group bound added for BOTH native handles; strict complete envelope retained; source hooks rebuilt only.')