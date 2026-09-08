// Read-only source and public translation audit. Writes only this review package.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const parser=require('../../client/node_modules/@babel/parser');
const root=path.resolve(__dirname,'../..');
const locales=['en','es','es-419','fr','pt'];
const rel=p=>path.relative(root,p).replaceAll('\\','/');
const read=p=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'');
const save=(name,data)=>fs.writeFileSync(path.join(__dirname,name),JSON.stringify(data,null,2)+'\n');
const flatten=(o,p='',out={})=>{Object.entries(o||{}).forEach(([k,v])=>{const key=p?`${p}.${k}`:k;if(v&&typeof v==='object'&&!Array.isArray(v))flatten(v,key,out);else out[key]=v});return out};
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(['node_modules','.git','dist','tests','__tests__','coverage'].includes(e.name)?[]:files(path.join(dir,e.name))):[path.join(dir,e.name)]);
const packs=Object.fromEntries(locales.map(l=>[l,flatten(JSON.parse(read(path.join(root,'client/src/translations',l+'.json'))))]));
const keys=Object.keys(packs.en),duplicates=[];
for(const locale of locales){const ast=parser.parseExpression(read(path.join(root,'client/src/translations',locale+'.json')));function scan(n,p=''){if(n.type!=='ObjectExpression')return;const seen=new Set();for(const x of n.properties){const k=x.key?.value||x.key?.name;if(seen.has(k))duplicates.push({locale,path:p?p+'.'+k:k,line:x.loc.start.line});seen.add(k);scan(x.value,p?p+'.'+k:k)}}scan(ast)}
const params=s=>[...String(s).matchAll(/{{\s*(\w+)\s*}}/g)].map(m=>m[1]).sort();
const stats=locales.map(locale=>{const p=packs[locale],present=keys.filter(k=>typeof p[k]==='string'&&p[k].trim());return{locale,keys:Object.keys(p).length,referenceKeys:keys.length,missing:keys.filter(k=>!(k in p)),empty:keys.filter(k=>k in p&&!String(p[k]??'').trim()),sameAsEnglish:locale==='en'?[]:present.filter(k=>p[k]===packs.en[k]),extra:Object.keys(p).filter(k=>!(k in packs.en)),placeholderMismatch:present.filter(k=>JSON.stringify(params(p[k]))!==JSON.stringify(params(packs.en[k])))}});
const occurrences=[],calls=[],dynamicCalls=[],parseErrors=[],sourceFiles=[];
const displayFields=new Set(['label','title','subtitle','description','message','error','hint','placeholder','emptyMessage','helpText','tooltip','action','note','reason','name']);
const meaningful=s=>typeof s==='string'&&/[A-Za-z]{2}/.test(s)&&s.trim().length>2&&!/^(https?:|[./]?[\w/.-]+\.(png|svg|css|js|json))/.test(s);
function visit(n,fn,anc=[]){if(!n||typeof n!=='object')return;if(n.type)fn(n,anc);for(const [k,v]of Object.entries(n)){if(['loc','start','end','extra','comments','tokens','leadingComments','trailingComments','innerComments'].includes(k))continue;if(Array.isArray(v))v.forEach(x=>visit(x,fn,[...anc,n]));else if(v&&typeof v==='object')visit(v,fn,[...anc,n])}}
const candidates=[...files(path.join(root,'client/src')),...files(path.join(root,'server/controllers')),...files(path.join(root,'server/services')),...files(path.join(root,'server/middleware')),...files(path.join(root,'server/i18n')),...files(path.join(root,'client/public')).filter(p=>/tutorial|tour|help/i.test(p))].filter(p=>/\.(jsx?|tsx?)$/.test(p));
for(const p of candidates){const src=read(p);let ast;try{ast=parser.parse(src,{sourceType:'unambiguous',plugins:['jsx','typescript'],errorRecovery:true})}catch(e){parseErrors.push({file:rel(p),error:e.message});continue}sourceFiles.push(rel(p));if(ast.errors?.length)ast.errors.forEach(e=>parseErrors.push({file:rel(p),error:e.message}));
 function add(n,kind,value){if(meaningful(value))occurrences.push({file:rel(p),line:n.loc.start.line,kind,text:value.replace(/\s+/g,' ').trim()})}
 visit(ast,(n,anc)=>{const parent=anc.at(-1);
  if(n.type==='CallExpression'&&(n.callee?.name==='t'||n.callee?.property?.name==='t')){if(n.arguments[0]?.type==='StringLiteral')calls.push({file:rel(p),line:n.loc.start.line,key:n.arguments[0].value});else dynamicCalls.push({file:rel(p),line:n.loc.start.line,expression:src.slice(n.start,n.end).slice(0,170)})}
  if(n.type==='JSXText')add(n,'jsx-text',n.value);
  if(n.type==='JSXAttribute'&&['title','placeholder','aria-label','alt'].includes(n.name?.name)&&n.value?.type==='StringLiteral')add(n,'jsx-attribute',n.value.value);
  if(n.type==='StringLiteral'&&parent?.type==='JSXExpressionContainer')add(n,'jsx-expression',n.value);
  if(n.type==='ObjectProperty'&&displayFields.has(n.key?.name||n.key?.value)&&n.value?.type==='StringLiteral')add(n,'display-property-candidate',n.value.value);
 });
}
const uniqueCalls=[...new Set(calls.map(c=>c.key))];
const byFile=Object.entries(Object.groupBy(occurrences,o=>o.file)).map(([file,rows])=>({file,jsx:rows.filter(x=>x.kind.startsWith('jsx')).length,displayProperties:rows.filter(x=>!x.kind.startsWith('jsx')).length,total:rows.length,examples:rows.slice(0,4).map(x=>({line:x.line,text:x.text}))})).sort((a,b)=>b.total-a.total);
const routeSource=read(path.join(root,'client/src/App.jsx'));
const routes=[...routeSource.matchAll(/<Route\s+path="([^"]+)"/g)].map(m=>m[1]);
const catalog=JSON.parse(read(path.join(root,'server/seeds/data/catalogue.json')));
const fieldRows=[];
const push=(kind,id,field,value,extra={})=>{if(value&&typeof value==='string')fieldRows.push({entityKind:kind,entityId:id,field,sourceEnglish:value,reviewStatus:'not_reviewed',translations:{en:value,es:null,'es-419':null,fr:null,pt:null},...extra})};
catalog.categories.forEach(c=>push('category',c.id,'name',c.name));
catalog.analyses.forEach(a=>{for(const field of ['name','description'])push('analysis',a.code,field,a[field],{matrix:a.matrix,categoryId:a.categoryId,unitCode:a.unitCode,unitDisplay:a.units});});
catalog.methodologies.forEach(m=>{for(const field of ['name','glosisDefinition'])push('methodology',m.id,field,m[field],{analysisCode:m.analysisCode,standard:m.standard,referenceId:m.referenceId,procedureUri:m.glosisProcedure});});
save('catalogue-translation-review-matrix.json',{source:'Checked-in seed only. Reconcile live catalogue and lab-specific definitions before implementation; no translation is certified.',counts:{analyses:catalog.analyses.length,methodologies:catalog.methodologies.length,categories:catalog.categories.length,translatableFields:fieldRows.length},rows:fieldRows});
save('source-text-inventory.json',{note:'AST candidates, not a percentage of untranslated screens. JSX literals are high-confidence extraction candidates; property candidates require rendering/context review. Excludes dependencies, tests, build output and old WP packages.',sourceFiles,parseErrors,occurrences,byFile,translationCalls:calls,dynamicCalls,routes});
save('locale-pack-audit.json',{note:'Identity with English is a review flag, not proof of error; acronyms and invariant text may correctly match. Coverage against the incomplete English pack cannot establish sitewide coverage.',stats,duplicateProperties:duplicates,referencedKeysAbsentFromEnglish:uniqueCalls.filter(k=>!(k in packs.en)),referencedKeysAbsentByLocale:Object.fromEntries(locales.map(l=>[l,uniqueCalls.filter(k=>!(k in packs[l]))]))});
(async()=>{
 let live={url:'https://lims.yigini.net/api/public/i18n/bootstrap',readAt:new Date().toISOString()};
 try{const res=await fetch(live.url,{signal:AbortSignal.timeout(25000)});const body=await res.text();const p=JSON.parse(body);const en=flatten(p.translations.en);live={...live,status:res.status,bytes:Buffer.byteLength(body),languages:p.languages,brandingDefaultLanguage:p.brandingDefaultLanguage,locales:locales.map(l=>{const f=flatten(p.translations[l]),dynamic=Object.keys(f).filter(k=>k.startsWith('dynamic.analysis.')&&k.endsWith('.name'));return{locale:l,totalKeys:Object.keys(f).length,dynamicAnalysisNames:dynamic.length,dynamicNamesIdenticalToEnglish:l==='en'?null:dynamic.filter(k=>f[k]===en[k]).length,examples:dynamic.slice(0,6).map(k=>({key:k,text:f[k],english:en[k]}))}}),dynamicEntityCounts:Object.fromEntries(['analysis','gate','category','equipmentType','status','methodology'].map(kind=>[kind,Object.keys(en).filter(k=>k.startsWith('dynamic.'+kind+'.')).length]))};
 const liveNames=Object.entries(en).filter(([k])=>/^dynamic\.analysis\..*\.name$/.test(k)).map(([key,name])=>({key,name}));save('live-public-analysis-names.json',{readAt:live.readAt,source:live.url,names:liveNames});
 }catch(e){live.error=e.message}
 save('live-bootstrap-audit.json',live);
 const summary={date:new Date().toISOString(),revision:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'Read-only local source + unauthenticated production translation bootstrap. No authenticated production actions, DB edits, or implementation changes.',locales:stats.map(({missing,empty,sameAsEnglish,extra,placeholderMismatch,...s})=>({...s,missing:missing.length,empty:empty.length,sameAsEnglish:sameAsEnglish.length,extra:extra.length,placeholderMismatch:placeholderMismatch.length})),duplicateProperties:duplicates.length,sourceFiles:sourceFiles.length,parseErrors:parseErrors.length,candidates:occurrences.length,jsxCandidates:occurrences.filter(o=>o.kind.startsWith('jsx')).length,candidateFiles:byFile.length,staticTranslationKeysUsed:uniqueCalls.length,usedKeysMissingEnglish:uniqueCalls.filter(k=>!(k in packs.en)).length,dynamicTranslationCalls:dynamicCalls.length,routes:routes.length,catalogue:{analyses:catalog.analyses.length,methods:catalog.methodologies.length,categories:catalog.categories.length,translatableFields:fieldRows.length},topCandidateFiles:byFile.slice(0,18),live:live.error?live.error:{languages:live.languages,locales:live.locales.map(({examples,...x})=>x)}};
 save('audit-summary.json',summary);console.log(JSON.stringify(summary,null,2));
})();
