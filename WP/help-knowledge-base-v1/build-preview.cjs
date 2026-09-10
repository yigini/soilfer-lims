// Build only the isolated design/content package. Never executes LIMS or sends requests.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(__dirname, p), 'utf8');
const write = (p, v) => fs.writeFileSync(path.join(__dirname, p), v);
const json = (p, v) => write(p, JSON.stringify(v, null, 2) + '\n');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const data = JSON.parse(read('content.en.json'));
const copy = JSON.parse(read('ui-copy.json'));
const locales = ['en','es','es-419','fr','pt'];
const ids = new Set(data.articles.map(a => a.id));
if(ids.size !== data.articles.length)throw Error('Duplicate article ID');
for(const a of data.articles){
 for(const r of a.related)if(!ids.has(r))throw Error('Unknown related article '+r);
 if(!data.categories.some(c => c.id === a.category))throw Error('Unknown category');
 for(const k of ['title','summary','steps','success','caution','reviewOwner'])if(!a[k]?.length)throw Error('Incomplete '+a.id+': '+k);
}
const flatten = (x, p='') => Object.entries(x).flatMap(([k,v]) => typeof v==='object'?flatten(v,p+k+'.'):[p+k]).sort();
for(const locale of locales)if(JSON.stringify(flatten(copy[locale]))!==JSON.stringify(flatten(copy.en)))throw Error('UI locale key mismatch '+locale);
const core = {
 '/login':['start-shift','manage-support'], '/':['start-shift','bench-blocked','review-results'],
 '/samples':['intake-identity','start-shift'], '/samples/:id':['bench-save-submit','review-results','review-amend'],
 '/scan':['intake-identity','offline-prepare'], '/samples/:id/map':['bench-blocked','bench-drying','bench-preparation'],
 '/workflow-map':['bench-blocked','bench-drying','bench-preparation'], '/my-work':['bench-run','bench-save-submit'],
 '/workbench':['bench-blocked','bench-run','bench-save-submit','bench-spectra'], '/manager-queue':['review-results','review-returned','review-report'],
 '/reception':['intake-project','intake-location','intake-identity'], '/inventory':['assets-stock'], '/equipment':['assets-instrument'],
 '/users':['manage-support','start-shift'], '/projects':['connect-kobo','intake-project','connect-sis'],
 '/admin':['manage-catalogue','manage-language'], '/admin/methods':['manage-catalogue'], '/lab-methods':['manage-catalogue'],
 '/admin/audit':['review-amend','review-results'], '/admin/labs':['manage-support','manage-language'],
 '/admin/legacy-import':['intake-identity','manage-support'], '/datasheet':['review-results','review-report'],
 '/maps':['intake-location','connect-kobo'], '/qa':['review-results','assets-instrument'],
 '/spectral-library':['connect-library','bench-spectra'], '/spectral':['connect-library','bench-spectra'],
 '/data-results':['review-results','review-report','bench-texture'], '/result-reports':['review-report','connect-sis'],
 '/reports':['review-report'], '/report/:token':['review-report','manage-support'], '/profile':['manage-language','offline-prepare'],
 '/about':['manage-support'], '/techstack':['manage-support'], '/tech-stack':['manage-support'], '/credits':['manage-support'],
 '/help':['start-shift','manage-support'], '/help/faq':['start-shift','manage-support'], '/faq':['start-shift','manage-support'],
 '/help/articles/:articleId':['start-shift','manage-support'], '/help/topics/:topicId':['start-shift','manage-support'],
 '/admin/help':['manage-catalogue','manage-language'],
 '*':['manage-load-error','manage-support']
};
const code = fs.readFileSync(path.join(root,'client/src/App.jsx'),'utf8');
const routes = [...code.matchAll(/<Route path="([^"]+)"[^\n]*/g)].map(m => {
 const route=m[1],line=m[0];if(!core[route])throw Error('Unmapped route '+route);
 return {route,articleIds:core[route],auth:line.includes('<RequireAuth')?'authenticated':route==='/reports'?'redirect-to-authenticated':'public-or-error',currentPermission:line.match(/permission="([^"]+)"/)?.[1]||null,currentRole:line.match(/requiredRole="([^"]+)"/)?.[1]||null,
 publicationRule:line.includes('<RequireAuth')?'Approved audience/lab/release-filtered revision only':'Explicitly public approved excerpt only; referenced full articles remain restricted unless separately approved as public'};
});
const blockers={UNASSIGNED_TO_USER:'bench-blocked',ITEM_SEALED:'review-amend',SAMPLE_NOT_FOUND:'intake-identity',SAMPLE_ON_HOLD:'bench-blocked',SAMPLE_REJECTED:'bench-blocked',SAMPLE_NOT_ACCEPTED:'intake-project',SAMPLE_STATUS_INELIGIBLE:'bench-blocked',DRYING_FAILED:'bench-drying',DRYING_PREREQUISITE_BLOCKED:'bench-drying',PREPARATION_PREREQUISITE_BLOCKED:'bench-preparation',INSTRUMENT_REQUIRED:'assets-instrument',INSTRUMENT_NOT_ELIGIBLE:'assets-instrument',INSTRUMENT_OUT_OF_SERVICE:'assets-instrument',INSTRUMENT_CALIBRATION_OVERDUE:'assets-instrument',INSTRUMENT_CALIBRATION_DUE_SOON:'assets-instrument'};
const readiness=fs.readFileSync(path.join(root,'server/services/workbenchReadinessService.js'),'utf8');
const actualCodes=[...new Set([...readiness.matchAll(/(?:blockers|warnings)\.push\('([^']+)'\)/g)].map(m=>m[1]))];
for(const c of actualCodes)if(!blockers[c])throw Error('Unmapped readiness code '+c);
json('route-help-map.json',{status:'PROPOSED_REGISTRY_NOT_RUNTIME_AUTHORITY',source:'client/src/App.jsx',routeCount:routes.length,routes,blockers,unknownCodeArticle:'bench-blocked',notes:['Never derive readiness or permissions from help metadata. Use server decisions.','Roles in content.en.json are editorial audiences, not authorization grants.','Match routes using the router, most specific first. Discard query tokens and sample identifiers from help analytics.','Inspect nested tabs, panels and controls in addition to these route declarations.','Some admin subjects use generic help for now; see launch backlog for task-specific pages.']});
json('translation-review-matrix.json',{status:'ALL_CONTENT_UNAPPROVED',locales,articles:data.articles.map(a=>({id:a.id,title:a.title,sourceHash:sha(JSON.stringify(a)),proposedReviewOwner:a.reviewOwner,behaviorVerified:false,scientificReviewApproved:false,locales:Object.fromEntries(locales.map(l=>[l,{status:l==='en'?'EDITORIAL_DRAFT':'TRANSLATION_REQUIRED',approvedRevision:null,reviewedBy:null}]))}))});
write('COPY_DECK.md','# SoilFER help: English editorial drafts\n\nThese '+data.articles.length+' drafts are not approved or published. Verify against the implemented release and controlled laboratory SOPs. Translate and review all five launch languages; see translation-review-matrix.json.\n\n'+data.categories.map(c=>'## '+c.title+'\n\n'+data.articles.filter(a=>a.category===c.id).map(a=>'### '+a.title+'\n\n`'+a.id+'` · '+a.kind+' · '+a.minutes+' min · Proposed reviewer: '+a.reviewOwner+'\n\n'+a.summary+'\n\n'+a.steps.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n\n**Success:** '+a.success+'\n\n**Keep in mind:** '+a.caution+'\n\nRelated: '+a.related.join(', ')+'\n').join('\n')).join('\n'));
const sourcePaths=['client/src/App.jsx','client/src/components/Header.jsx','client/src/components/mobile/MobileHeader.jsx','client/src/components/common/InfoTooltip.jsx','server/services/workbenchReadinessService.js','server/services/sampleWorkspaceService.js','docs/book/src/usage/sample-workflow.md','docs/book/src/usage/spectral.md'];
json('source-baseline.json',{capturedAt:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),routeCount:routes.length,readinessCodeCount:actualCodes.length,sources:sourcePaths.map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(root,p)))})),scope:'Read-only local source audit; no authenticated live verification in this package'});
const React=require(path.join(root,'client/node_modules/react'));
const {renderToStaticMarkup}=require(path.join(root,'client/node_modules/react-dom/server'));
const icons=require(path.join(root,'client/node_modules/lucide-react'));
const safeJSON=x=>JSON.stringify(x).replace(/</g,'\\u003c');
const logo=fs.readFileSync(path.join(root,'client/public/assets/img/logo-dark.png')).toString('base64');
const fragment=read('help.template.html').replace('__HELP_DATA__',safeJSON(data)).replace('__HELP_COPY__',safeJSON(copy)).replace('__SOILFER_LOGO__','data:image/png;base64,'+logo);
if(/__[A-Z_]+__/.test(fragment))throw Error('Unfilled template slot');
if(Buffer.byteLength(fragment)>1000000)throw Error('Fragment too large');
const names=new Set([...fragment.matchAll(/(?:I\('([^']+)'\)|data-lucide="([a-z0-9-]+)")/g)].map(m=>m[1]||m[2]).concat(data.categories.map(c=>c.icon)));
const markup={},aliases={'circle-help':'HelpCircle','file-pen-line':'FileEdit','cloud-download':'DownloadCloud'};
for(const name of names){const component=icons[name.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('')]||icons[aliases[name]];if(!component)throw Error('Unknown icon '+name);markup[name]=renderToStaticMarkup(React.createElement(component,{'aria-hidden':true,width:18,height:18}));}
const localIcons='<script>globalThis.lucide={createIcons(){const icons='+safeJSON(markup)+';document.querySelectorAll("i[data-lucide]").forEach(el=>{if(icons[el.dataset.lucide])el.outerHTML=icons[el.dataset.lucide]})}};</script>';
// Single standalone review bar. The inline preview uses the host-provided controls instead.
const tweakShim=`<script>globalThis.Tweak=class{constructor({onChange}){this.change=onChange;}addSelect(o,k,{label,options}){const l=document.createElement('label');l.textContent=label;const s=document.createElement('select');s.dataset.prop=k;options.forEach(x=>{const a=document.createElement('option');a.value=typeof x==='string'?x:x.value;a.textContent=typeof x==='string'?x:x.label;s.append(a)});s.value=o[k];s.onchange=()=>{o[k]=s.value;this.change()};l.append(s);document.getElementById('preview-options').append(l);}};</script>`;
const standalone='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; base-uri \'none\'; form-action \'none\'"><title>SoilFER Help Centre — design review</title><style>body{margin:0;padding:12px;background:#e9ede7}#preview-options{font:13px system-ui;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:12px;color:#243c32}#preview-options label{display:flex;align-items:center;gap:7px}#preview-options select{max-width:210px;padding:8px;border:1px solid #bcc9be;border-radius:7px;background:white;font:inherit}@media(max-width:430px){body{padding:4px}#preview-options{justify-content:flex-start}#preview-options label{flex-wrap:wrap}}</style></head><body><div id="preview-options" aria-label="Design review controls"></div>'+localIcons+tweakShim+fragment+'</body></html>';
write('help-centre.fragment.html',fragment);write('review-preview.html',standalone);
const out='C:/Users/yigin/.codex/visualizations/2026/09/05/01a0725c-1d6c-73c1-8593-a73f1bd55905/soilfer-help-centre.html';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,fragment);
console.log(JSON.stringify({articles:data.articles.length,categories:data.categories.length,routes:routes.length,readinessCodes:actualCodes.length,locales,bytes:Buffer.byteLength(fragment),inline:out}));
