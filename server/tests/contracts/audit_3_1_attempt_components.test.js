const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const esbuild=require('../../../client/node_modules/esbuild'),React=require('../../../client/node_modules/react');
const root=path.resolve(__dirname,'../../../client/src');
const english=JSON.parse(fs.readFileSync(path.join(root,'translations/en.json'),'utf8'));
const t=(key,params={})=>String(key.split('.').reduce((value,part)=>value?.[part],english) ?? key)
    .replace(/\{number\}/g,String(params.number));
function render(item){
    const module={exports:{}};
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.join(root,'components/sample/EvidenceInspectionModal.jsx'),'utf8'),
        {loader:'jsx',format:'cjs'}).code,{module,exports:module.exports,require:name=>{
        if(name==='react')return {...React,useEffect:()=>{}};
        if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});
        if(name.includes('LanguageContext'))return {useLanguage:()=>({t})};
        if(name.includes('AnalysisCatalogueContext'))return {useAnalysisNames:()=>code=>code};
        if(name.includes('workItemEvidence'))return {operationalEvidence:()=>null,workItemEvidenceText:row=>row.result};
        throw Error('Unexpected component dependency '+name);
    }});
    return module.exports.default({item:{analysis:'P',status:'COMPLETED',result:'6.42',results:[],attempts:[],...item},
        sample:{originalId:'owned-sample'},isOpen:true,onClose:()=>{}});
}
function text(tree){
    if(Array.isArray(tree))return tree.map(text).join(' ');
    if(typeof tree==='string'||typeof tree==='number')return String(tree);
    return tree?.props?text(tree.props.children):'';
}
function elements(tree,predicate){
    if(Array.isArray(tree))return tree.flatMap(row=>elements(row,predicate));
    if(!tree?.props)return [];
    return [...(predicate(tree)?[tree]:[]),...elements(tree.props.children,predicate)];
}
test.each([['RETURNED','Returned (legacy)'],['REJECTED','Rejected (legacy)'],['OLD_UNKNOWN','OLD_UNKNOWN (legacy)']])
('stored %s appears as a read-only badge, with its author and unlinked attempt number', (status,label)=>{
    const attempt={id:'historical',attemptNo:7,status,authorName:'Retained author',createdAt:'2026-10-01T12:00:00Z'};
    const before={...attempt},tree=render({attempts:[attempt]});
    expect(text(tree)).toContain(label);expect(text(tree)).toContain('Attempt #7');expect(text(tree)).toContain('Retained author');
    expect(elements(tree,row=>['input','select','textarea'].includes(row.type))).toEqual([]);
    expect(elements(tree,row=>row.type==='button')).toHaveLength(2);
    expect(attempt).toEqual(before);
});
test('an imported result without an attempt never invents Attempt #1',()=>{
    const tree=render({results:[{id:'imported',param:'P',value:'6.42',attempt:null,createdAt:'2026-10-01T12:00:00Z'}]});
    expect(text(tree)).toContain('Imported, no attempt');expect(text(tree)).not.toContain('Attempt #1');
});
test('the result line uses its actual linked attempt number',()=>{
    expect(text(render({results:[{id:'linked',param:'P',value:'6.42',attempt:{id:'attempt',attemptNo:9,status:'RECORDED'},
        createdAt:'2026-10-01T12:00:00Z'}]}))).toContain('Attempt #9');
});
test.each(['en','es','es-419','fr','pt'])('all attempt evidence labels are present in %s',locale=>{
    const labels=JSON.parse(fs.readFileSync(path.join(root,`translations/${locale}.json`),'utf8')).attemptEvidence;
    for(const key of ['title','number','importedNoAttempt','legacy','notRecorded'])expect(labels[key]).toEqual(expect.any(String));
    for(const key of ['open','recorded','submitted','accepted','questioned','invalidated','superseded','returnedLegacy','rejectedLegacy']){
        expect(labels.status[key]).toEqual(expect.any(String));expect(labels.status[key].trim().length).toBeGreaterThan(0);
    }
});
