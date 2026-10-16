"""Read-only Docker transport for the shared identity/memory readers.

No create/start/stop method is available here. The future production adapter
must add separately guarded mutation paths and bind them to the reviewed kit.
"""
import re
import time
from kit_contract import require

_reader=None

def configure_reader(reader):
    global _reader
    require(_reader is None and isinstance(reader,ContainerReader),'Read-only Docker transport already bound or invalid')
    _reader=reader

def inspect(identity):
    require(_reader is not None,'No reviewed read-only Docker transport bound')
    return _reader.inspect(identity)

class ContainerReader:
    def __init__(self,runner,known_predecessor):
        require(re.fullmatch('[a-f0-9]{64}',known_predecessor or ''),'Known predecessor required')
        self.runner=runner;self.predecessor=known_predecessor;self.number=0

    def read(self,argv):
        self.number+=1
        raw,err,metadata=self.runner.run(argv,'docker-read-'+str(self.number).zfill(6),15,
            output_limits={'stdout':4*1024**2,'stderr':64*1024**2})
        require(not err and metadata['stdout']['bytes']<=4*1024**2,'Bounded Docker read refused')
        return raw

    def inspect(self,identity):
        require(isinstance(identity,str) and re.fullmatch('[a-zA-Z0-9][a-zA-Z0-9_.-]{0,255}',identity),'Exact Docker identity required')
        from retained_contract import exact_json
        rows=exact_json(self.read(['docker','inspect',identity]))
        require(isinstance(rows,list) and len(rows)==1 and isinstance(rows[0],dict),'Single exact inspection required')
        row=rows[0]
        require(re.fullmatch('[a-f0-9]{64}',row.get('Id','')) and re.fullmatch('/[a-zA-Z0-9][a-zA-Z0-9_.-]*',row.get('Name','')),'Malformed Docker identity/name')
        require(row['Id']==identity if len(identity)==64 and re.fullmatch('[a-f0-9]{64}',identity) else row['Name']=='/'+identity,'Inspected identity differs from requested exact ID/name')
        return row

    def inventory(self):
        deadline=time.monotonic()+60
        raw=self.read(['docker','ps','-aq','--no-trunc'])
        require(len(raw)<=512*1024,'Container ID inventory too large')
        ids=raw.decode('ascii').splitlines()
        require(len(ids)<=4096 and len(ids)==len(set(ids)) and self.predecessor in ids and all(re.fullmatch('[a-f0-9]{64}',x) for x in ids),'Incomplete/duplicate/malformed inventory or known predecessor absent')
        rows={}
        for identity in ids:
            require(time.monotonic()<deadline,'Complete inventory deadline reached; never infer absence')
            rows[identity]=self.inspect(identity)
        require(time.monotonic()<deadline,'Complete inventory deadline reached; never infer absence')
        require(len({row['Name'] for row in rows.values()})==len(rows),'Duplicate canonical container name')
        return rows
