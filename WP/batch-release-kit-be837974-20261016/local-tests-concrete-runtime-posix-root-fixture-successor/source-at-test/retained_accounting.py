"""Unchanged accepted overlay-view predicate; no accounting operation on import."""
import pathlib,re
from kit_contract import require,sha

def mount_guard(text,paths,known_container_ids=()):
    require(text.strip() and len(text.encode())<2*1024**2,'Bounded full mount inventory required')
    known=set(known_container_ids);paths=tuple(paths);views=[];seen=set()
    for line in text.splitlines():
        fields=line.split();require(len(fields)>=10 and '-' in fields,'Mount inventory malformed')
        unescape=lambda v:re.sub(r'\\([0-7]{3})',lambda x:chr(int(x[1],8)),v)
        m=pathlib.PurePosixPath(unescape(fields[4]));separator=fields.index('-')
        require(len(fields)>separator+3,'Mount inventory suffix malformed')
        for r in paths:
            if pathlib.PurePosixPath(r) not in m.parents:continue
            match=re.fullmatch('/var/lib/docker/rootfs/overlayfs/([a-f0-9]{64})',str(m))
            require(r=='/var/lib/docker' and match and match[1] in known and fields[3]=='/' and fields[separator+1:separator+3]==['overlay','overlay'],'Unknown descendant mount makes accounting incomplete')
            require(str(m) not in seen,'Duplicate overlay view mount refused');seen.add(str(m))
            options={};flags=[]
            for item in unescape(fields[separator+3]).split(','):
                if '=' in item:
                    k,v=item.split('=',1);require(k not in options,'Duplicate overlay option');options[k]=v
                else:flags.append(item)
            require(set(options)=={'lowerdir','upperdir','workdir'} and flags==['rw'],'Unknown overlay backing/options refused')
            raw_lower=options['lowerdir'].split(':');upper=options['upperdir'];work=options['workdir']
            # containerd compactLowerdirOption uses snapshot-root as mount cwd.
            # Accept only its complete numeric relative form, never generic paths.
            base='/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/'
            relative=all(re.fullmatch('[1-9][0-9]*/fs',p) for p in raw_lower)
            lower=[base+p for p in raw_lower] if relative else raw_lower
            require(lower and len(lower)==len(set(lower)) and all(re.fullmatch('/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/[1-9][0-9]*/fs',p) for p in lower+[upper]),'Overlay data must be backed ONLY by the counted containerd store')
            require(re.fullmatch('/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/[1-9][0-9]*/work',work) and pathlib.PurePosixPath(upper).parent==pathlib.PurePosixPath(work).parent and upper not in lower,'Overlay upper/work ownership differs')
            views.append({'containerId':match[1],'view':str(m),'mountDevice':fields[2],'lowerdirs':lower,'lowerdirEncoding':'CONTAINERD_COMPACT_NUMERIC_RELATIVE' if relative else 'ABSOLUTE_CANONICAL','lowerdirBase':base if relative else None,'upperdir':upper,'workdir':work,'rawLineSha256':sha(line.encode()),'accounting':'VIRTUAL_VIEW_EXCLUDED_BY_DU_X_BACKING_COUNTED_UNDER_CONTAINERD'})
    return views
