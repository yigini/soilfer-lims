"""Fresh read-only Apache capture and deterministic held-byte construction.

This component has no CLI or import I/O. The complete capture launcher, fresh
host inventory/scientific capture and filesystem closure are still required.
Historical Apache files are never operational inputs. A fresh original must
match the entire explicitly supported directive profile before any held bytes
are produced. Rendering is not an Apache syntax or serving test.
"""
import base64
import datetime
import os
import pathlib
import stat
from kit_contract import HEAD,canonical,require,sha
from kit_emergency_ingress import CONF,attributes
from kit_frozen import source_review

CAPTURE_ROOT='/opt/lims/releases/workflow-batch-review-capture-be837974-20261016T170000Z'
LIMIT=1024**2
PROFILE=(
    '<VirtualHost 46.19.33.37:80>',
    'ServerName lims.yigini.net',
    'ServerAlias www.lims.yigini.net',
    'Redirect permanent / https://lims.yigini.net/',
    'ErrorLog /var/log/httpd/domains/lims.error.log',
    'CustomLog /var/log/httpd/domains/lims.access.log combined',
    '</VirtualHost>',
    '<VirtualHost 46.19.33.37:443>',
    'ServerName lims.yigini.net',
    'ServerAlias www.lims.yigini.net',
    'SSLEngine on',
    'SSLCertificateFile /etc/letsencrypt/live/lims.yigini.net/fullchain.pem',
    'SSLCertificateKeyFile /etc/letsencrypt/live/lims.yigini.net/privkey.pem',
    'ProxyPreserveHost On',
    'ProxyRequests Off',
    'ProxyPass /ws ws://127.0.0.1:3000/ws retry=0 keepalive=On',
    'ProxyPassReverse /ws ws://127.0.0.1:3000/ws',
    'ProxyPass / http://127.0.0.1:3000/ retry=0 keepalive=On timeout=60',
    'ProxyPassReverse / http://127.0.0.1:3000/',
    'ErrorLog /var/log/httpd/domains/lims.error.log',
    'CustomLog /var/log/httpd/domains/lims.access.log combined',
    '</VirtualHost>',
)
HOLD=('RewriteEngine On','RewriteRule .* - [R=503,L]')


def render_held(original):
    require(isinstance(original,bytes) and 0<len(original)<=LIMIT,'Complete bounded Apache original required')
    text=original.decode('utf-8',errors='strict')
    require('\x00' not in text and all(ord(c)>=32 or c in '\r\n\t' for c in text),
        'Apache control bytes refused')
    newline=b'\r\n' if b'\r\n' in original else b'\n'
    require(b'\r' not in original.replace(b'\r\n',b'') and
        (newline==b'\n' or b'\n' not in original.replace(b'\r\n',b'')),
        'Mixed/ambiguous Apache line endings refused')
    lines=original.splitlines(keepends=True);active=[];insert=None
    for i,line in enumerate(lines):
        value=line.decode('utf-8').strip()
        if not value or value.startswith('#'):continue
        # No continuation, quoting, variables, includes, nested blocks, error
        # documents or pre-existing rewrite rules are accepted by this profile.
        value=' '.join(value.split())
        active.append(value)
        if value=='ProxyPreserveHost On':insert=i
    require(tuple(active)==PROFILE and insert is not None,'Fresh Apache directives differ from the complete reviewed profile')
    block=b'    '+HOLD[0].encode()+newline+b'    '+HOLD[1].encode()+newline+newline
    held=b''.join(lines[:insert])+block+b''.join(lines[insert:])
    require(held!=original and len(held)<=LIMIT,'Held Apache bytes exceed the existing1MiB bound')
    return held,{'profileSha256':sha(canonical(PROFILE)),'insertedDirectiveCount':2,
        'insertionByteOffset':sum(len(line) for line in lines[:insert]),
        'originalBytesPreservedVerbatim':True,'httpsStatus':503,
        'httpRedirectPreserved':True,'syntaxOrServingTestClaimed':False}


def metadata(value):
    return {name:getattr(value,name) for name in ('st_dev','st_ino','st_size','st_mode','st_nlink',
        'st_uid','st_gid','st_mtime_ns','st_ctime_ns')} | {'allocatedBytes':getattr(value,'st_blocks',0)*512}


def read_apache(path=CONF,production=True):
    path=pathlib.Path(path)
    require(path.is_absolute() and (not production or path.as_posix()==CONF and os.name=='posix'),
        'Exact Linux Apache capture path required')
    for part in (path,*path.parents):require(not part.is_symlink(),'Apache capture path alias refused')
    before=path.stat()
    require(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and 0<before.st_size<=LIMIT,
        'One independent bounded Apache configuration required')
    extended=attributes(path,production)
    fd=os.open(str(path),os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
    try:
        require(metadata(os.fstat(fd))==metadata(before),'Apache replaced before capture open')
        with os.fdopen(fd,'rb',closefd=False) as stream:original=stream.read(LIMIT+1)
        opened_after=os.fstat(fd)
    finally:os.close(fd)
    after=path.stat();extended_after=attributes(path,production)
    require(metadata(before)==metadata(opened_after)==metadata(after) and extended==extended_after and
        len(original)==before.st_size and len(original)<=LIMIT,'Apache bytes/identity/mode/owner/xattrs changed during capture')
    held,rendering=render_held(original)
    encoded={name:base64.b64encode(value).decode('ascii') for name,value in sorted(extended.items())}
    return original,held,{'path':path.as_posix(),'before':metadata(before),'after':metadata(after),
        'extendedAttributesBase64':encoded,'extendedAttributesSha256':sha(canonical(encoded)),
        'originalSha256':sha(original),'heldSha256':sha(held),'rendering':rendering,
        'sourceWrites':0,'certificateOrPrivateKeyFilesOpened':0,'configurationInstalled':False,
        'metadataCaptureNotGlobalFilesystemClosure':True}


def capture_apache(root,index,review,production=True,source=CONF):
    from kit_package import write_new_file
    # The exact new source verdict is mandatory BEFORE any Apache read or write.
    binding=source_review(review,index)
    root=pathlib.Path(root)
    require(not production or root.as_posix()==CAPTURE_ROOT,'Apache capture cannot consume the release root')
    require(root.is_absolute() and root.is_dir() and not root.is_symlink(),'Existing independent capture root required')
    names=('ingress-original.conf','ingress-held.conf','apache-capture.json')
    intent='apache-capture-intent.json'
    require(all(not (root/name).exists() and not (root/name).is_symlink() for name in (*names,intent)),
        'Apache capture output already consumed; never retry')
    for part in (root,*root.parents):require(not part.is_symlink(),'Apache capture output ancestor alias refused')
    write_new_file(root,intent,canonical({'sourceReviewId':review['id'],'sourceBinding':binding,
        'source':str(source),'neverRetry':True,'configurationWillNotBeInstalled':True})+b'\n',production)
    original,held,value=read_apache(source,production)
    value.update(head=HEAD,captureSourceReviewId=review['id'],sourceBinding=binding,
        capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),neverRetry=True)
    raws=(original,held,canonical(value)+b'\n')
    # Fixed pre-admitted source envelope, separate from the future release4GiB.
    # The capture launcher must reserve this allocation before creating its root.
    require(sum(((len(raw)+4095)//4096)*4096+4096 for raw in raws)<=8*1024**2,
        'Apache capture exceeds its fixed8MiB file/entry allowance')
    return {name:write_new_file(root,name,raw,production) for name,raw in zip(names,raws)}


def verify_apache_capture(value,original,held,index,review):
    """Exact package boundary; a renderer result alone is never host evidence."""
    from kit_provider import timestamp
    binding=source_review(review,index)
    require(isinstance(value,dict) and value.get('path')==CONF and value.get('head')==HEAD and
        value.get('captureSourceReviewId')==review['id'] and value.get('sourceBinding')==binding and
        timestamp(value.get('capturedAt'))>=timestamp(review['created_at']) and value.get('neverRetry') is True,
        'Fresh Apache capture must follow this exact actual source PASS')
    before=value.get('before');after=value.get('after')
    keys={'st_dev','st_ino','st_size','st_mode','st_nlink','st_uid','st_gid','st_mtime_ns','st_ctime_ns','allocatedBytes'}
    require(isinstance(before,dict) and set(before)==keys and before==after and
        all(type(n) is int and n>=0 for n in before.values()) and before['st_ino']>0 and before['st_nlink']==1 and
        stat.S_ISREG(before['st_mode']) and before['st_size']==len(original),
        'Complete stable Apache file identity/mode/owner/allocation required')
    extended=value.get('extendedAttributesBase64')
    require(isinstance(extended,dict) and len(extended)<=256,'Complete bounded Apache attribute map required')
    decoded={}
    for name,raw in extended.items():
        require(isinstance(name,str) and name and '\x00' not in name and isinstance(raw,str),'Malformed Apache attribute')
        decoded[name]=base64.b64decode(raw,validate=True)
    require(sum(len(name.encode())+len(raw) for name,raw in decoded.items())<=LIMIT and
        value.get('extendedAttributesSha256')==sha(canonical(extended)),'Apache attribute hash/bound differs')
    expected,rendering=render_held(original)
    require(held==expected and value.get('originalSha256')==sha(original) and value.get('heldSha256')==sha(held) and
        value.get('rendering')==rendering and
        all(type(value.get(name)) is int and value[name]==0 for name in ('sourceWrites','certificateOrPrivateKeyFilesOpened')) and
        value.get('configurationInstalled') is False and value.get('metadataCaptureNotGlobalFilesystemClosure') is True,
        'Apache original/held construction or read-only capture predicates differ')
    return value
