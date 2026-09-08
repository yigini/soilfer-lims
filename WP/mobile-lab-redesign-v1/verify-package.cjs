const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const dir=__dirname;
const required=['README.md','IMPLEMENTATION_PLAN.md','OFFLINE_SYNC_CONTRACT.md','SCREEN_SPECIFICATIONS.md','ACCEPTANCE_TESTS.md','AUDIT_FINDINGS.md','RESEARCH.md','ANTIGRAVITY_PROMPT.md','ROUTE_COVERAGE.md','source-audit.json','mobile-lab.fragment.html','review-preview.html','prototype-qa.json'];
for(const name of required)assert.ok(fs.existsSync(path.join(dir,name)),name);
const broken=[];
for(const f of fs.readdirSync(dir).filter(n=>n.endsWith('.md'))){
 const text=fs.readFileSync(path.join(dir,f),'utf8');
 for(const m of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
  const target=m[1].split('#')[0];
  if(target&&!/^https?:|^[a-z]:/i.test(target)&&!fs.existsSync(path.resolve(dir,target)))broken.push({file:f,target});
 }
}
assert.deepEqual(broken,[],'Broken document links');
const audit=JSON.parse(fs.readFileSync(path.join(dir,'source-audit.json'),'utf8'));
const coverage=fs.readFileSync(path.join(dir,'ROUTE_COVERAGE.md'),'utf8');
for(const route of audit.routes)assert.ok(coverage.includes('`'+route+'`'),route);
const fragment=fs.readFileSync(path.join(dir,'mobile-lab.fragment.html'),'utf8');
assert.ok(!/<!doctype|<html\b|<head\b|<body\b/i.test(fragment),'Expected fragment');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|new WebSocket/.test(fragment),'No network calls');
const inline='C:/Users/yigin/.codex/visualizations/2026/09/05/01a0725c-1d6c-73c1-8593-a73f1bd55905/mobile-lab-workspace.html';
assert.equal(fragment,fs.readFileSync(inline,'utf8'),'Inline/source match');
const qa=JSON.parse(fs.readFileSync(path.join(dir,'prototype-qa.json'),'utf8'));
assert.equal(qa.errors.length,0);assert.ok(qa.checks.every(x=>x.passed));
const images=qa.screenshots.map(name=>{const b=fs.readFileSync(path.join(dir,name));assert.equal(b.toString('ascii',1,4),'PNG');return {file:name,width:b.readUInt32BE(16),height:b.readUInt32BE(20)}});
const files=fs.readdirSync(dir).filter(f=>f!=='package-manifest.json'&&fs.statSync(path.join(dir,f)).isFile()).map(name=>{const b=fs.readFileSync(path.join(dir,name));return {file:name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}});
fs.writeFileSync(path.join(dir,'package-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),scope:'Planning and isolated prototype only',sourceAuditRevision:audit.summary.revision,routes:35,prototypeChecks:qa.checks.length,layoutCases:qa.layouts.length,images,files},null,2));
console.log(JSON.stringify({files:files.length,routes:audit.routes.length,prototypeChecks:qa.checks.length,layoutCases:qa.layouts.length,screenshots:images.length,brokenLinks:broken.length}));
