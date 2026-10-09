const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const esbuild=require('../../../client/node_modules/esbuild'),React=require('../../../client/node_modules/react');
const root=path.resolve(__dirname,'../../../client/src');
const translations=locale=>JSON.parse(fs.readFileSync(path.join(root,`translations/${locale}.json`),'utf8'));
const english=translations('en');
const t=key=>key.split('.').reduce((value,part)=>value?.[part],english) ?? key;
function render(props){
    const module={exports:{}};
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.join(root,'components/sample/RepeatReasonFields.jsx'),'utf8'),
        {loader:'jsx',format:'cjs'}).code,{React,module,exports:module.exports,require:name=>{
        if(name.includes('LanguageContext'))return {useLanguage:()=>({t})};
        throw Error('Unexpected repeat form dependency '+name);
    }});
    return module.exports.default(props);
}
function elements(tree,predicate){
    if(Array.isArray(tree))return tree.flatMap(child=>elements(child,predicate));
    if(!tree?.props)return [];
    return [...(predicate(tree)?[tree]:[]),...elements(tree.props.children,predicate)];
}
test('the RETURN form starts with no inferred reason and sends the selected canonical code and independent note',()=>{
    const onReasonChange=jest.fn(),onNoteChange=jest.fn();
    const tree=render({reasonCode:'',note:'',onReasonChange,onNoteChange});
    const select=elements(tree,row=>row.type==='select')[0],note=elements(tree,row=>row.type==='textarea')[0];
    expect(select.props.value).toBe('');expect(select.props.required).toBe(true);expect(note.props.required).toBe(true);
    const choices=elements(select,row=>row.type==='option');
    expect(choices[0].props.value).toBe('');
    expect(choices.map(row=>row.props.value)).not.toContain('TRANSCRIPTION_ERROR');
    expect(choices.map(row=>row.props.value)).not.toContain('CLIENT_RETEST');
    const chosen=choices.find(row=>row.props.value==='REVIEW_OUTLIER');
    expect(chosen.props.children).toBe('Review outlier');
    select.props.onChange({target:{value:chosen.props.value}});note.props.onChange({target:{value:'Compare with the worksheet, row 17'}});
    expect(onReasonChange).toHaveBeenCalledWith('REVIEW_OUTLIER');
    expect(onNoteChange).toHaveBeenCalledWith('Compare with the worksheet, row 17');
    expect(onReasonChange).toHaveBeenCalledTimes(1);expect(onNoteChange).toHaveBeenCalledTimes(1);
});
test.each(['en','es','es-419','fr','pt'])('new repeat labels and errors are translated in both %s catalogues',locale=>{
    const labels=translations(locale).repeatCommands;
    const server=JSON.parse(fs.readFileSync(path.resolve(__dirname,`../../locales/${locale}.json`),'utf8')).repeatCommands;
    for(const catalogue of [labels,server]){
        for(const key of ['returnTitle','returnHelp','reasonLabel','chooseReason','noteLabel','notePlaceholder','confirmReturn'])expect(catalogue[key].trim()).not.toBe('');
        for(const code of Object.keys(require('../../services/workRepeatContract').RETURN_REASON_STATUS))expect(catalogue.reasons[code].trim()).not.toBe('');
        for(const code of ['WORK_ATTEMPT_REASON_REQUIRED','ATTEMPT_LIMIT','ATTEMPT_LIMIT_NCR_UNAVAILABLE','REPEAT_FAILED_BATCH','ATTEMPT_REPEAT_RUN_DISPOSITION_REQUIRED'])expect(catalogue.errors[code].trim()).not.toBe('');
    }
});
