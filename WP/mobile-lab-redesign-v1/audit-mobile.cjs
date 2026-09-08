const fs=require('fs'), path=require('path'), crypto=require('crypto'), cp=require('child_process');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const walk=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);
const files=walk('client/src').filter(f=>/\.(jsx?|css)$/.test(f));
const patterns={fixedWidth:/\b(?:min-w|w|max-w)-\[\d+(?:px|rem)\]/,viewportHeight:/h-screen|100vh|100dvh|visualViewport/,tables:/<table|overflow-x-auto|min-w-full/,grid:/\bgrid-cols-[3-9]/,hoverOnly:/onMouseEnter|onMouseOver|group-hover:|hover:.*opacity/,overlay:/fixed.*(?:inset-0|bottom)|role=["']dialog/,storage:/localStorage|sessionStorage|indexedDB/,offline:/navigator\.onLine|offline|serviceWorker|service-worker|workbox|beforeinstallprompt|BackgroundSync/,touch:/touch-action|touchAction|pointer: coarse|safe-area|inputMode|enterKeyHint/};
const candidates=[];
const hashes=[];
for(const file of files){const text=read(file);hashes.push({file,sha256:crypto.createHash('sha256').update(text).digest('hex')});text.split(/\r?\n/).forEach((line,i)=>{for(const[k,re]of Object.entries(patterns))if(re.test(line))candidates.push({file,line:i+1,kind:k,text:line.trim().slice(0,320)});});}
const routes=[...read('client/src/App.jsx').matchAll(/<Route\b[^>]*\bpath=["']([^"']+)["']/g)].map(m=>m[1]);
const publicFiles=walk('client/public');
const manifestFiles=publicFiles.filter(f=>/manifest|service-worker|\bsw\./i.test(f));
const summary={at:new Date().toISOString(),revision:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirtyState:cp.execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}).trim().split('\n'),scope:'Read-only checked-out source. Visual work is concurrently in progress. Candidate counts are review signals, not proven defects. No app files or database records changed by this script.',sourceFiles:files.length,routes:routes.length,candidates:candidates.length,byKind:Object.fromEntries(Object.keys(patterns).map(k=>[k,candidates.filter(c=>c.kind===k).length])),publicManifestOrWorkerCandidates:manifestFiles,htmlManifestLink:/rel=["']manifest/.test(read('client/index.html')),pwaDependency:/workbox|vite-plugin-pwa|capacitor|dexie|idb["']/.test(read('client/package.json'))};
const out=(n,v)=>fs.writeFileSync(path.join(__dirname,n),JSON.stringify(v,null,2)+'\n');
out('source-audit.json',{summary,routes,candidates,hashes});
console.log(JSON.stringify(summary,null,2));
