import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013';sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
first=json.loads((k/'local-tests-general-sorter491-first/verification.json').read_bytes())
assert first['exitCode']==0 and first['sourceBefore']==first['sourceAfter']
assert all(sha((k/name).read_bytes())==digest for name,digest in first['sourceBefore'].items())
p=k/'kit_general_sorter.py';s=p.read_text(encoding='utf8');needle="    return {'version':1,'scope':'CONDITIONAL_NORMAL_SORTER_FULL_RECORD_REQUEST_BOUND','pageSize':size,"
assert s.count(needle)==1
s=s.replace(needle,"    layout=copy_layout(sizes,0)\n    require(layout['roundedContentBytes']<=MAX_CONTENT_BYTES,'Complete rounded sorter content exceeds32GiB; never clip')\n"+needle)
s=s.replace("'declaredLayout':copy_layout(sizes,0)","'declaredLayout':layout");ast.parse(s);p.write_text(s,encoding='utf8',newline='')
p=k/'verify_kit_general_sorter.py';s=p.read_text(encoding='utf8');needle="        for value in (-1,0,general.MAX_KEY_BYTES+1,2147483647):"
assert s.count(needle)==1
extra="""        # Source review: raw aggregate plus4095 slack fits by40 bytes,
        # but WHOLE per-file rounded content exceeds32GiB by4096 bytes.
        witness=general.declared_sorter(499,8068667,'c'*64)
        with self.assertRaisesRegex(RuntimeError,'Complete rounded'):general.sorter_bound(512,witness)
        general.sorter_bound(512,general.declared_sorter(498,8068667,'c'*64))
"""
s=s.replace(needle,extra+needle);ast.parse(s);p.write_text(s,encoding='utf8',newline='')
p=k/'general-sorter-source.json';v=json.loads(p.read_bytes());v['files']={n:{'bytes':len((w/n).read_bytes()),'sha256':sha((w/n).read_bytes())} for n in v['files']}
v['derivation'].append('Final source review separately checks COMPLETE roundedContentBytes<=32GiB, not only sum(unrounded aggregate+per-file4095 allowances). Exact witness N499/B8068667/P512 had native extent34359480343/raw layout34359738328 below32GiB, but complete rounded content34359742464 exceeds34359738368 by4096; now REFUSES. Metadata allowances remain separate. First fullPASS is preserved honestly; no source changed during that run. Final full successor covers exact witness and adjacent fitting declaration.')
p.write_bytes(canonical(v)+b'\n')
for name in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={n:{'bytes':len((k/n).read_bytes()),'sha256':sha((k/n).read_bytes())} for n in v['files']};p.write_bytes(canonical(v)+b'\n')
out={'scope':'SOURCE_REVIEW_CORRECTION_AFTER_FIRST_CLOSED_FULL_PASS','firstRunUnchanged':True,'completeRoundedContentGuardAdded':True,'exactWitnessRefusesRatherThanClips':True,'sourceProofSha256':sha((k/'general-sorter-source.json').read_bytes()),'hooksExecuted':False,'operatorsExecuted':0}
(h/'general-sorter484-entry-0930-once/rounded-envelope-correction-record.json').write_bytes(canonical(out)+b'\n');print(json.dumps(out))
