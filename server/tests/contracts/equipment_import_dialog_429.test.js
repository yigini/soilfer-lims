const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const { JSDOM } = require('jsdom');
const { utilities, csv } = require('../helpers/inventoryImportClient');
const { localeTranslator } = require('../helpers/clientTranslation');
let mounted;
const flush = callback => React.act(async () => { await callback?.(); for (let i=0;i<4;i++) await new Promise(resolve => setImmediate(resolve)); });
function result({ mode='preview', error=false, rows=1 }={}) {
    const entries=Array.from({length:rows},(_,index)=>({sheet:'equipment',rowNumber:index+2,status:error && index===rows-1?'ERROR':'NEW',errors:error && index===rows-1?[{code:'IMPORT_INVALID_ENUM',field:'assetType'}]:[],values:{name:'Meter '+(index+1),internalAssetTag:'METER-'+index,assetType:'PH_METER'}}));
    return {mode,committed:mode==='commit' && !error,labId:'lab-one',fileName:'practice.csv',atomic:true,duplicateMode:'SKIP',totalRows:rows,
        sheets:{equipment:entries},ignoredColumns:{equipment:[]},counts:{equipment:{NEW:rows-(error?1:0),DUPLICATE_SKIP:0,DUPLICATE_UPDATE:0,ERROR:error?1:0}},
        totals:{created:mode==='commit'&&!error?rows:0,updated:0,skipped:0,errors:error?1:0}};
}
async function mount({ locale='en',superAdmin=false,canManage=true,page=false,previewResult=result(),commitError=false }={}) {
    const dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:'http://localhost/'});
    global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.IS_REACT_ACT_ENVIRONMENT=true;
    dom.window.HTMLAnchorElement.prototype.click=jest.fn();
    const t=localeTranslator(locale),onImported=jest.fn(),onClose=jest.fn(),template=jest.fn(),blobs=[];
    const user={id:'user-one',username:'practice-manager',role:superAdmin?'SUPER_ADMIN':canManage?'LAB_MANAGER':'VIEWER',labId:superAdmin?null:'lab-one',lab:{name:'Practice lab'}};
    const auth={user,hasPermission:()=>canManage};
    const axios={get:jest.fn(async url=>({data:url==='/api/labs'?[{id:'lab-one',name:'Active lab',isActive:true},{id:'lab-off',name:'Inactive lab',isActive:false},{id:'lab-unknown',name:'Unknown state'}]:[]})),
        post:jest.fn(async url=>{if(url.endsWith('/preview'))return {data:previewResult};if(commitError)throw {response:{status:422,data:{...result({mode:'commit',error:true}),code:'IMPORT_VALIDATION_FAILED'}}};return {data:result({mode:'commit'})};})};
    const cache={},sourceRoot=path.resolve(__dirname,'../../../client/src');
    class TestURL extends URL {}
    TestURL.createObjectURL=blob=>{blobs.push(blob);return 'blob:practice';};TestURL.revokeObjectURL=jest.fn();
    function load(file){if(cache[file])return cache[file];const module={exports:{}};
        vm.runInNewContext(esbuild.transformSync(fs.readFileSync(file,'utf8'),{loader:'jsx',format:'cjs'}).code,{module,exports:module.exports,console,Date,URL:TestURL,Blob,
            window:dom.window,document:dom.window.document,setTimeout,clearTimeout,require(name){
                if(name==='react')return React;if(name==='axios')return axios;
                if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});
                if(name.includes('LanguageContext'))return {useLanguage:()=>({t,language:locale})};
                if(name.includes('AuthContext'))return {useAuth:()=>auth};
                if(name.includes('DialogContext'))return {useDialog:()=>({showDialog:jest.fn()})};
                if(name.includes('useFocusTrap'))return {useFocusTrap:()=>React.useRef(null)};
                if(name.includes('utils/inventoryImport'))return {...utilities,downloadInventoryImportTemplate:template};
                if(name.endsWith('InventoryImportDialog'))return load(path.resolve(path.dirname(file),name+'.jsx'));
                if(name.endsWith('InfoTooltip') || name.endsWith('EquipmentDetailDrawer') || name.endsWith('RegisterAssetModal'))return ()=>null;
                throw Error('Unexpected inventory import UI dependency: '+name);
            }});return cache[file]=module.exports;}
    const component=load(path.join(sourceRoot,page?'pages/Equipment.jsx':'components/inventory/InventoryImportDialog.jsx')).default;
    const root=require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
    mounted={root,dom,t,axios,onImported,onClose,template,blobs,
        button:text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text),
        click:element=>flush(()=>{expect(element).toBeDefined();element.click();}),
        change:(element,value)=>flush(()=>{expect(element).toBeDefined();Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(element,value);element.dispatchEvent(new dom.window.Event('change',{bubbles:true}));}),
        file:async(file=csv('internalAssetTag,name,assetType\nMETER-01,Practice meter,PH_METER'))=>flush(()=>{const input=document.querySelector('input[type=file]');expect(input).not.toBeNull();Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));})};
    await flush(()=>root.render(React.createElement(component,{onClose,onImported,module:'equipment'})));return mounted;
}
afterEach(async()=>{if(mounted){await flush(()=>mounted.root.unmount());mounted.dom.window.close();mounted=null;}delete global.window;delete global.document;delete global.navigator;delete global.IS_REACT_ACT_ENVIRONMENT;});

test.each(['en','fr','pt','es','es-419'])('%s: equipment mapping, preview, confirmation, commit and report use the equipment endpoint',async locale=>{
    const view=await mount({locale});const {t}=view;
    expect(document.querySelector('[role=dialog]').textContent).toContain(t('bulkImport.equipmentTitle'));
    expect(document.body.textContent).toContain(t('bulkImport.equipmentIntro'));
    await view.file();await view.click(view.button(t('bulkImport.preview')));
    expect(view.axios.post.mock.calls[0]).toEqual(['/api/equipment/import/preview',{atomic:true,duplicateMode:'SKIP',fileName:'practice.csv',sheets:{equipment:[{rowNumber:2,internalAssetTag:'METER-01',name:'Practice meter',assetType:'PH_METER'}]}}]);
    expect(view.button(t('bulkImport.commit')).disabled).toBe(true);
    const confirm=[...document.querySelectorAll('label')].find(node=>node.textContent.trim()===t('bulkImport.confirm')).querySelector('input');
    await view.click(confirm);await view.click(view.button(t('bulkImport.commit')));
    expect(view.axios.post.mock.calls[1]).toEqual(['/api/equipment/import/commit',view.axios.post.mock.calls[0][1]]);
    expect(view.onImported).toHaveBeenCalledTimes(1);expect(document.body.textContent).toContain(t('bulkImport.completed'));
    await view.click(view.button(t('bulkImport.downloadResult')));expect(await view.blobs[0].text()).toContain(t('bulkImport.datasets.equipment'));
});
test('equipment template and scoped CSV export use the same module and explicit active lab',async()=>{
    const view=await mount({superAdmin:true}),{t}=view;
    await view.click(view.button(t('bulkImport.template')));expect(view.template).toHaveBeenCalledWith(t,'equipment');
    const select=document.querySelector('select[aria-label="'+t('bulkImport.laboratory')+'"]');
    expect([...select.options].map(o=>o.value)).toEqual(['','lab-one']);
    const exportButton=view.button(t('bulkImport.exportSheet',{sheet:t('bulkImport.datasets.equipment')}));expect(exportButton.disabled).toBe(true);
    await view.change(select,'lab-one');await view.click(exportButton);
    expect(view.axios.get).toHaveBeenCalledWith('/api/equipment/export',{responseType:'blob',params:{labId:'lab-one'}});
    await view.file();await view.click(view.button(t('bulkImport.preview')));expect(view.axios.post.mock.calls[0][1].labId).toBe('lab-one');
});
test.each([false,true])('equipment entry requires manage permission (%s)',async canManage=>{
    const view=await mount({page:true,canManage}),{t}=view;expect(Boolean(view.button(t('bulkImport.openEquipment')))).toBe(canManage);
    if(canManage){await view.click(view.button(t('bulkImport.openEquipment')));expect(document.querySelector('[role=dialog]').textContent).toContain(t('bulkImport.equipmentTitle'));}
});
test('updating the duplicate choice clears the prior preview and keeps qualification warning visible',async()=>{
    const view=await mount(),{t}=view;await view.file();await view.click(view.button(t('bulkImport.preview')));
    await view.change(document.querySelector('select[aria-label="'+t('bulkImport.duplicates')+'"]'),'UPDATE');
    expect(view.button(t('bulkImport.commit'))).toBeUndefined();expect(document.body.textContent).toContain(t('bulkImport.equipmentRuleHint'));
    await view.click(view.button(t('bulkImport.preview')));expect(view.axios.post.mock.calls[1][1].duplicateMode).toBe('UPDATE');
});
test('atomic errors cannot commit and are translated',async()=>{
    const view=await mount({locale:'pt',previewResult:result({error:true,rows:2})}),{t}=view;await view.file();await view.click(view.button(t('bulkImport.preview')));
    expect(view.button(t('bulkImport.commit')).disabled).toBe(true);expect(document.body.textContent).toContain(t('bulkImport.errors.IMPORT_INVALID_ENUM'));
});
