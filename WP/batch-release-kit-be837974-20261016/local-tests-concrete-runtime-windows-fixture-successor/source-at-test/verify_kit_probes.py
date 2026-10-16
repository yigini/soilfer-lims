"""Frozen-source tampering and all-column post-probe preservation negatives."""
import json
import pathlib
import sqlite3
import tempfile
import unittest
from kit_probes import Probes,PROBES,bound_probes
from retained_files import file_state

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'probes-local-retained-fixtures'

def fixture():
    FIXTURES.mkdir(exist_ok=True);root=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()
    tooling=root/'tooling';tooling.mkdir()
    for name in (*PROBES,'probe-source-map.json'):(tooling/name).write_bytes((HERE/name).read_bytes())
    path=root/'first-sync.db';db=sqlite3.connect(path)
    db.execute('CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY)')
    db.executemany('INSERT INTO _schema_migrations VALUES (?)',[(str(i),) for i in range(42)])
    db.execute('CREATE TABLE Original(id TEXT,value TEXT)');db.execute("INSERT INTO Original VALUES('old','unchanged')")
    for i in range(110):db.execute('CREATE TABLE "Synthetic'+str(i)+'" (id TEXT,value TEXT)')
    db.commit();db.close()
    runtime=root/'runtime.db';runtime.write_bytes(path.read_bytes())
    return root,tooling,path,runtime

class ProbeGuards(unittest.TestCase):
    def test_exact_six_frozen_sources_refuse_tampering_before_any_exec(self):
        root,tooling,baseline,runtime=fixture();self.assertEqual(set(bound_probes(tooling)),set(PROBES))
        (tooling/PROBES[0]).write_bytes(b'SYNTHETIC_UNREVIEWED_SOURCE')
        with self.assertRaises(RuntimeError):bound_probes(tooling)

    def test_full_post_probe_comparison_refuses_same_count_changed_value(self):
        for tamper in (False,True):
            root,tooling,baseline,runtime=fixture();calls=[]
            class Runner:
                def run(self,argv,label,*args,**kwargs):
                    calls.append(label)
                    if tamper and label=='postflight-api31':
                        db=sqlite3.connect(runtime);db.execute("UPDATE Original SET value='forbidden'");db.commit();db.close()
                    return (b'POSTFLIGHT SUMMARY: 31/31 checks passed (0 failed)\n',b'',{})
            class Cli:
                def run(self,spec):
                    self.spec=spec;d=root/'postflight-backup-retained-temp';d.mkdir();path=d/'backup.db'
                    a=sqlite3.connect(runtime);b=sqlite3.connect(path)
                    try:a.backup(b)
                    finally:a.close();b.close()
                    identity=file_state(path)
                    return json.dumps({'backupPath':'/tmp/backup.db','bytes':identity['bytes'],'sha256':identity['sha256'],
                        'sourceReadonly':True,'kernelReadOnlyDataMountRequired':True,'consistentBackup':True,'neverRetry':True}).encode(),{}
            class Monitor:
                def observe(self,*args):pass
            class Journal:
                def append(self,*args):pass
            cli=Cli();probes=Probes(root,tooling,Runner(),cli,Monitor(),Journal())
            if tamper:
                with self.assertRaises(RuntimeError):probes.run('a'*64,baseline)
            else:
                result=probes.run('a'*64,baseline);self.assertTrue(result['fullAllColumnStatePreserved'])
            self.assertEqual(len(calls),7);self.assertFalse(cli.spec['dataWritable'])

if __name__=='__main__':unittest.main()
