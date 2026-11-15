const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const { JSDOM } = require('jsdom');
const { utilities, csv } = require('../helpers/inventoryImportClient');
const { localeTranslator } = require('../helpers/clientTranslation');
let mounted;
const flush = callback => React.act(async () => { await callback?.(); for (let i=0;i<4;i++) await new Promise(resolve => setImmediate(resolve)); });
function result({ mode='preview', error=false, rows=1 }={}) {
    const entries=Array.from({length:rows},(_,index)=>({sheet:'locations',rowNumber:index+2,status:error && index===rows-1?'ERROR':'NEW',errors:error && index===rows-1?[{code:'IMPORT_INVALID_ENUM',field:'locationType'}]:[],values:{name:'Shelf '+(index+1),purpose:'REAGENT'}}));
    return {mode,committed:mode==='commit' && !error,labId:'lab-one',fileName:'practice.csv',atomic:true,duplicateMode:'SKIP',totalRows:rows,
        sheets:{locations:entries},ignoredColumns:{locations:[]},counts:{locations:{NEW:rows-(error?1:0),DUPLICATE_SKIP:0,DUPLICATE_UPDATE:0,ERROR:error?1:0}},
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
                if(name.endsWith('InfoTooltip'))return ()=>null;
                throw Error('Unexpected inventory import UI dependency: '+name);
            }});return cache[file]=module.exports;}
    const component=load(path.join(sourceRoot,page?'pages/Inventory.jsx':'components/inventory/InventoryImportDialog.jsx')).default;
    const root=require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
    mounted={root,dom,t,axios,onImported,onClose,template,blobs,
        button:text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text),
        click:element=>flush(()=>{expect(element).toBeDefined();element.click();}),
        change:(element,value)=>flush(()=>{expect(element).toBeDefined();Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(element,value);element.dispatchEvent(new dom.window.Event('change',{bubbles:true}));}),
        file:async(file=csv('name,purpose,locationType\nShelf,REAGENT,SHELF'))=>flush(()=>{const input=document.querySelector('input[type=file]');expect(input).not.toBeNull();Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));})};
    await flush(()=>root.render(React.createElement(component,{onClose,onImported})));return mounted;
}
afterEach(async()=>{if(mounted){await flush(()=>mounted.root.unmount());mounted.dom.window.close();mounted=null;}delete global.window;delete global.document;delete global.navigator;delete global.IS_REACT_ACT_ENVIRONMENT;});
test.each(['en','fr','pt','es','es-419'])('%s: preview then explicit confirmation commits the same rows and shows the receipt',async locale=>{
    const view=await mount({locale});const {t}=view;expect(document.querySelector('[role=dialog]')).not.toBeNull();
    await view.file();await view.click(view.button(t('bulkImport.preview')));
    expect(view.axios.post).toHaveBeenCalledTimes(1);const first=view.axios.post.mock.calls[0];expect(first[0]).toBe('/api/inventory/import/preview');
    expect(first[1]).toEqual({atomic:true,duplicateMode:'SKIP',fileName:'practice.csv',sheets:{locations:[{rowNumber:2,name:'Shelf',purpose:'REAGENT',locationType:'SHELF'}]}});
    const commit=view.button(t('bulkImport.commit'));expect(commit.disabled).toBe(true);
    const confirm=[...document.querySelectorAll('label')].find(node=>node.textContent.trim()===t('bulkImport.confirm')).querySelector('input');
    await view.click(confirm);expect(commit.disabled).toBe(false);await view.click(commit);
    expect(view.axios.post.mock.calls[1]).toEqual(['/api/inventory/import/commit',first[1]]);
    expect(document.body.textContent).toContain(t('bulkImport.completed'));expect(view.onImported).toHaveBeenCalledTimes(1);
    await view.click(view.button(t('bulkImport.downloadResult')));expect(view.blobs).toHaveLength(1);expect(await view.blobs[0].text()).toContain(t('bulkImport.result'));
});
test('Super Admin can choose only an explicitly active laboratory and sends its ID',async()=>{
    const view=await mount({superAdmin:true});await view.file();const {t}=view;
    expect(view.button(t('bulkImport.preview')).disabled).toBe(true);
    const select=document.querySelector('select[aria-label="'+t('bulkImport.laboratory')+'"]');expect([...select.options].map(option=>option.value)).toEqual(['','lab-one']);
    await view.change(select,'lab-one');await view.click(view.button(t('bulkImport.preview')));expect(view.axios.post.mock.calls[0][1].labId).toBe('lab-one');
});
test('changing the import mode invalidates the old preview and requires another preview',async()=>{
    const view=await mount();const {t}=view;await view.file();await view.click(view.button(t('bulkImport.preview')));
    await view.change(document.querySelector('select[aria-label="'+t('bulkImport.duplicates')+'"]'),'UPDATE');expect(view.button(t('bulkImport.commit'))).toBeUndefined();
    await view.click(view.button(t('bulkImport.preview')));expect(view.axios.post.mock.calls[1][1].duplicateMode).toBe('UPDATE');expect(view.button(t('bulkImport.commit')).disabled).toBe(true);
});
test('an atomic preview with errors cannot commit; partial mode requires a new preview',async()=>{
    const view=await mount({previewResult:result({error:true,rows:2})}),{t}=view;await view.file();await view.click(view.button(t('bulkImport.preview')));
    expect(view.button(t('bulkImport.commit')).disabled).toBe(true);expect(document.body.textContent).toContain(t('bulkImport.errors.IMPORT_INVALID_ENUM'));
    const atomic=[...document.querySelectorAll('label')].find(node=>node.textContent.trim()===t('bulkImport.atomic')).querySelector('input');
    await view.click(atomic);expect(view.button(t('bulkImport.commit'))).toBeUndefined();await view.click(view.button(t('bulkImport.preview')));
    expect(view.axios.post.mock.calls[1][1].atomic).toBe(false);
});
test('commit revalidation errors show a translated stopped receipt and do not refresh the stock list',async()=>{
    const view=await mount({commitError:true}),{t}=view;await view.file();await view.click(view.button(t('bulkImport.preview')));
    const confirm=[...document.querySelectorAll('label')].find(node=>node.textContent.trim()===t('bulkImport.confirm')).querySelector('input');await view.click(confirm);await view.click(view.button(t('bulkImport.commit')));
    expect(document.body.textContent).toContain(t('bulkImport.stopped'));expect(document.body.textContent).toContain(t('bulkImport.errors.IMPORT_VALIDATION_FAILED'));expect(view.onImported).not.toHaveBeenCalled();
});
test('large previews paginate and filtering errors resets to the first result page',async()=>{
    const view=await mount({previewResult:result({rows:101,error:true})}),{t}=view;await view.file();await view.click(view.button(t('bulkImport.preview')));
    expect(document.querySelectorAll('tbody tr')).toHaveLength(50);await view.click(view.button(t('bulkImport.next')));expect(document.querySelectorAll('tbody tr')).toHaveLength(50);
    await view.click(view.button(t('bulkImport.next')));expect(document.querySelectorAll('tbody tr')).toHaveLength(1);expect(document.body.textContent).toContain('Shelf 101');
    await view.change(document.querySelector('select[aria-label="'+t('bulkImport.filterResult')+'"]'),'ERROR');expect(document.querySelectorAll('tbody tr')).toHaveLength(1);expect(view.button(t('bulkImport.previous')).disabled).toBe(true);
});
test.each([false,true])('Inventory page import entry respects manage permission (%s)',async canManage=>{
    const view=await mount({page:true,canManage}),{t}=view;
    expect(Boolean(view.button(t('bulkImport.open')))).toBe(canManage);
    if(canManage){await view.click(view.button(t('bulkImport.open')));expect(document.querySelector('[role=dialog]')).not.toBeNull();}
});
