"""Real LOCAL binary pipes and parent admissions; scientific children stand-ins."""
import copy
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch
import kit_evidence
import kit_owned
from kit_cli_output import STREAM_LIMIT,admission,reserve_cli_output,publish_cli_admission,verify_cli_output,verify_completion_record
from kit_cli_evidence import CLI_ENVELOPE,bounds
from kit_journal import exclusive_record
from kit_contract import canonical
from kit_owned import cli_spec,filesystem_controls
from kit_integrity import DATA_MOUNT
from verify_kit_owned import StandIn

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'cli-output-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()

class CliOutput(unittest.TestCase):
    def node(self,code,root):
        result=subprocess.run([shutil.which('node'),'-e',code,str(HERE/'cli_output.cjs'),str(root)],capture_output=True,timeout=30)
        (root/'local-node.stdout').write_bytes(result.stdout);(root/'local-node.stderr').write_bytes(result.stderr)
        self.assertEqual(result.returncode,0,result.stderr.decode(errors='replace'))
        return result

    def test_binary_empty_exact_fast_exit_and_simultaneous_streams(self):
        root=directory()
        self.node(r'''
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require(process.argv[1]);
(async()=>{
 for(const n of [0,4096,262144]){
  const d=path.join(process.argv[2],String(n));fs.mkdirSync(d);
  const code='const b=Buffer.alloc('+n+');for(let i=0;i<b.length;i++)b[i]=i%256;process.stdout.write(b);process.stderr.write(b)';
  const value=await c.capture(d,['-e',code],undefined,Math.max(4096,n));
  a.equal(value.status,0);a.equal(value.output.completeOriginals,true);
  for(const name of ['stdout','stderr']){
   const raw=fs.readFileSync(path.join(d,'cli-original.'+name));a.equal(raw.length,n);
   for(let i=0;i<n;i++)a.equal(raw[i],i%256);
   a.equal(value.output.streams[name].eof,true);a.equal(value.output.streams[name].overflow,false);
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1});''',root)

    def test_overflow_and_write_failure_drain_without_signalling_child(self):
        root=directory()
        self.node(r'''
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),c=require(process.argv[1]);
(async()=>{
 for(const failure of ['overflow','write']){
  const d=path.join(process.argv[2],failure);fs.mkdirSync(d);const finished=path.join(d,'finished');
  const code='const fs=require("node:fs"),b=Buffer.alloc(8*1024**2,65);process.stdout.write(b,()=>process.stderr.write(b,()=>fs.writeFileSync('+JSON.stringify(finished)+',"FINISHED")))';
  const spawn=(exe,argv,options)=>{
   a.equal(options.timeout,undefined);a.deepEqual(options.stdio,['ignore','pipe','pipe']);
   const p=cp.spawn(exe,argv,options);p.kill=()=>{throw Error('CAPTURE_MUST_NOT_SIGNAL');};return p;
  };
  const write=failure==='write'?()=>{throw Object.assign(Error('LOCAL_WRITE_FAILURE'),{code:'EIO'});}:fs.writeSync;
  const value=await c.capture(d,['-e',code],spawn,4096,write);
  a.equal(value.status,0);a.equal(value.output.completeOriginals,false);a.equal(value.output.childSignalledByCapture,false);
  a.equal(fs.readFileSync(finished,'utf8'),'FINISHED');
  for(const name of ['stdout','stderr']){
   const row=value.output.streams[name];a.equal(row.eof,true);a.equal(row.unretainedBytesObserved,true);
   a.equal(fs.statSync(path.join(d,'cli-original.'+name)).size,failure==='overflow'?4097:0);
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1});''',root)

    def test_nonzero_spawn_failure_and_consumed_namespace_remain_explicit(self):
        root=directory()
        self.node(r'''
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require(process.argv[1]);
(async()=>{
 for(const mode of ['nonzero','spawn']){
  const d=path.join(process.argv[2],mode);fs.mkdirSync(d);
  const spawn=mode==='spawn'?()=>{throw Object.assign(Error(),{code:'ENOENT'});}:undefined;
  const value=await c.capture(d,['-e','process.stdout.write("original");process.exitCode=7'],spawn,4096);
  a.equal(value.status,mode==='nonzero'?7:null);a.equal(value.output.completeOriginals,mode==='nonzero');
  const before=fs.readFileSync(path.join(d,'cli-original.stdout'));
  await a.rejects(c.capture(d,['-e','throw Error("NEVER")']));
  a.deepEqual(fs.readFileSync(path.join(d,'cli-original.stdout')),before);
 }
})().catch(e=>{console.error(e);process.exitCode=1});''',root)

    def produce(self,root):
        child=['-e','process.stdout.write("ORIGINAL\\x00\\xff")']
        temp=root/'retained';book=kit_evidence.EvidenceLedger(root)
        with patch.object(kit_evidence,'_runtime',book):held=reserve_cli_output(temp)
        temp.mkdir();publish_cli_admission(temp,child,held,False)
        self.node('const fs=require("node:fs"),c=require(process.argv[1]);c.capture('+json.dumps(str(temp))+','+json.dumps(child)+').then(v=>fs.writeFileSync('+json.dumps(str(root/'value.json'))+',JSON.stringify(v))).catch(e=>{console.error(e);process.exitCode=1})',root)
        return child,temp,book,held,json.loads((root/'value.json').read_bytes())['output']

    def test_parent_independently_rehashes_full_originals_before_and_after_stop(self):
        root=directory();child,temp,book,held,value=self.produce(root)
        result=verify_cli_output(temp,child,value,held)
        self.assertFalse(book.open);self.assertTrue(result[2]['completeOriginals'])
        raw,err,_=verify_cli_output(temp,child,value,read_bytes=True)
        self.assertEqual(raw,'ORIGINAL\x00\xff'.encode());self.assertEqual(err,b'')
        with self.assertRaises(RuntimeError):verify_cli_output(temp,child,value,held)
        p=temp/'cli-original.stdout';p.chmod(0o600);p.write_bytes(b'MUTATED');p.chmod(0o400)
        with self.assertRaises(RuntimeError):verify_cli_output(temp,child,value)

    def test_missing_foreign_pair_and_falsified_completion_streams_refuse(self):
        root=directory();child,temp,book,held,value=self.produce(root)
        for field,replacement in [('eof',False),('overflow',True),('bytes',True),('sha256','0'*64),('unretainedBytesObserved',True)]:
            changed=copy.deepcopy(value);changed['streams']['stdout'][field]=replacement
            with self.subTest(field=field),self.assertRaises(RuntimeError):verify_cli_output(temp,child,changed)
        with self.assertRaises(RuntimeError):verify_cli_output(temp,child+['--apply'],value)
        (temp/'cli-original.stderr').rename(temp/'retained-original-stderr')
        with self.assertRaises((RuntimeError,FileNotFoundError)):verify_cli_output(temp,child,value)
        pair=directory();record=canonical(admission(child))+b'\n'
        for name in ('cli-output-admission.json','cli-output-admission.json.pending'):
            p=pair/name;p.write_bytes(record);p.chmod(0o400)
        with self.assertRaises(RuntimeError):verify_cli_output(pair,child,value)
        completed=directory();exclusive_record(completed,'cli-child-complete.json',{'LOCAL':True},False)
        raw=(completed/'cli-child-complete.json').read_bytes();verify_completion_record(completed,raw)
        with self.assertRaises(RuntimeError):verify_completion_record(completed,raw+b' ')

    def test_full_pipe_and_control_admissions_fit_before_create_without_extra_pool(self):
        root=directory();book=kit_evidence.EvidenceLedger(root);temp=root/'retained'
        with patch.object(kit_evidence,'_runtime',book):held=reserve_cli_output(temp)
        self.assertFalse(temp.exists());self.assertEqual(len(book.open),3)
        window=book.begin_window('local-cli',CLI_ENVELOPE);self.assertEqual(sum(CLI_ENVELOPE.values()),2980*1024**2)
        self.assertLess(sum(book.used.values()),3045*1024**2);bounds();window.close()
        tiny=kit_evidence.EvidenceLedger(directory(),dict.fromkeys(kit_evidence.SHARES,4096))
        with patch.object(kit_evidence,'_runtime',tiny),self.assertRaises(RuntimeError):reserve_cli_output(tiny.root/'refused')
        self.assertFalse((tiny.root/'refused').exists())

    def test_insufficient_control_pair_allowance_refuses_before_mkdir(self):
        root=directory();book=kit_evidence.EvidenceLedger(root,
            {**kit_evidence.SHARES,'commands':65*1024**2,'journal':10*4096})
        with patch.object(kit_owned,'ROOT',pathlib.PurePosixPath(root.as_posix())),patch.object(kit_evidence,'_runtime',book):
            spec=cli_spec('stopped-integrity',DATA_MOUNT)
            prepare,_,_=filesystem_controls(root,False)
            with self.assertRaisesRegex(RuntimeError,'exhausted'):prepare(spec)
            self.assertFalse(pathlib.Path(spec['tmp']).exists())

    def test_missing_or_foreign_admission_refuses_before_any_child(self):
        root=directory();marker=root/'NEVER_CREATED'
        child=['-e','require("node:fs").writeFileSync('+json.dumps(str(marker))+',"FORBIDDEN")']
        for mode in ('missing','foreign','oversize'):
            temp=root/mode;temp.mkdir()
            if mode!='missing':
                raw=canonical(admission(child))+b'\n' if mode=='foreign' else b'X'*8193
                for name in ('cli-output-admission.json','cli-output-admission.json.pending'):
                    p=temp/name;p.write_bytes(raw);p.chmod(0o400)
            code='require('+json.dumps(str(HERE/'cli_guard.cjs'))+').runChild('+json.dumps(str(temp))+','+json.dumps(child)+').then(()=>process.exitCode=5).catch(()=>process.exitCode=0)'
            result=subprocess.run([shutil.which('node'),'-e',code],capture_output=True,timeout=10)
            self.assertEqual(result.returncode,0);self.assertFalse(marker.exists())
            self.assertFalse((temp/'cli-original.stdout').exists())

    def test_all_owned_specs_disable_daemon_logs_and_lifecycle_requires_originals(self):
        from kit_owned import ALLOWED
        for label in ALLOWED:
            spec=cli_spec(label,DATA_MOUNT);i=spec['argv'].index('--log-driver')
            self.assertEqual(spec['argv'][i+1],'none')
        spec=cli_spec('206-apply',DATA_MOUNT);stand=StandIn(spec)
        from kit_journal import Journal
        root=directory();manager=stand.manager(Journal(root,str(root),'f'*64,False))
        manager.run(spec)
        self.assertLess(stand.events.index('output-before-memory'),stand.events.index('memory:before-stop'))
        self.assertLess(stand.events.index('wait'),stand.events.index('output-final'))
        self.assertNotIn('logs',stand.events)
        root=directory();stand=StandIn(spec);manager=stand.manager(Journal(root,str(root),'f'*64,False))
        manager.output_reader=lambda *args:(_ for _ in ()).throw(RuntimeError('LOCAL_OUTPUT_REFUSAL'))
        with self.assertRaises(RuntimeError):manager.run(spec)
        self.assertNotIn('permit',stand.events);self.assertEqual(stand.stop_calls,[[spec['label']]])

    def test_real_silent_supervisor_parent_completion_pair_and_exit_permission(self):
        root=directory();book=kit_evidence.EvidenceLedger(root)
        spec=cli_spec('stopped-integrity',DATA_MOUNT)
        spec['tmp']=(root/'stopped-integrity-retained-temp').as_posix()
        spec['child']=['-e','process.stdout.write(Buffer.from([0,13,10,255]));']
        with patch.object(kit_owned,'ROOT',pathlib.PurePosixPath(root.as_posix())),\
             patch.object(kit_owned,'validate_spec',lambda value:value),patch.object(kit_evidence,'_runtime',book):
            prepare,read,permit=filesystem_controls(root,False);prepare(spec);temp=pathlib.Path(spec['tmp'])
            code='require('+json.dumps(str(HERE/'cli_guard.cjs'))+').runChild('+json.dumps(str(temp))+','+json.dumps(spec['child'])+').catch(()=>process.exitCode=1)'
            with (root/'wrapper.stdout').open('wb') as out,(root/'wrapper.stderr').open('wb') as err:
                process=subprocess.Popen([shutil.which('node'),'-e',code],stdout=out,stderr=err)
                try:
                    until=time.monotonic()+10
                    while not (temp/'cli-child-complete.json').exists():
                        if process.poll() is not None or time.monotonic()>until:self.fail('LOCAL supervisor did not close originals')
                        time.sleep(0.02)
                    raw=read(spec);self.assertIsNone(process.poll())
                    self.assertEqual(read.output(spec,raw,False)[0],b'')
                    permit(spec,{'childCompletionSha256':hashlib.sha256(raw).hexdigest(),'finalHostMemoryEventsCaptured':True})
                    self.assertEqual(process.wait(timeout=10),0)
                    self.assertEqual(read.output(spec,raw,True)[0],bytes([0,13,10,255]))
                    with self.assertRaisesRegex(RuntimeError,'Fresh CLI'):prepare(spec)
                finally:
                    if process.poll() is None:process.terminate();process.wait(timeout=5)
            self.assertEqual((root/'wrapper.stdout').read_bytes(),b'');self.assertEqual((root/'wrapper.stderr').read_bytes(),b'')

if __name__=='__main__':unittest.main()
