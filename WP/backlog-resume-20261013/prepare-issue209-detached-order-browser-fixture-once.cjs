const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),client=path.join(root,'client'),out=path.join(root,'output/playwright/issue-209-order-ui');
if(fs.existsSync(out))throw Error('Exclusive order UI fixture already exists');fs.mkdirSync(out,{recursive:true});
const english=fs.readFileSync(path.join(client,'src/translations/en.json'),'utf8');
const entry=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import AnalysisUpdateModal from './src/components/sample/AnalysisUpdateModal';
function Preview(){const[open,setOpen]=useState(true),[saved,setSaved]=useState(false);const status=new URLSearchParams(location.search).get('status')||'PROCESSING';
return <main style={{padding:20}}><h1>Order revision UI verification fixture</h1><p>Detached synthetic presentation data. No database or production connection.</p>
{saved&&<pre id="saved-order">{JSON.stringify(window.__orderRequests.filter(row=>row.method==='PUT'))}</pre>}
<AnalysisUpdateModal sample={{id:'UI-ORDER-SAMPLE',labId:'UI-LAB',status,requiredAnalyses:['PH_H2O']}} isOpen={open} onClose={()=>setOpen(false)} onUpdateSuccess={()=>setSaved(true)}/></main>}
createRoot(document.getElementById('root')).render(<Preview/>);`;
const axios=`window.__orderRequests=[];const analyses=[{code:'PH_H2O',name:'pH in water'},{code:'SOC',name:'Soil organic carbon'}];
export default{get:async(url)=>({data:url==='/api/config/groups'?[{id:'UI-BUNDLE',name:'Synthetic soil panel',orderable:true,analyses:['PH_H2O','SOC']}]:analyses}),
post:async(url,input)=>{window.__orderRequests.push({method:'POST',url,input});return{data:{added:input.analyses.includes('SOC')?['SOC']:[],removed:[],conflicts:[]}}},
put:async(url,input)=>{window.__orderRequests.push({method:'PUT',url,input});return{data:{success:true}}}};`;
require(path.join(client,'node_modules/esbuild')).build({stdin:{contents:entry,resolveDir:client,sourcefile:'issue209-ui-fixture.jsx',loader:'jsx'},
bundle:true,write:false,format:'iife',jsx:'automatic',plugins:[{name:'owned-order-preview',setup(build){
build.onResolve({filter:/LanguageContext|AuthContext|AnalysisCatalogueContext|^axios$/},args=>({path:args.path,namespace:'fixture'}));
build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path.includes('LanguageContext')?
`const english=${english};const t=key=>key.split('.').reduce((v,k)=>v?.[k],english)??key;export const useLanguage=()=>({t});`:
args.path.includes('AuthContext')?`export const useAuth=()=>({token:'synthetic-only',hasPermission:()=>true});`:
args.path.includes('AnalysisCatalogueContext')?`export const useAnalysisNames=()=>((code,fallback)=>fallback||code);`:axios,loader:'js'}));}}]})
.then(result=>{
const cssFile=fs.readdirSync(path.join(client,'dist/assets')).find(file=>/^index-.*\.css$/.test(file));
const css=fs.readFileSync(path.join(client,'dist/assets',cssFile),'utf8');
fs.writeFileSync(path.join(out,'orders.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Issue209 detached order UI</title><style>'+css+'</style></head><body><div id="root"></div><script>'+result.outputFiles[0].text+'</script></body></html>',{encoding:'utf8',flag:'wx'});
fs.writeFileSync(path.join(out,'fixture-inputs.json'),JSON.stringify({synthetic:true,productionOperations:0,
sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(client,'src/components/sample/AnalysisUpdateModal.jsx'))).digest('hex'),
cssSha256:crypto.createHash('sha256').update(css).digest('hex')},null,2)+'\n',{flag:'wx'});
console.log(path.join(out,'orders.html'));
}).catch(error=>{console.error(error);process.exitCode=1});
