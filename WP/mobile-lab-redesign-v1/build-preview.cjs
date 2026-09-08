// Isolated design preview. Does not execute the application or contact a server.
const fs = require('fs');
const path = require('path');
const React = require('../../client/node_modules/react');
const {renderToStaticMarkup} = require('../../client/node_modules/react-dom/server');
const icons = require('../../client/node_modules/lucide-react');
const fragment = fs.readFileSync(path.join(__dirname, 'mobile-lab.fragment.html'), 'utf8');
const names = [...new Set([...fragment.matchAll(/(?:icon\('([^']+)'\)|data-lucide="([a-z0-9-]+)")/g)].map(m=>m[1]||m[2]))];
names.push('house','clipboard-list','clipboard-check','scan-line','test-tubes','menu','layers','flask-conical','activity','clock-3','git-branch','history','wrench','download','files','package','globe-2','wind','cloud-check','cloud-off');
const aliases={house:'Home','cloud-check':'Cloud'};
const generated={};
for(const name of new Set(names)){
 const c=icons[name.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('')]||icons[aliases[name]];
 if(!c)throw new Error('Unknown icon: '+name);
 generated[name]=renderToStaticMarkup(React.createElement(c,{'aria-hidden':true,width:18,height:18}));
}
const localIcons='<script>globalThis.lucide={createIcons(){const icons='+JSON.stringify(generated)+';document.querySelectorAll("i[data-lucide]").forEach(el=>{if(icons[el.dataset.lucide])el.outerHTML=icons[el.dataset.lucide]})}};</script>';
// A single standalone review control bar substitutes for the conversation host's
// Tweak UI. It is not part of the proposed product or the inline fragment.
const tweakShim=`<script>
globalThis.Tweak=class{
 constructor({onChange}){this.change=onChange;}
 addSelect(o,k,{label,options}){const l=document.createElement('label');l.textContent=label;const s=document.createElement('select');s.dataset.prop=k;options.forEach(x=>{const a=document.createElement('option');a.value=typeof x==='string'?x:x.value;a.textContent=typeof x==='string'?x:x.label;s.append(a)});s.value=o[k];s.onchange=()=>{o[k]=s.value;this.change()};l.append(s);document.getElementById('preview-options').append(l);}
 addToggle(o,k,{label}){const l=document.createElement('label');l.textContent=label;const s=document.createElement('input');s.type='checkbox';s.dataset.prop=k;s.checked=o[k];s.onchange=()=>{o[k]=s.checked;this.change()};l.append(s);document.getElementById('preview-options').append(l);}
};</script>`;
const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; base-uri \'none\'; form-action \'none\'"><title>SoilFER mobile laboratory — design review</title><style>body{margin:0;padding:12px;background:#e9ede7}#preview-options{font:13px system-ui;display:flex;gap:16px;flex-wrap:wrap;justify-content:center;padding:12px;color:#243c32}#preview-options label{display:flex;align-items:center;gap:7px}#preview-options select{padding:8px;border:1px solid #bcc9be;border-radius:7px;background:white;font:inherit}#preview-options input{width:22px;height:22px}</style></head><body><div id="preview-options" aria-label="Design review controls"></div>'+localIcons+tweakShim+fragment+'</body></html>';
fs.writeFileSync(path.join(__dirname,'review-preview.html'),html);
const out='C:/Users/yigin/.codex/visualizations/2026/09/05/01a0725c-1d6c-73c1-8593-a73f1bd55905/mobile-lab-workspace.html';
fs.mkdirSync(path.dirname(out),{recursive:true});
if(Buffer.byteLength(fragment)>1000000)throw new Error('Oversize fragment');
fs.writeFileSync(out,fragment);
console.log(JSON.stringify({inline:out,preview:'review-preview.html',bytes:Buffer.byteLength(fragment)}));
