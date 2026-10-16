"""Hash-exact reviewed Apache configuration transitions and TLS HTTP checks.

The current/original/held bytes must be collected and reviewed before freezing.
This module does not synthesize maintenance rules from a historical release.
"""
import os
import pathlib
import re
import stat
from kit_contract import require,sha
from kit_journal import exclusive_record

CONF=pathlib.Path('/etc/httpd/conf/extra/httpd-lims.conf')
BASE='https://lims.yigini.net'

class Http:
    def __init__(self,root,runner):self.root=pathlib.Path(root);self.runner=runner;self.sequence=0
    def external(self,path,method,want):
        require((path,method,want) in (('/api/health','GET',503),('/login','GET',503),
            ('/api/health','GET',200),('/login','GET',200),('/api/v2/sis/receipts','POST',401)),
            'Only exact reviewed public HTTP checks allowed')
        self.sequence+=1;label='external-http-'+str(self.sequence).zfill(6)
        body=self.root/(label+'.body')
        with body.open('xb'):pass
        try:
            raw,_,metadata=self.runner.run(['curl','--silent','--show-error','--max-time','15',
                '--proto','=https','--tlsv1.2','--max-filesize','4194304','--output',str(body),
                '--write-out','%{http_code}','--request',method,BASE+path],label,20)
        finally:body.chmod(0o400)
        require(body.stat().st_size<=4*1024**2 and raw==str(want).encode(),'TLS HTTP status/body bound refused')
        return {'path':path,'method':method,'status':want,'tlsVerified':True,'command':metadata,
            'responseBody':{'sha256':sha(body.read_bytes()),'bytes':body.stat().st_size,'rawHostOnly':True}}

class Ingress:
    def __init__(self,root,runner,http,original,held,expected_original_sha,expected_held_sha,
                 conf=CONF,require_directory_sync=True):
        require(isinstance(original,bytes) and isinstance(held,bytes) and original!=held and
            sha(original)==expected_original_sha and sha(held)==expected_held_sha,
            'Exact separately reviewed original and503 Apache bytes required')
        require(len(original)<=1024**2 and len(held)<=1024**2,'Apache configuration bound')
        self.root=pathlib.Path(root);self.runner=runner;self.http=http;self.original=original;self.held=held
        self.conf=pathlib.Path(conf);self.sync=require_directory_sync;self.sequence=0

    def transition(self,holding):
        self.sequence+=1;label='ingress-'+str(self.sequence).zfill(6)
        target=self.conf
        require(target.is_file() and target.is_absolute(),'Existing absolute Apache configuration required')
        for ancestor in (target,*target.parents):require(not ancestor.is_symlink(),'Apache configuration alias refused')
        current=target.read_bytes();desired=self.held if holding else self.original
        require(current in (self.original,self.held),'Unreviewed current Apache configuration')
        before=target.stat()
        exclusive_record(self.root,label+'-intent.json',{'holding':holding,'currentSha256':sha(current),
            'desiredSha256':sha(desired),'device':before.st_dev,'inode':before.st_ino,'neverRetry':True},self.sync)
        if current!=desired:
            # A new same-directory file permits atomic replacement of the live
            # configuration. Both prior reviewed byte streams remain frozen in
            # the release root; no retained release evidence is replaced.
            pending=target.parent/(target.name+'.'+label+'.'+self.root.name)
            fd=os.open(str(pending),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),stat.S_IMODE(before.st_mode))
            try:
                with os.fdopen(fd,'wb',closefd=False) as stream:stream.write(desired);stream.flush();os.fsync(stream.fileno())
                if os.name=='posix':os.fchown(fd,before.st_uid,before.st_gid)
            finally:os.close(fd)
            require(target.stat().st_ino==before.st_ino and target.read_bytes()==current,'Apache configuration changed before atomic install')
            os.replace(pending,target)
            if os.name=='posix':
                descriptor=os.open(str(target.parent),os.O_RDONLY|getattr(os,'O_DIRECTORY',0))
                try:os.fsync(descriptor)
                finally:os.close(descriptor)
            else:require(not self.sync,'Linux directory durability required for production Apache transition')
        self.runner.run(['apachectl','configtest'],label+'-configtest',15,allow_stderr=True)
        self.runner.run(['systemctl','reload','httpd'],label+'-reload',15)
        statuses=[self.http.external('/api/health','GET',503 if holding else 200),
                  self.http.external('/login','GET',503 if holding else 200)]
        if not holding:statuses.append(self.http.external('/api/v2/sis/receipts','POST',401))
        require(target.read_bytes()==desired,'Apache bytes changed after verified transition')
        exclusive_record(self.root,label+'-complete.json',{'holding':holding,'configurationSha256':sha(desired),'http':statuses},self.sync)
        return {'holding503':holding,'configurationSha256':sha(desired),'http':statuses}
