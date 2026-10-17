"""ONCE honest native-observation scope plus compile-option representation fix."""
from pathlib import Path
import json,hashlib,ast
W=Path(__file__).resolve().parents[2];K=W/'WP/batch-release-kit-be837974-20261016';sha=lambda b:hashlib.sha256(b).hexdigest()
p=K/'verify_kit_statement_journal.py';text=p.read_text(encoding='utf8');start=text.index('    def test_actual_pinned_native_forward_update_spills_statement_journal_and_restores_rollback(self):');end=text.index("\n\nif __name__=='__main__'",start)
new=r'''    def test_actual_pinned_native_statement_abort_preserves_prior_statement_and_full_rollback(self):
        setup=r"""const Database=require('better-sqlite3'),db=new Database(process.argv[1]);db.pragma('page_size='+process.argv[2]);
        db.exec('CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB NOT NULL CHECK(length(value)>0))');const put=db.prepare('INSERT INTO payload VALUES(?,?)');
        db.transaction(()=>{for(let i=1;i<=96;i++)put.run(i,Buffer.alloc(8192,i));})();db.close();process.stdout.write('{}');"""
        program=r"""const fs=require('node:fs'),Database=require('better-sqlite3');
        const db=new Database(process.argv[1],{fileMustExist:true}),mode=process.argv[2],temp=process.argv[3],samples=[];
        // TEST-ONLY CHECK constraint, sampling UDF and small cache; no scientific owner.
        db.pragma('cache_size=4');db.function('sample',{deterministic:true},(value,id)=>{
          for(const name of fs.readdirSync(temp)){const p=temp+'/'+name;try{const s=fs.statSync(p);if(s.isFile())samples.push({name,bytes:s.size});}catch(e){if(e.code!=='ENOENT')throw e;}}
          if(mode==='statement-abort'&&id===96)return Buffer.alloc(0);
          const next=Buffer.from(value);next[0]^=1;return next;
        });
        const priorSql='UPDATE payload SET value=?',priorValue=Buffer.alloc(8192,10);
        const priorProgram=db.prepare('EXPLAIN '+priorSql).all(priorValue);
        const sql='UPDATE payload SET value=sample(value,id)',program=db.prepare('EXPLAIN '+sql).all();
        let rolled=false,statementAborted=false,priorStatementPreserved=null,abortCode=null;
        try{db.transaction(()=>{
          db.prepare(priorSql).run(priorValue);
          try{db.prepare(sql).run();}
          catch(e){
            if(mode!=='statement-abort'||e.code!=='SQLITE_CONSTRAINT_CHECK')throw e;
            statementAborted=true;abortCode=e.code;
            // Read-only verification after the SQL error, then leave the owner.
            priorStatementPreserved=db.inTransaction&&db.prepare('SELECT count(*) n FROM payload WHERE value<>?').get(priorValue).n===0;
            if(!priorStatementPreserved)throw Error('PRIOR_STATEMENT_NOT_PRESERVED');
            throw Error('LOCAL_STATEMENT_ABORT_EXIT');
          }
          if(mode==='statement-abort')throw Error('EXPECTED_NATIVE_CHECK_REFUSAL');
          if(mode==='rollback')throw Error('LOCAL_ROLLBACK');
        }).immediate();}
        catch(e){if(e.message!=='LOCAL_ROLLBACK'&&e.message!=='LOCAL_STATEMENT_ABORT_EXIT')throw e;rolled=true;}
        const result={program,priorProgram,samples,rolled,statementAborted,abortCode,priorStatementPreserved,
          priorWriteStatementExecuted:true,diskTemporaryFileObserved:samples.length>0,
          directoryAbsenceProvesNoSpill:false,statementJournalDiskPeakMeasured:false,
          rows:db.prepare('SELECT count(*) n FROM payload').get().n,integrity:db.pragma('integrity_check',{simple:true}),
          tempStore:db.pragma('temp_store',{simple:true}),journalMode:db.pragma('journal_mode',{simple:true}),
          version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,
          platform:process.platform,linuxVfsTested:false,applicationInstallersExecuted:false,
          continuousPeakMeasured:false,fullLifetimeOriginalsRetained:false};
        db.close();process.stdout.write(JSON.stringify(result));"""
        for size in (512,4096,65536):
            for mode in ('rollback','commit','statement-abort'):
                root=directory();target=root/'dev.db';temp=root/'tmp';temp.mkdir()
                native(setup,[target,size],root,'setup');raw=target.read_bytes();before=sha(raw)
                plan=statement.statement_journal_bound(raw[:100],len(raw),operations(),statement.declared_statements(2))
                (root/'conditional-plan.json').write_bytes(canonical(plan));(root/'program.cjs.txt').write_text(program,encoding='utf8')
                env=dict(os.environ,TMP=str(temp),TEMP=str(temp),SQLITE_TMPDIR=str(temp));row=native(program,[target,mode,temp],root,'update',env)
                self.assertEqual(row['version'],'3.51.2');self.assertEqual(row['sourceId'],SOURCE_ID);self.assertEqual(row['integrity'],'ok')
                self.assertEqual(row['rows'],96);self.assertFalse(any(op['opcode'] in ('SorterOpen','OpenEphemeral') for op in row['program']+row['priorProgram']))
                self.assertEqual(row['rolled'],mode!='commit');self.assertEqual(row['statementAborted'],mode=='statement-abort')
                if mode=='statement-abort':
                    self.assertEqual(row['abortCode'],'SQLITE_CONSTRAINT_CHECK');self.assertIs(row['priorStatementPreserved'],True)
                self.assertEqual(row['diskTemporaryFileObserved'],bool(row['samples']))
                self.assertIs(row['directoryAbsenceProvesNoSpill'],False);self.assertIs(row['statementJournalDiskPeakMeasured'],False)
                if row['samples']:
                    self.assertTrue(all(x['bytes']%(size+4)==0 for x in row['samples']))
                    self.assertLessEqual(sum(max(x['bytes'] for x in row['samples'] if x['name']==name) for name in {x['name'] for x in row['samples']}),plan['maximumCumulativeLogicalContentBytes'])
                if mode!='commit':self.assertEqual(sha(target.read_bytes()),before)
                else:self.assertNotEqual(sha(target.read_bytes()),before)
'''
p.write_text(text[:start]+new+text[end:],encoding='utf8',newline='\n');ast.parse(p.read_bytes())
p=K/'kit_linux_main_vfs.py';text=p.read_text(encoding='utf8');old="required={'DEFAULT_MMAP_SIZE=0','ENABLE_LOCKING_STYLE=0','MUTEX_PTHREADS',\n        'THREADSAFE=2','USE_URI=0','OMIT_SHARED_CACHE','TEMP_STORE=1'}";assert text.count(old)==1
text=text.replace(old,"required={'DEFAULT_MMAP_SIZE=0','MUTEX_PTHREADS','THREADSAFE=2','OMIT_SHARED_CACHE','TEMP_STORE=1'}")
needle="    forbidden=('OS_OTHER'";assert text.count(needle)==1
text=text.replace(needle,"    require(all(not row.startswith('ENABLE_LOCKING_STYLE') or row=='ENABLE_LOCKING_STYLE=0' for row in options),\n        'Explicit nondefault or ambiguous locking-style option refused')\n    require(not any(row.startswith('USE_URI=') for row in options),\n        'Pinned compile_options reports only the unvalued USE_URI marker')\n    forbidden=('OS_OTHER'")
needle="    return {'necessaryCompileOptionPreconditionsMet':True,";assert text.count(needle)==1
text=text.replace(needle,"    return {'necessaryCompileOptionPreconditionsMet':True,'compileOptionsDetermineUriValue':False,\n        'compileOptionsDetermineDefaultLockingStyle':False,")
p.write_text(text,encoding='utf8',newline='\n');ast.parse(p.read_bytes())
p=K/'verify_kit_linux_main_vfs.py';text=p.read_text(encoding='utf8');old="required=['DEFAULT_MMAP_SIZE=0','ENABLE_LOCKING_STYLE=0','MUTEX_PTHREADS','THREADSAFE=2','USE_URI=0','OMIT_SHARED_CACHE','TEMP_STORE=1']";assert text.count(old)==1
text=text.replace(old,"required=['DEFAULT_MMAP_SIZE=0','MUTEX_PTHREADS','THREADSAFE=2','USE_URI','OMIT_SHARED_CACHE','TEMP_STORE=1']")
needle="required+['DEFAULT_UNIX_VFS=custom'],required+[True]";assert text.count(needle)==1;text=text.replace(needle,"required+['DEFAULT_UNIX_VFS=custom'],required+['ENABLE_LOCKING_STYLE=1'],required+['USE_URI=0'],required+[True]")
needle="self.assertFalse(observed['runtimeDefaultVfsVerified'])";assert text.count(needle)==1;text=text.replace(needle,needle+"\n        self.assertFalse(observed['compileOptionsDetermineUriValue'])\n        self.assertFalse(vfs.runtime_option_preconditions('linux','3.51.2',vfs.SOURCE_ID,[x for x in required if x!='USE_URI'])['runtimeDefaultVfsVerified'])")
p.write_text(text,encoding='utf8',newline='\n');ast.parse(p.read_bytes())
p=K/'linux-main-vfs-source.json';value=json.loads(p.read_bytes());name=(K/'kit_linux_main_vfs.py').relative_to(W).as_posix();raw=(W/name).read_bytes();value['files'][name]={'bytes':len(raw),'sha256':sha(raw)}
native=(W/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c').read_bytes();lines=native.splitlines(keepends=True)
for label,a,b in [('compile_option_uri_unvalued',23374,23376),('compile_option_locking_conditional',22860,22862)]:
 start=sum(map(len,lines[:a-1]));end=start+sum(map(len,lines[a-1:b]));value['nativeExcerpts'].append({'label':label,'startLine':a,'endLine':b,'startByte':start,'endByte':end,'text':native[start:end].decode()})
value['conditionalDerivation'].append('Pinned compile_options emits USE_URI without its macro value and may omit a default locking-style definition established later in preprocessing. Necessary option checks cannot demand invented USE_URI=0 or infer URI/default locking values from marker presence/absence. These values and compiled/VFS identity remain independently unproved; all runtime/authority flags stay false.')
p.write_text(json.dumps(value,sort_keys=True,indent=2)+'\n',encoding='utf8',newline='\n')
p=K/'statement-journal-source.json';value=json.loads(p.read_bytes());value['derivation'][-1]='A first main-journal write can satisfy a savepoint without a subjournal. Native fixtures use two forward writes and a deliberate later CHECK abort; read-only verification proves prior-statement data survives the statement abort before the owner exits and fully rolls back. Windows directory sampling may remain empty: no positive disk-spill/size/peak or zero-spill inference is made. This validates logical statement rollback semantics only; VFS/physical/full-lifetime obligations remain unclosed.'
p.write_text(json.dumps(value,sort_keys=True,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps({'nativeTestClaimsPhysicalSpill':False,'nativeStatementAbortPreservationRequired':True,'necessaryOptionsValueAssumptionRemoved':True,'linuxSourceExcerpts':34,'statementProofSha256':sha(p.read_bytes()),'linuxProofSha256':sha((K/'linux-main-vfs-source.json').read_bytes()),'operatorsExecuted':0}))