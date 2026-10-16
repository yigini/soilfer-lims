"""Evidence-only utilities for unique precheck boundaries; no automatic actions."""
import datetime, hashlib, json, pathlib, subprocess
W=pathlib.Path(__file__).resolve().parents[2]
B=W/'WP/controller063000-prechecks-be837974-20261016'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def git(*args,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=W,input=input)
def save(d,name,raw):
    p=d/name;p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('xb') as f:f.write(raw)
def raw_many(head,names):
    raw=git('cat-file','--batch',input=('\n'.join(head+':'+n for n in names)+'\n').encode());at=0;out={}
    for name in names:
        end=raw.index(b'\n',at);given,kind,size=raw[at:end].decode().split();size=int(size);at=end+1;data=raw[at:at+size];at+=size
        assert kind=='blob' and len(data)==size and given==oid(data) and raw[at:at+1]==b'\n';at+=1;out[name]=data
    assert at==len(raw)
    return out
def verify_publication(head,relative,count):
    raw=git('show',head+':'+relative);pub=json.loads(raw);rows=pub.get('bindings',pub.get('files'));assert len(rows)==count
    data=raw_many(head,[r['path'] for r in rows])
    for r in rows:
        value=data[r['path']];assert len(value)==r.get('length',r.get('bytes')) and sha(value)==r['sha256'] and oid(value)==r['gitBlobOid']
    return {'head':head,'index':relative,'indexSha256':sha(raw),'verifiedIncludingIndex':count+1}
def publish(d,extras,message,lead=None):
    assert not git('diff','--cached','--name-only').strip()
    readmes=[]
    if lead:
        for name in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
            p=W/name;prior=p.read_bytes();p.write_bytes(lead.encode()+prior);assert p.read_bytes()[len(lead.encode()):]==prior;readmes.append(p)
        save(d,'checkpoint-prefix.txt',lead.encode())
    paths=sorted({p for p in d.rglob('*') if p.is_file()}|set(extras)|set(readmes))
    assert all(p.is_file() and p.is_relative_to(W) for p in paths)
    rows=[{'path':p.relative_to(W).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]
    save(d,'publication-index.json',canonical({'baseAudit':git('rev-parse','HEAD').decode().strip(),'bindings':rows})+b'\n');paths.append(d/'publication-index.json')
    names=[p.relative_to(W).as_posix() for p in paths]
    git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file=-','--pathspec-file-nul',input=b'\0'.join(n.encode() for n in names)+b'\0')
    assert {n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names)
    def verify(ref):
        raws=raw_many(ref,names) if ref!='' else None
        if ref=='':
            raw=git('cat-file','--batch',input=('\n'.join(':'+n for n in names)+'\n').encode());at=0;raws={}
            for n in names:
                end=raw.index(b'\n',at);given,kind,size=raw[at:end].decode().split();size=int(size);at=end+1;value=raw[at:at+size];at+=size
                assert kind=='blob' and oid(value)==given and raw[at:at+1]==b'\n';at+=1;raws[n]=value
            assert at==len(raw)
        for p,n in zip(paths,names):assert raws[n]==p.read_bytes()
    verify('');git('commit','-m',message);head=git('rev-parse','HEAD').decode().strip();verify(head)
    git('push','origin','HEAD:audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
    return {'audit':head,'rawGitOidShaLengthFilesVerified':len(paths),'publication':(d/'publication-index.json').relative_to(W).as_posix()}
