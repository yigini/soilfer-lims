"""Native routing guards: LOCAL pipes/files, explicit Linux filesystem stand-ins.

The native sort uses the actual LOCAL addon, never a Docker/Linux VFS or a
production database. A query plan is not a measurement of peak scratch space.
"""
import copy
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest
from kit_contract import canonical
from kit_journal import exclusive_record
from kit_cli_output import admission
from kit_owned import ALLOWED,cli_spec,selected
from kit_capture_owned import CAPTURE_COMMANDS,capture_spec,capture_selected
from kit_integrity import DATA_MOUNT
import verify_kit_owned as owned_fixture
import verify_kit_capture_owned as capture_fixture

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'sqlite-temp-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='native-temp-',dir=FIXTURES)).resolve()


# Every filesystem operation in this facade is an explicit Linux stand-in.
# No global process/fs object or native SQLite implementation is modified.
FACADE=r'''
const assert=require('node:assert/strict');
const {temporaryDirectory}=require(process.argv[1]);
function fixture() {
 const events=[], state={mode:0o40700n,dev:7n,ino:11n,uid:0n,gid:0n,alias:false,real:'/tmp',access:true};
 function stat(root=false) {return {...state,ino:root?1n:state.ino,
   isDirectory:()=>!state.file,isSymbolicLink:()=>!!state.alias};}
 const io={constants:{O_RDONLY:0,O_DIRECTORY:65536,O_NOFOLLOW:131072,W_OK:2,X_OK:1},
   lstatSync:p=>{events.push(['lstat',p]);return stat(p==='/');},
   realpathSync:p=>p==='/'?'/':state.real,
   openSync:(p,flags)=>{events.push(['open',p,flags]);return 91;},
   fstatSync:fd=>{events.push(['fstat',fd]);const s=stat();if(state.foreignFd)s.ino=99n;return s;},
   accessSync:(p,flags)=>{events.push(['access',p,flags]);if(!state.access)throw Error('LOCAL_ACCESS_REFUSAL');},
   closeSync:fd=>events.push(['close',fd])};
 const env={SQLITE_TMPDIR:'/tmp',TMPDIR:'/tmp',TMP:'/tmp',TEMP:'/tmp'};
 return {events,state,io,env,options:{platform:'linux',env,io}};
}
'''


class SqliteTemporaryRouting(unittest.TestCase):
    def node(self,code,root=None,extra=()):
        root=root or directory()
        result=subprocess.run([shutil.which('node'),'-e',code,str(HERE/'sqlite_temp_directory.cjs'),*map(str,extra)],
            capture_output=True,timeout=30)
        (root/'stdout-original.txt').write_bytes(result.stdout)
        (root/'stderr-original.txt').write_bytes(result.stderr)
        self.assertEqual(result.returncode,0,result.stderr.decode('utf-8','replace'))
        return result,root

    def test_all_twenty_one_exact_specs_pin_native_environment_and_inspection(self):
        for label in ALLOWED:
            spec=cli_spec(label,DATA_MOUNT)
            self.assertEqual(spec['environment']['SQLITE_TMPDIR'],'/tmp')
            self.assertEqual(spec['argv'].count('SQLITE_TMPDIR=/tmp'),1)
            original=owned_fixture.obj(spec,False)
            selected(original,spec,False)
            for replacement in (None,'/var/tmp',''):
                changed=copy.deepcopy(original)
                changed['Config']['Env']=[v for v in changed['Config']['Env'] if not v.startswith('SQLITE_TMPDIR=')]
                if replacement is not None:changed['Config']['Env'].append('SQLITE_TMPDIR='+replacement)
                with self.assertRaises(RuntimeError):selected(changed,spec,False)
                # A resource/environment violation cannot suppress the exact
                # rightful emergency stop of an otherwise identical owner.
                selected(changed,spec,False,True)
        for label in CAPTURE_COMMANDS:
            spec=capture_spec(label);self.assertEqual(spec['argv'].count('SQLITE_TMPDIR=/tmp'),1)
            value=capture_fixture.capture_object(spec,False)
            capture_selected(value,spec,False)
            value['Config']['Env']=[v for v in value['Config']['Env'] if not v.startswith('SQLITE_TMPDIR=')]
            with self.assertRaises(RuntimeError):capture_selected(value,spec,False)
            capture_selected(value,spec,False,True)

    def test_linux_candidate_access_and_held_descriptor_then_close_are_exact(self):
        self.node(FACADE+r'''
const f=fixture(), original=JSON.stringify(f.env);
const lease=temporaryDirectory('/tmp',f.options);lease.check();lease.close();lease.close();
assert.equal(f.events.filter(v=>v[0]==='open').length,1);
assert.equal(f.events.filter(v=>v[0]==='close').length,1);
assert.deepEqual(f.events.filter(v=>v[0]==='access'),[['access','/tmp',3],['access','/tmp',3]]);
assert.deepEqual(f.events.find(v=>v[0]==='open'),['open','/tmp',65536|131072]);
assert.equal(JSON.stringify(f.env),original);assert.throws(()=>lease.check());
''')

    def test_unknown_platform_or_environment_refuses_before_filesystem_or_child(self):
        self.node(FACADE+r'''
for(const platform of ['win32','darwin',null,true,'']) {
 const f=fixture();assert.throws(()=>temporaryDirectory('/tmp',{...f.options,platform}));assert.equal(f.events.length,0);
}
for(const key of ['SQLITE_TMPDIR','TMPDIR','TMP','TEMP']) for(const value of [undefined,'/var/tmp','',true]) {
 const f=fixture();f.env[key]=value;assert.throws(()=>temporaryDirectory('/tmp',f.options));assert.equal(f.events.length,0);
}
const f=fixture();assert.throws(()=>temporaryDirectory('/var/tmp',f.options));assert.equal(f.events.length,0);
''')

    def test_alias_modes_access_and_descriptor_mutations_refuse_and_close(self):
        self.node(FACADE+r'''
for(const [key,value] of [['alias',true],['file',true],['real','/other'],['mode',0o40777n],['mode',0o41700n],
 ['foreignFd',true],['access',false]]) {
 const f=fixture();f.state[key]=value;assert.throws(()=>temporaryDirectory('/tmp',f.options));
 assert.equal(f.events.filter(v=>v[0]==='close').length,f.events.filter(v=>v[0]==='open').length);
}
for(const [key,value] of [['dev',8n],['ino',12n],['uid',1n],['gid',1n],['mode',0o40750n],['alias',true],
 ['real','/other'],['foreignFd',true],['access',false]]) {
 const f=fixture(), lease=temporaryDirectory('/tmp',f.options);f.state[key]=value;
 assert.throws(()=>lease.check());lease.close();assert.equal(f.events.filter(v=>v[0]==='close').length,1);
}
''')

    def test_routing_refusal_before_spawn_and_after_real_child_keeps_originals(self):
        for final_failure in (False,True):
            root=directory();temp=root/'retained-temp';temp.mkdir()
            marker=root/'scientific-child-ran'
            child=['-e','require("node:fs").writeFileSync('+json.dumps(str(marker))+',"LOCAL");process.stdout.write("ORIGINAL");']
            exclusive_record(temp,'cli-output-admission.json',admission(child),os.name=='posix')
            code=r'''
const assert=require('node:assert/strict'),fs=require('node:fs');
const guard=require(process.argv[2]),directory=process.argv[3],child=JSON.parse(process.argv[4]);
const after=process.argv[5]==='true';let checks=0,closes=0;
const routing=()=>{if(!after)throw Error('LOCAL_BEFORE_ROUTING_REFUSAL');return {
 check(){checks++;throw Error('LOCAL_AFTER_ROUTING_REFUSAL');},close(){closes++;}};};
(async()=>{
 await assert.rejects(()=>guard.runChild(directory,child,routing),/LOCAL_.*_ROUTING_REFUSAL/);
 assert.equal(checks,after?1:0);assert.equal(closes,after?1:0);
 assert.equal(fs.existsSync(directory+'/cli-child-complete.json'),false);
 assert.equal(fs.existsSync(directory+'/cli-exit-permit.json'),false);
 if(after)assert.equal(fs.readFileSync(directory+'/cli-original.stdout','utf8'),'ORIGINAL');
 else assert.equal(fs.existsSync(directory+'/cli-original.stdout'),false);
})().catch(e=>{console.error(e);process.exitCode=1;});
'''
            self.node(code,root,[HERE/'cli_guard.cjs',temp,json.dumps(child),json.dumps(final_failure)])
            self.assertEqual(marker.exists(),final_failure)

    def test_pinned_native_source_and_incomplete_scope_are_verified(self):
        proof=json.loads((HERE/'sqlite-temp-directory-source.json').read_bytes())
        source=HERE.parents[1]/proof['sqliteSource']['path'];raw=source.read_bytes()
        self.assertEqual(len(raw),proof['sqliteSource']['bytes'])
        self.assertEqual(hashlib.sha256(raw).hexdigest(),proof['sqliteSource']['sha256'])
        lines=raw.splitlines(keepends=True)
        for ref in proof['sqliteSource']['excerpts']:
            exact=b''.join(lines[ref['firstLine']-1:ref['lastLine']])
            self.assertEqual(exact,ref['text'].encode());self.assertEqual(len(exact),ref['bytes'])
            self.assertEqual(hashlib.sha256(exact).hexdigest(),ref['sha256'])
        ref=proof['nativePackageSourceProof']
        self.assertEqual(hashlib.sha256((HERE/ref['file']).read_bytes()).hexdigest(),ref['sha256'])
        for key in ('sqlTemporaryFileBytesBounded','temporaryOriginalBytesRetained','completeCallGraphClosed',
                    'physicalFilesystemClosureClaimed','operationalExecutionPerformed','sqlPragmaChanged',
                    'scientificArgvChanged','childDeadlineAdded','childSignalledOnRoutingFailure'):
            self.assertIs(proof[key],False)
        guard=(HERE/'cli_guard.cjs').read_text()
        self.assertLess(guard.index('const temporary = routing(directory)'),guard.index('await output.capture'))
        self.assertLess(guard.index('temporary.check()'),guard.index('writeOnce(complete, record)'))
        self.assertIn('runChild(value.directory, value.child)',guard)
        self.assertIn('runChild(value.directory, value.child)',(HERE/'capture_cli_guard.cjs').read_text())

    def test_real_local_native_sort_is_not_reported_as_peak_or_linux_proof(self):
        root=directory();tmp=root/'native-temp';tmp.mkdir()
        addon=HERE.parents[1]/'server/node_modules/better-sqlite3'
        code=r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Database=require(process.argv[2]),root=process.argv[3],tmp=process.argv[4];
// LOCAL Windows VFS uses TEMP/TMP. Linux routing/hardware is not exercised.
process.env.TEMP=process.env.TMP=process.env.TMPDIR=process.env.SQLITE_TMPDIR=tmp;
const filename=root+'/owned.db',writer=new Database(filename);
writer.exec('CREATE TABLE retained(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');
const put=writer.prepare('INSERT INTO retained VALUES(?,?)');
writer.transaction(()=>{for(let i=0;i<1024;i++)put.run(i,String(i).padStart(5,'0')+'x'.repeat(8192));})();writer.close();
const before=crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const db=new Database(filename,{readonly:true,fileMustExist:true});
assert(db.pragma('compile_options').some(r=>r.compile_options==='TEMP_STORE=1'));
assert.equal(db.pragma('temp_store',{simple:true}),0);
const native=db.prepare('SELECT sqlite_version() AS version,sqlite_source_id() AS sourceId').get();
const sql='SELECT payload FROM retained ORDER BY payload DESC';
const plan=db.prepare('EXPLAIN QUERY PLAN '+sql).all();assert(plan.some(r=>r.detail.includes('USE TEMP B-TREE')));
let count=0;for(const row of db.prepare(sql).iterate())assert(row.payload.startsWith(String(1023-count++).padStart(5,'0')));
assert.equal(count,1024);db.close();
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex'),before);
fs.writeFileSync(root+'/native-observation.json',JSON.stringify({platform:process.platform,rows:count,plan,
 native,sourceUnchanged:true,linuxVfsTested:false,
 completeScratchOriginalsRetained:false,peakScratchBytesMeasured:false,filesystemClosureClaimed:false}));
'''
        self.node(code,root,[addon,root,tmp])


if __name__=='__main__':unittest.main()
