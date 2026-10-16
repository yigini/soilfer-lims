"""Pure source derivation for the SAME959d pre-APPLY default restart.

All29 startup script roots and their156 local require dependencies are pinned.
Generated Prisma is the sole enumerated local build boundary. No cache hit is
assumed. No files, Git commands, Docker or production data are opened here.
"""
import hashlib
import posixpath
import re
from kit_contract import canonical,require,sha

HEAD='959d17e11c357266f7c2a41b0c84ab76914c591e'
SCHEMA_BYTES=86118
FIXED_BYTES=((SCHEMA_BYTES+4095)//4096)*4096+2*4096+32*4096
ANCILLARY={'docker-entrypoint.sh','server/index.js','server/prisma/schema.prisma','Dockerfile'}
COPY_PATTERN=r'\b(?:copyFileSync|copyFile|mkdtempSync|mkdtemp|backup)\s*\('


def derive(raws):
    require(isinstance(raws,dict) and ANCILLARY<=set(raws) and len(raws)==160,
        'Exact complete predecessor startup graph required')
    texts={n:b.decode('utf-8','strict') for n,b in raws.items()}
    entry=texts['docker-entrypoint.sh'];index=texts['server/index.js']
    cli=re.findall(r'^\s*node scripts/([A-Za-z0-9_]+\.js)\b',entry,re.M)
    ready=re.findall(r"require\(['\"]\./scripts/([^'\"]+)['\"]\)\.assert[A-Za-z]+StartupReady\(dbPath\)",index)
    require(len(ready)==len(set(ready))==22 and len(cli)==28,'Predecessor CLI/READY graph changed')
    roots={'server/scripts/'+n for n in cli}|{'server/scripts/'+n+'.js' for n in ready}
    require(len(roots)==29,'Predecessor startup script roots changed')
    seen=set();pending=sorted(roots);generated=[];edges={}
    while pending:
        name=pending.pop()
        if name in seen:continue
        require(name in raws,'Missing predecessor startup dependency');seen.add(name)
        if not name.endswith(('.js','.cjs')):continue
        text=texts[name]
        require(not re.search(r'\brequire\s*\(\s*[^\s\'\"]',text),'Dynamic predecessor local dependency refused')
        require(not re.search(COPY_PATTERN,text) and not re.search(r'VACUUM\s+INTO',text,re.I),
            'Unbudgeted predecessor startup database copy producer')
        dependencies=[]
        for item in re.findall(r"\brequire\(['\"]([^'\"]+)['\"]\)",text):
            if not item.startswith('.'):continue
            base=posixpath.normpath(posixpath.join(posixpath.dirname(name),item))
            if base=='server/prisma_client':generated.append([name,base]);continue
            matches=[p for p in (base,base+'.js',base+'.cjs',base+'.json',base+'/index.js') if p in raws]
            require(len(matches)==1,'Missing or ambiguous predecessor local require')
            dependencies.append(matches[0]);pending.append(matches[0])
        edges[name]=sorted(set(dependencies))
    require(seen|ANCILLARY==set(raws) and len(seen)==156,'Expanded or omitted predecessor source graph')
    require(sorted(generated)==[['server/prisma.js','server/prisma_client'],
        ['server/services/resultWriteService.js','server/prisma_client']], 'Generated predecessor dependency boundary changed')
    require('COPY --from=builder /app/server/prisma_client ./server/prisma_client/' in texts['Dockerfile'] and
        'output' in texts['server/prisma/schema.prisma'] and '../prisma_client' in texts['server/prisma/schema.prisma'],
        'Generated predecessor Prisma boundary is not bound to schema/image build')
    require(len(raws['server/prisma/schema.prisma'])==SCHEMA_BYTES and
        entry.count('cp /app/server/.schema-backup/schema.prisma prisma/schema.prisma')==1 and
        'JWT_SECRET' in entry and '.seed_complete' in entry,'Predecessor fixed copy/marker graph changed')
    pins={n:{'sha256':sha(b),'bytes':len(b),
        'gitBlob':hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()} for n,b in sorted(raws.items())}
    return {'version':1,'head':HEAD,'files':pins,'startupRoots':sorted(roots),'localRequireEdges':edges,
        'generatedPrismaEdges':sorted(generated),'readyModules':ready,'entrypointModules':cli,
        'maximumStartupDatabaseCopies':0,'schemaCopyBytes':SCHEMA_BYTES,
        'fixedAllocationBytesIncludingMarkersAndDirectories':FIXED_BYTES,
        'cacheHitAssumed':False,'productionConnections':0,'sourceGraphSha256':sha(canonical(pins))}


def validate(raws,profile):
    require(derive(raws)==profile,'Predecessor copy-source binding differs from exact raw Git')
    return profile
