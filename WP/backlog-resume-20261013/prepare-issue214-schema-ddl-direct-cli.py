"""Use the installed Prisma CLI directly; prior zero-output npm wrapper is retained."""
import datetime,json,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
dest=Path(__file__).resolve().parent/'issue214-schema-ddl-direct-cli'
assert not dest.exists()
dest.mkdir()
for name,args in [('validate',['validate']),('diff',['migrate','diff','--from-empty','--to-schema','prisma/schema.prisma','--script'])]:
    result=subprocess.run(['node','node_modules/prisma/build/index.js',*args],cwd=root/'server',capture_output=True)
    (dest/(name+'.stdout')).write_bytes(result.stdout);(dest/(name+'.stderr')).write_bytes(result.stderr);(dest/(name+'.exit')).write_text(str(result.returncode)+'\n')
    assert result.returncode==0 and result.stdout,(name,result.stderr[-2000:])
sql=(dest/'diff.stdout').read_text(encoding='utf-8')
names=['ControlLimitProposal','ControlLimitSet','QcReviewObligation','QcReviewResolution']
tables=[re.search(r'CREATE TABLE "'+name+r'"[\s\S]*?\n\);',sql).group() for name in names]
indexes=[m.group() for m in re.finditer(r'CREATE (?:UNIQUE )?INDEX "[^"]+" ON "(?:'+ '|'.join(names)+r')"[^;]+;',sql)]
(dest/'schema-only.sql').write_bytes(('\n\n'.join(tables+indexes)+'\n').encode())
print(json.dumps(dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),schemaValid=True,tables=names,indexCount=len(indexes),databaseConnections=0,productionOperations=0),indent=2))
