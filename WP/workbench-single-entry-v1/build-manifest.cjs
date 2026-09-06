'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname,files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const abs=path.join(dir,item.name);if(item.isDirectory())walk(abs);else if(item.name!=='package-manifest.json'){const data=fs.readFileSync(abs);files.push({path:path.relative(base,abs).replaceAll('\\','/'),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});}}}
walk(base);files.sort((a,b)=>a.path.localeCompare(b.path));
fs.writeFileSync(path.join(base,'package-manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),kind:'planning-audit-and-synthetic-prototype',applicationSourceChanged:false,productionWrites:false,files},null,2)+'\n');
console.log(`${files.length} handoff files indexed; ${files.reduce((s,f)=>s+f.bytes,0)} bytes.`);
