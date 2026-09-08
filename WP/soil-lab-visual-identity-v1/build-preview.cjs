// Builds isolated, offline mockup assets. It does not import or execute the LIMS app.
const fs = require('fs');
const path = require('path');
const React = require('../../client/node_modules/react');
const {renderToStaticMarkup} = require('../../client/node_modules/react-dom/server');
const icons = require('../../client/node_modules/lucide-react');
const root = path.resolve(__dirname, '../..');
const output = 'C:/Users/yigin/.codex/visualizations/2026/09/05/01a0725c-1d6c-73c1-8593-a73f1bd55905/soil-lab-visual-identity.html';
let fragment = fs.readFileSync(path.join(__dirname,'soil-lab-identity.fragment.html'),'utf8');
for (const [token,file] of [['__SOILFER_LIGHT_LOGO__','logo-light.png'],['__SOILFER_DARK_LOGO__','logo-dark.png']]) {
  fragment = fragment.replace(token,'data:image/png;base64,'+fs.readFileSync(path.join(root,'client/public/assets/img',file)).toString('base64'));
}
if (Buffer.byteLength(fragment)>1000000) throw Error('Fragment exceeds 1 MB');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,fragment);

// The conversation supplies Lucide; offline QA uses the same named icons from
// the installed Lucide package. No icon SVG paths are authored by this preview.
const names=['layout-dashboard','test-tubes','clipboard-list','flask-conical','chart-no-axes-combined','files','microscope','package','info','bell','globe-2','moon','sun','building-2','refresh-cw','arrow-right','arrow-up-right','search','droplets','layers','circle-check','clipboard-check','clock-3','clipboard','printer','git-branch','ellipsis'];
const generated={};
const aliases={'chart-no-axes-combined':'LineChart','circle-check':'CheckCircle2','ellipsis':'MoreHorizontal'};
for(const name of names){const component=icons[name.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('')]||icons[aliases[name]];if(!component)throw Error('Unknown Lucide icon: '+name);generated[name]=renderToStaticMarkup(React.createElement(component,{'aria-hidden':true,width:18,height:18}));}
const localIcons='<script>globalThis.lucide={createIcons(){document.querySelectorAll("i[data-lucide]").forEach(el=>{const markup='+JSON.stringify(generated)+'[el.dataset.lucide];if(markup)el.outerHTML=markup})}};</script>';
const wrapper='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; base-uri \'none\'; form-action \'none\'"><title>SoilFER — visual identity concepts</title><style>body{margin:0}*{box-sizing:border-box}</style></head><body>'+localIcons+fragment+'</body></html>';
fs.writeFileSync(path.join(__dirname,'review-preview.html'),wrapper);
console.log(JSON.stringify({inline:output,bytes:Buffer.byteLength(fragment),offlinePreview:'review-preview.html'}));
