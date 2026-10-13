const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..'), client = path.join(root, 'client');
const esbuild = require(path.join(client, 'node_modules/esbuild'));
const out = path.join(root, 'output/playwright/issue-206');
fs.mkdirSync(out, { recursive: true });
const english = fs.readFileSync(path.join(client, 'src/translations/en.json'), 'utf8');
const entry = `import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import SampleContainersPanel from './src/components/sample/SampleContainersPanel';
import AliquotSelect from './src/components/sample/AliquotSelect';
function Preview(){const [selected,setSelected]=useState(null);return <main style={{maxWidth:1050,margin:'30px auto',padding:20}}>
<h1 className="text-2xl font-semibold">Container UI verification fixture</h1>
<p className="mb-6">Detached browser fixture. No production connection or analytical data.</p>
<SampleContainersPanel sampleId="ui-sample" sampleCode="LAB-26-000045Q" attempts={[{id:'ui-attempt-2',attemptNo:2,aliquotId:'ui-aliquot'}]}/>
<section className="mt-6 p-5 border rounded"><AliquotSelect sampleId="ui-sample" value={selected} onChange={setSelected}/>
<p aria-live="polite">Selected fixture identity: {selected || 'none'}</p></section></main>}
createRoot(document.getElementById('root')).render(<Preview/>);`;
esbuild.build({ stdin: { contents: entry, resolveDir: client, sourcefile: 'container-ui-fixture.jsx', loader: 'jsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic', plugins: [{ name: 'detached-fixture', setup(build) {
    build.onResolve({ filter: /LanguageContext|AuthContext|^axios$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.includes('LanguageContext') ?
      `const english=${english};const t=(key,fallback)=>key.split('.').reduce((v,k)=>v?.[k],english)??fallback??key;export const useLanguage=()=>({t});` :
      args.path.includes('AuthContext') ? `export const useAuth=()=>({hasPermission:()=>true});` :
      `const base={sampleId:'ui-sample',createdBy:'UI fixture operator',createdAt:'2026-10-13T09:00:00Z',status:'ACTIVE'};
let rows=[{...base,id:'ui-bulk',parentId:null,kind:'BULK',code:'C-LAB-26-000001D',massG:500},
{...base,id:'ui-fine',parentId:'ui-bulk',kind:'FINE_EARTH',code:'C-LAB-26-000002B',massG:100},
{...base,id:'ui-aliquot',parentId:'ui-fine',kind:'ALIQUOT',code:'C-LAB-26-0000039',massG:10}];
export default {get:async()=>({data:{containers:rows}}),post:async(url,input)=>{rows=[...rows,{...base,...input,id:'ui-created-'+rows.length,code:'C-UI-CREATED-'+rows.length}];return {data:{container:rows.at(-1)}}}};`, loader: 'js' }));
  } }] }).then(result => {
    const cssFile = fs.readdirSync(path.join(client, 'dist/assets')).find(file => /^index-.*\.css$/.test(file));
    const css = fs.readFileSync(path.join(client, 'dist/assets', cssFile), 'utf8');
    fs.writeFileSync(path.join(out, 'containers.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Issue 206 detached UI</title><style>'+css+'</style></head><body><div id="root"></div><script>'+result.outputFiles[0].text+'</script></body></html>', 'utf8');
    console.log(path.join(out, 'containers.html'));
}).catch(error => {console.error(error.message);process.exitCode=1;});
