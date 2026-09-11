'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const f=JSON.parse(fs.readFileSync(path.join(__dirname,'findings.json'),'utf8'));
const p=JSON.parse(fs.readFileSync(path.join(__dirname,'probe-results.json'),'utf8'));
const q=JSON.parse(fs.readFileSync(path.join(__dirname,'preview-qa.json'),'utf8'));
const readme=fs.readFileSync(path.join(__dirname,'README.md'),'utf8');
assert.equal(f.findings.length,29);assert.equal(p.results.length,31);assert.ok(p.results.every(r=>r.reproduced));
assert.equal(q.checks.length,33);assert.deepEqual(q.errors,[]);assert.deepEqual(q.networkRequests,[]);
assert.ok(readme.includes('29 findings'));assert.ok(readme.includes('31 reproducible'));
const checked=new Set();
for(const [file,hash] of Object.entries(p.sourceHashes).concat(f.findings.map(x=>[x.evidence.file,x.evidence.sha256]))){
 const content=fs.readFileSync(path.join(root,file),'utf8');assert.equal(crypto.createHash('sha256').update(content).digest('hex'),hash,'Source changed since audit: '+file);checked.add(file);
}
let links=0;
for(const name of fs.readdirSync(__dirname).filter(n=>n.endsWith('.md'))){
 const content=fs.readFileSync(path.join(__dirname,name),'utf8');
 for(const m of content.matchAll(/\]\(([^)]+)\)/g)){
  const href=m[1];if(/^https?:|^#/.test(href))continue;
  assert.ok(fs.existsSync(path.resolve(__dirname,href.split('#')[0])),'Missing local link '+name+' -> '+href);links++;
 }
}
const result={verifiedAt:new Date().toISOString(),findingCount:f.findings.length,probeChecks:p.results.length,prototypeChecks:q.checks.length,unchangedSourceFiles:checked.size,validLocalMarkdownLinks:links,applicationBuildRun:false,reason:'Only audit/design artifacts changed; implementation and production regression tests remain Antigravity work.'};
fs.writeFileSync(path.join(__dirname,'package-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
