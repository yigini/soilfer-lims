"""Publish explicit existing evidence, including unchanged indexed dependencies."""
from prechecks6210209468_evidence import *
def boundary_publish(d,extras,message,lead):
    paths=set(extras)
    for name in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
        p=W/name;prior=p.read_bytes();p.write_bytes(lead.encode()+prior);assert p.read_bytes()[len(lead.encode()):]==prior;paths.add(p)
    save(d,'checkpoint-prefix.txt',lead.encode())
    paths=sorted(paths|{p for p in d.rglob('*') if p.is_file()});assert all(p.is_file() and p.is_relative_to(W) for p in paths)
    names=[p.relative_to(W).as_posix() for p in paths]
    staged={n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n};assert staged<=set(names),'Unrelated stage refused'
    rows=[{'path':n,'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p,n in zip(paths,names)]
    save(d,'publication-index.json',canonical({'baseAudit':git('rev-parse','HEAD').decode().strip(),'bindings':rows,'unchangedDependenciesIncluded':True})+b'\n');paths.append(d/'publication-index.json');names.append((d/'publication-index.json').relative_to(W).as_posix())
    git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file=-','--pathspec-file-nul',input=b'\0'.join(n.encode() for n in names)+b'\0')
    staged={n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n};assert staged and staged<=set(names)
    def verify(ref):
        raw=git('cat-file','--batch',input=('\n'.join(ref+n for n in names)+'\n').encode());at=0
        for p in paths:
            end=raw.index(b'\n',at);given,kind,size=raw[at:end].decode().split();size=int(size);at=end+1;value=raw[at:at+size];at+=size
            assert kind=='blob' and value==p.read_bytes() and given==oid(value) and raw[at:at+1]==b'\n';at+=1
        assert at==len(raw)
    verify(':');git('commit','-m',message);head=git('rev-parse','HEAD').decode().strip();verify(head+':');git('push','origin','HEAD:audit/release-eb6de2e8')
    assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
    return {'audit':head,'rawGitOidShaLengthFilesVerified':len(paths),'publication':(d/'publication-index.json').relative_to(W).as_posix()}
