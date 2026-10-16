"""503 rehold independent of evidence/reserve/memory availability.

Only separately reviewed original/held bytes may replace the live Apache
configuration. Mode, ownership and every extended attribute (including Linux
ACL/SELinux metadata) are copied and verified. Failed evidence writes cannot
suppress the following exact-owner stop attempts by the coordinator/hook.
"""
import os
import pathlib
import stat
from kit_contract import require,sha

CONF='/etc/httpd/conf/extra/httpd-lims.conf'
BASE='https://lims.yigini.net'


def attributes(path,production=True):
    if os.name!='posix':
        require(not production,'Linux Apache attribute preservation required');return {}
    names=os.listxattr(path,follow_symlinks=False)
    require(len(names)<=256,'Bounded complete Apache extended attributes required')
    rows={name:os.getxattr(path,name,follow_symlinks=False) for name in names}
    require(sum(len(name.encode())+len(value) for name,value in rows.items())<=1024**2,
        'Apache extended attributes exceed complete bound')
    return rows


def atomic_config(target,original,held,desired,pending,production=True):
    target=pathlib.Path(target);pending=pathlib.Path(pending)
    require(target.is_file() and target.is_absolute() and pending.parent==target.parent,
        'Exact existing Apache file and same-directory atomic install required')
    for ancestor in (target,*target.parents):require(not ancestor.is_symlink(),'Apache file alias refused')
    current=target.read_bytes();require(current in (original,held) and desired in (original,held),
        'Only exact reviewed Apache original/held byte streams allowed')
    before=target.stat();extended=attributes(target,production)
    if current!=desired:
        descriptor=os.open(str(pending),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
        try:
            with os.fdopen(descriptor,'wb',closefd=False) as stream:stream.write(desired);stream.flush();os.fsync(stream.fileno())
            if os.name=='posix':os.fchown(descriptor,before.st_uid,before.st_gid)
            os.fchmod(descriptor,stat.S_IMODE(before.st_mode)) if os.name=='posix' else os.chmod(pending,stat.S_IMODE(before.st_mode))
            for name,value in extended.items():os.setxattr(descriptor,name,value)
            os.fsync(descriptor)
        finally:os.close(descriptor)
        require(target.stat().st_ino==before.st_ino and target.read_bytes()==current and attributes(target,production)==extended,
            'Apache original changed during atomic preparation')
        os.replace(pending,target)
        if os.name=='posix':
            descriptor=os.open(str(target.parent),os.O_RDONLY|getattr(os,'O_DIRECTORY',0))
            try:os.fsync(descriptor)
            finally:os.close(descriptor)
        else:require(not production,'Linux directory fsync required for production Apache install')
    after=target.stat()
    require(target.read_bytes()==desired and stat.S_IMODE(after.st_mode)==stat.S_IMODE(before.st_mode) and
        (os.name!='posix' or (after.st_uid,after.st_gid)==(before.st_uid,before.st_gid)) and
        attributes(target,production)==extended,'Apache bytes/owner/mode/extended attributes changed')
    return {'configurationSha256':sha(desired),'originalModeOwnerAndExtendedAttributesPreserved':True}


class EmergencyIngress:
    def __init__(self,root,call,original,held,original_sha,held_sha,namespace='controller',conf=CONF,production=True):
        require(namespace in ('controller','stop-post') and isinstance(original,bytes) and isinstance(held,bytes) and
            original!=held and max(len(original),len(held))<=1024**2 and sha(original)==original_sha and sha(held)==held_sha,
            'Exact independently reviewed503 byte binding required')
        self.root=pathlib.Path(root);self.call=call;self.original=original;self.held=held
        self.namespace=namespace;self.conf=pathlib.Path(conf);self.production=production;self.sequence=0

    def __call__(self):
        self.sequence+=1;name='emergency-ingress-'+self.namespace+'-'+str(self.sequence).zfill(6)
        # No evidence intent write or resource guard occurs before the action.
        # The original gate/quiesce intent already precedes operational use.
        result=atomic_config(self.conf,self.original,self.held,self.held,
            self.conf.parent/(self.conf.name+'.'+self.root.name+'.'+name),self.production)
        self.call(['apachectl','configtest']);self.call(['systemctl','reload','httpd'])
        statuses=[]
        for path in ('/api/health','/login'):
            raw=self.call(['curl','--silent','--show-error','--max-time','15','--proto','=https','--tlsv1.2',
                '--output','/dev/null','--write-out','%{http_code}',BASE+path])
            require(raw==b'503','Independent TLS503 rehold verification refused')
            statuses.append({'path':path,'status':503,'tlsVerified':True})
        require(self.conf.read_bytes()==self.held,'Apache held bytes changed after independent rehold')
        return {**result,'holding503':True,'http':statuses,'newEvidenceRequiredBeforeAction':False}
