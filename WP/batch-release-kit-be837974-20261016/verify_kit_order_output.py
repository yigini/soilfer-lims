"""Actual LOCAL Node pipes/new retained files; no Docker or production data."""
import hashlib
import json
import pathlib
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_evidence
import kit_owned
from kit_contract import canonical
from kit_evidence import EvidenceLedger
from kit_order_output import OUTPUT_ADMISSION,STREAM_LIMIT,reserve_output,close_output
from kit_owned import cli_spec,filesystem_controls
from kit_integrity import DATA_MOUNT

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'order-output-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


class OrderOutput(unittest.TestCase):
    def node(self,code,root=None):
        root=directory() if root is None else root
        result=subprocess.run([shutil.which('node'),'-e',code,str(HERE/'order_impact.cjs'),str(root)],
            capture_output=True,timeout=30)
        (root/'test-driver.stdout').write_bytes(result.stdout);(root/'test-driver.stderr').write_bytes(result.stderr)
        self.assertEqual(result.returncode,0,result.stderr.decode('utf-8',errors='replace'))
        return root

    def test_binary_simultaneous_streams_exact_bound_empty_and_fast_exit_are_complete(self):
        self.node(r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {capture}=require(process.argv[1]),root=process.argv[2];
(async()=>{
 for(const count of [0,4096,262144]){
  const d=path.join(root,String(count));fs.mkdirSync(d);
  const code=`process.stdout.write(Buffer.alloc(${count},0));process.stderr.write(Buffer.alloc(${count},255));`;
  const argv=['-e',code],row=await capture(d,argv,cp.spawn,Math.max(4096,count));
  assert.equal(row.status,0);assert.equal(row.completeOriginals,true);
  for(const [name,byte] of [['stdout',0],['stderr',255]]){
   assert.equal(row.streams[name].eof,true);assert.equal(row.streams[name].overflow,false);
   assert.equal(row.streams[name].bytes,count);assert.deepEqual(fs.readFileSync(path.join(d,'order-impact.'+name)),Buffer.alloc(count,byte));
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1});''')

    def test_each_burst_overflow_stays_at_one_sentinel_and_refuses_reuse(self):
        self.node(r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {capture}=require(process.argv[1]),root=process.argv[2];
(async()=>{
 for(const name of ['stdout','stderr']){
  const d=path.join(root,name);fs.mkdirSync(d);
  const row=await capture(d,['-e',`process.${name}.write(Buffer.alloc(8*1024*1024,7));setInterval(()=>{},1000);`],cp.spawn,4096);
  assert.equal(row.completeOriginals,false);assert.equal(row.errorType,'OUTPUT_LIMIT_EXCEEDED');
  assert.equal(row.streams[name].bytes,4097);assert.equal(row.streams[name].overflow,true);
  for(const stream of ['stdout','stderr'])assert(fs.statSync(path.join(d,'order-impact.'+stream)).size<=4097);
  const old=fs.readFileSync(path.join(d,'order-impact.'+name));
  await assert.rejects(()=>capture(d,['-e','throw Error("MUST_NOT_RUN")'],cp.spawn,4096));
  assert.deepEqual(fs.readFileSync(path.join(d,'order-impact.'+name)),old);
 }
})().catch(e=>{console.error(e);process.exitCode=1});''')

    def test_nonzero_and_spawn_failure_preserve_original_outcomes(self):
        self.node(r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {capture}=require(process.argv[1]),root=process.argv[2];
(async()=>{
 const d=path.join(root,'nonzero');fs.mkdirSync(d);
 const row=await capture(d,['-e','process.stderr.write("ORIGINAL\\n");process.exitCode=7'],cp.spawn,4096);
 assert.equal(row.status,7);assert.equal(row.completeOriginals,true);assert.equal(row.streams.stderr.bytes,9);
 const failed=path.join(root,'spawn-failed');fs.mkdirSync(failed);
 const other=await capture(failed,[],()=>{throw Object.assign(Error('LOCAL'),{code:'LOCAL_SPAWN_REFUSAL'})},4096);
 assert.equal(other.completeOriginals,false);assert.equal(other.status,null);assert.equal(other.errorType,'LOCAL_SPAWN_REFUSAL');
 assert(fs.existsSync(path.join(failed,'order-impact-exit.json')));
})().catch(e=>{console.error(e);process.exitCode=1});''')

    def test_admission_requires_exact_canonical_limits_before_any_child_or_stream(self):
        root=directory();(root/'valid.json').write_bytes(canonical(OUTPUT_ADMISSION)+b'\n')
        (root/'valid.json.pending').hardlink_to(root/'valid.json')
        self.node(r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {readAdmission,collect}=require(process.argv[1]),root=process.argv[2];let calls=0;
const valid=fs.readFileSync(path.join(root,'valid.json'));assert.equal(readAdmission(path.join(root,'valid.json')).sentinelBytes,1);
(async()=>{
 for(const [name,raw] of [['duplicate',valid.toString().replace('"version":1','"version":0,"version":1')],
  ['missing','{}\n'],['oversize',' '.repeat(8193)],['changed',valid.toString().replace('67108864','67108865')]]){
  const d=path.join(root,name);fs.mkdirSync(d);fs.writeFileSync(path.join(d,'order-impact-admission.json'),raw);
  fs.linkSync(path.join(d,'order-impact-admission.json'),path.join(d,'order-impact-admission.json.pending'));
  await assert.rejects(()=>collect(path.join(root,'missing.db'),d,()=>{calls++;throw Error('MUST_NOT_RUN')}));
  assert.deepEqual(fs.readdirSync(d).sort(),['order-impact-admission.json','order-impact-admission.json.pending']);
 }
 assert.equal(calls,0);
 const consumed=path.join(root,'consumed');fs.mkdirSync(consumed);
 fs.writeFileSync(path.join(consumed,'order-impact.stderr'),'PREEXISTING_ORIGINAL');
 const {capture}=require(process.argv[1]);
 await assert.rejects(()=>capture(consumed,[],()=>{calls++;throw Error('MUST_NOT_RUN')},4096));
 assert.equal(calls,0);assert(!fs.existsSync(path.join(consumed,'order-impact.stdout')));
 assert.equal(fs.readFileSync(path.join(consumed,'order-impact.stderr'),'utf8'),'PREEXISTING_ORIGINAL');
 const paired=path.join(root,'foreign-pair');fs.mkdirSync(paired);
 fs.writeFileSync(path.join(paired,'admission'),valid);fs.writeFileSync(path.join(paired,'admission.pending'),valid);
 assert.throws(()=>readAdmission(path.join(paired,'admission')));
})().catch(e=>{console.error(e);process.exitCode=1});''',root)

    def test_full_output_reservation_refuses_before_temporary_directory(self):
        for bound in (None,8192):
            root=directory();temp=root/'future';book=None if bound is None else EvidenceLedger(root,
                {**kit_evidence.SHARES,'commands':bound})
            with patch.object(kit_evidence,'_runtime',book),self.assertRaises(RuntimeError):reserve_output(temp)
            self.assertFalse(temp.exists())

    def test_parent_checks_every_stream_and_exit_before_settling_reservations(self):
        for mutation in ('none','missing','bytes','hash','eof','overflow','status','argv','link','source'):
            root=directory();temp=root/'future';book=EvidenceLedger(root)
            with patch.object(kit_evidence,'_runtime',book):held=reserve_output(temp)
            temp.mkdir();streams={}
            for name in ('stdout','stderr'):
                raw=b'original '+name.encode();p=temp/('order-impact.'+name)
                if not (mutation=='missing' and name=='stderr'):p.write_bytes(raw)
                streams[name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'eof':True,'overflow':False}
            value={'version':1,'childArgv':['/app/server/scripts/install_order_revisions.js','--db',
                '/app/server/prisma/dev.db','--dry-run'],'status':0,'signal':None,'errorType':None,
                'streams':streams,'completeOriginals':True,'neverRetry':True,
                'sourceBefore':{'':None,'-wal':None,'-shm':None},'sourceAfter':{'':None,'-wal':None,'-shm':None}}
            identity={'':None,'-wal':None,'-shm':None}
            if mutation in ('bytes','hash','eof','overflow'):
                streams['stdout'][mutation]={'bytes':0,'hash':'0'*64,'eof':False,'overflow':True}[mutation]
                if mutation=='hash':streams['stdout']['sha256']=streams['stdout'].pop('hash')
            if mutation=='status':value['status']=True
            if mutation=='argv':value['childArgv'][-1]='--apply'
            if mutation=='link':(temp/'link').hardlink_to(temp/'order-impact.stdout')
            if mutation=='source':value['sourceAfter']['-shm']='0'*64
            (temp/'order-impact-exit.json').write_bytes(canonical(value)+b'\n')
            if mutation=='none':
                result=close_output(temp,held,identity);self.assertTrue(result['completeOriginals']);self.assertFalse(book.open)
                with self.assertRaises(RuntimeError):close_output(temp,held,identity)
            else:
                with self.assertRaises(RuntimeError):close_output(temp,held,identity)
                self.assertEqual(len(book.open),3)

    def test_real_node_child_and_parent_ledger_close_before_existing_exit_permission(self):
        root=directory();source=root/'dev.db';source.write_bytes(b'm'*4096);book=EvidenceLedger(root)
        spec=cli_spec('order-impact',DATA_MOUNT);spec['tmp']=(root/'order-impact-retained-temp').as_posix()
        spec['mounts'][0]['Source']=str(root)
        class LocalDisk:
            def admit_copy(self,*args):pass
        with patch.object(kit_owned,'ROOT',pathlib.PurePosixPath(root.as_posix())),\
             patch.object(kit_owned,'validate_spec',lambda value:value),patch.object(kit_evidence,'_runtime',book):
            prepare,read,permit=filesystem_controls(root,False,LocalDisk(),lambda:None)
            prepare(spec);temp=pathlib.Path(spec['tmp'])
            held_before=sum(book.used.values());self.assertGreater(held_before,2*STREAM_LIMIT)
            # Actual LOCAL pipes; only the scientific owner is a stand-in.
            code=r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {collect,CHILD}=require(process.argv[1]),root=process.argv[2],temp=path.join(root,'order-impact-retained-temp');
const scientific={mode:'DRY_RUN',totalChanges:0,backfilledCount:0,allScientificLists:['retained','verbatim'],
 readonlySnapshot:{originalFilesPreserved:true,path:'/tmp/lims-policy-schema-readonly-ABC123/snapshot.db'}};
const spawn=(exe,argv,options)=>{
 assert.deepEqual(argv,CHILD);assert.equal(options.env.TMPDIR,temp);assert.deepEqual(options.stdio,['ignore','pipe','pipe']);
 for(const name of ['ABC123','DEF456']){
  const d=path.join(temp,'lims-policy-schema-readonly-'+name);fs.mkdirSync(d);fs.copyFileSync(path.join(root,'dev.db'),path.join(d,'snapshot.db'));
 }
 return cp.spawn(exe,['-e','process.stdout.write('+JSON.stringify(JSON.stringify(scientific))+')'],options);
};
collect(path.join(root,'dev.db'),temp,spawn).then(value=>{
 assert.deepEqual(value.allScientificLists,scientific.allScientificLists);assert.equal(value.originalFilesPreserved,true);
 assert.equal(value.retainedAllocation.files.length,5);assert.equal(value.retainedAllocation.root,temp);
 fs.writeFileSync(path.join(root,'actual-result.json'),JSON.stringify(value));
}).catch(e=>{console.error(e);process.exitCode=1});'''
            self.node(code,root);self.assertIsNone(read(spec))
            (temp/'cli-child-complete.json').write_bytes(b'{}')
            self.assertEqual(read(spec),b'{}');self.assertEqual(read(spec),b'{}')
            self.assertTrue((temp/'snapshot-closure.json').exists())
            self.assertTrue((temp/'order-impact-output-closure.json').exists())
            self.assertLess(sum(book.used.values()),held_before)
            self.assertFalse((temp/'cli-exit-permit.json').exists())
            permit(spec,{'LOCAL_FINAL_MEMORY_PERMISSION_ONLY':True})
            self.assertTrue((temp/'cli-exit-permit.json').exists())
        self.assertEqual(source.read_bytes(),b'm'*4096)

    def test_pinned_owner_sources_unchanged_and_old_unbounded_wrapper_is_not_compiled(self):
        proof=json.loads((HERE/'order-impact-transport-source.json').read_bytes())
        for key in ('originalWrapper','unchangedScientificOwner'):
            row=proof[key];raw=subprocess.check_output(['git','show',proof['applicationHead']+':'+row['path']],cwd=HERE.parents[1])
            self.assertEqual(len(raw),row['bytes']);self.assertEqual(hashlib.sha256(raw).hexdigest(),row['sha256'])
        self.assertEqual(cli_spec('order-impact',DATA_MOUNT)['child'],
            ['/release/order_impact.cjs','--db','/app/server/prisma/dev.db'])
        for phase,mode in (('dry','--dry-run'),('apply','--apply'),('repeat','--apply')):
            self.assertEqual(cli_spec('209-'+phase,DATA_MOUNT)['child'],
                ['/app/server/scripts/install_order_revisions.js','--db','/app/server/prisma/dev.db',mode])
        self.node(r'''
const assert=require('node:assert/strict'),path=require('node:path');
const {validateMain}=require(path.join(path.dirname(process.argv[1]),'cli_guard.cjs'));
assert.throws(()=>validateMain(['/tmp','/app/server/scripts/order_revision_impact.js','--db','/app/server/prisma/dev.db']));
assert.doesNotThrow(()=>validateMain(['/tmp','/release/order_impact.cjs','--db','/app/server/prisma/dev.db']));
assert.throws(()=>validateMain(['/tmp','/release/order_impact.cjs','--db','/app/server/prisma/dev.db','--apply']));''')


if __name__=='__main__':unittest.main()
