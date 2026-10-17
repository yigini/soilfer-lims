import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 raw=p.read_bytes();return {'bytes':len(raw),'sha256':sha(raw)}
v=json.loads((k/'local-tests-sorter-scratch463-first/verification.json').read_bytes());log=(k/'local-tests-sorter-scratch463-first/stderr-original.txt').read_text(encoding='utf8')
assert v['exitCode']==1 and len(v['sourceBefore'])==201 and v['sourceBefore']==v['sourceAfter'] and log.rstrip().endswith('FAILED (errors=1)')
assert all(sha((k/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
p=k/'verify_kit_sorter_scratch.py';s=p.read_text(encoding='utf8');assert s.count('[1024]')==1;s=s.replace('[1024]','[512]')
s=s.replace('at=0;keys=[];runs=0','at=0;keys=[];runs=0;trailing_zero_bytes=0')
s=s.replace('while at<len(raw):\n        size,at=varint(raw,at);end=at+size','while at<len(raw):\n        if raw[at]==0:\n            if any(raw[at:]):raise AssertionError(\'Nonzero bytes after zero PMA header\')\n            trailing_zero_bytes=len(raw)-at;break\n        size,at=varint(raw,at);end=at+size')
s=s.replace('return runs,keys\n','return runs,keys,trailing_zero_bytes\n')
needle="self.assertGreaterEqual(row['maximumTemporaryFileCreations'],2*len(distribution)+2*min(16,len(distribution)+1))"
assert s.count(needle)==1
s=s.replace(needle,needle+"\n        with self.assertRaisesRegex(RuntimeError,'never clip'):sorter.sorter_scratch_bound(512,sorter.declared_sorter(1024*(250*512//48),'b'*64))\n        self.assertEqual(complete_pma_payloads(b'\\x04\\x03abc'+b'\\0'*4091),(1,[3],4091))\n        with self.assertRaises(AssertionError):complete_pma_payloads(b'\\x04\\x03abc\\x01')")
s=s.replace("('continuedWritingAfterSqlError',True),","('continuedWritingAfterSqlError',True),('ordinaryUnmodifiedSorterFiles',False),")
s=s.replace('runs,keys=complete_pma_payloads','runs,keys,trailing_zero_bytes=complete_pma_payloads')
s=s.replace("'maximumSerializedKeyBytes':max(keys),'fullLifetimeOriginalsRetained'","'maximumSerializedKeyBytes':max(keys),'trailingZeroBytesObserved':trailing_zero_bytes,'fullLifetimeOriginalsRetained'")
needle="self.assertTrue(any(x['opcode']=='SorterOpen' for x in row['program']));self.assertFalse(row['directoryAbsenceProvesNoSpill'])"
assert s.count(needle)==1;s=s.replace(needle,needle+"\n            self.assertEqual(row['threads'],workers);self.assertEqual(pathlib.Path(row['nodeTmpdir']),temp)")
p.write_text(s,encoding='utf8',newline='')
p=k/'kit_sorter_scratch.py';s=p.read_text(encoding='utf8')
s=s.replace("'customSorterOrGlobalPmaOverride':False}","'customSorterOrGlobalPmaOverride':False,'ordinaryUnmodifiedSorterFiles':True}")
s=s.replace("inventory['maximumSorterRecordHeaderBytes']==16 and inventory['customSorterOrGlobalPmaOverride'] is False,","inventory['maximumSorterRecordHeaderBytes']==16 and inventory['customSorterOrGlobalPmaOverride'] is False and\n        inventory['ordinaryUnmodifiedSorterFiles'] is True,")
s=s.replace("'maximumTemporaryFileCreations':files,'declaredLayout':copy_layout(sizes,0),","'maximumTemporaryFileCreations':files,'declaredLayout':copy_layout(sizes,0),\n        'nativeRequestScope':'XWRITE_ENDS_AND_SIZE_HINT_BYTE_ARGUMENTS_ONLY',\n        'mmapSizeControlIsMappingLimitNotFileExtent':True,")
p.write_text(s,encoding='utf8',newline='')
p=k/'sorter-scratch-source.json';proof=json.loads(p.read_bytes());proof['files']={name:pin(w/name) for name in proof['files']}
raw=(w/proof['nativeSource']['path']).read_bytes();lines=raw.splitlines(keepends=True);offsets=[0]
for line in lines:offsets.append(offsets[-1]+len(line))
for label,first,last in [('maximum_pma_threshold',105302,105307),('sorter_zeroed_tasks_and_page_size',106128,106159)]:
 part=raw[offsets[first-1]:offsets[last]];proof['nativeExcerpts'].append({'label':label,'firstLine':first,'lastLine':last,'startByte':offsets[first-1],'endByte':offsets[last],'bytes':len(part),'sha256':sha(part),'text':part.decode()})
proof['derivation'].append('Native request scope is EXACTLY xWrite END OFFSETS and SIZE_HINT byte arguments plus reserved logical gaps. MMAP_SIZE control passes a mapping LIMIT, not a file-end request; this model does not bound that limit or any VFS response. Ordinary unmodified private sorter files are a mandatory declaration, not observed routing/locks. Copied LOCAL PMA snapshot zero tails are reported separately and never counted as empty PMAs.')
p.write_bytes(canonical(proof)+b'\n')
for name in ['build_stop_post.py','build_capture_stop_post.py']:
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={n:pin(k/n) for n in v['files']};p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
p=h/'sorter-scratch463-publisher-body-once.txt';s=p.read_text(encoding='utf8');s=s.replace("'sorterNativeExcerpts':26","'sorterNativeExcerpts':28");p.write_text(s,encoding='utf8',newline='')
print(json.dumps({'fullSourcePins':len(proof['files']),'nativeExcerpts':len(proof['nativeExcerpts']),'proofSha256':sha((k/'sorter-scratch-source.json').read_bytes()),'firstFrozenRunSourcesUnchanged':True,'hooksExecuted':False,'operatorsExecuted':0}))
