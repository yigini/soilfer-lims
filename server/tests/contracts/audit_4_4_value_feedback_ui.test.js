const fs=require('node:fs'),path=require('node:path');
const {mountUi}=require('../helpers/qcWorksheetUi');
const {classifyResultValue}=require('../../../shared/resultValueValidation');
const format={decimal:'.',thousands:null};
const rules={min:2,max:14,typicalMin:4,typicalMax:9,loq:0.5,lod:0.1,calibrationMax:10,unit:'pH'};
const input=host=>host.all().find(node=>node.type==='input');
test.each([['65','RED',true],['<0.001','RED',true],['6.01','VALID',false],['3','AMBER',false],['11','AMBER',false]])(
    'actual NumericEditor immediately classifies %s as %s using the exact server module',async(value,severity,invalid)=>{
        const onChange=jest.fn(),host=mountUi('components/workbench/NumericEditor.jsx',{value:'',onChange,validation:rules,numberFormat:format});
        await host.render();input(host).props.onChange({target:{value}});
        expect(onChange).toHaveBeenCalledWith(value);
        await host.render({value});
        expect(input(host).props['aria-invalid']).toBe(invalid);
        const wrapper=host.all().find(node=>node.props?.['data-value-severity']);
        expect(wrapper.props['data-value-severity']).toBe(severity);
        expect(wrapper.props['data-value-flags']).toBe(classifyResultValue(value,rules,format).flags.join(','));
        expect(wrapper.props.title).toContain('valueValidation.loq: 0.5');
        expect(wrapper.props.title).toContain('valueValidation.unit: pH');
    });
test('the less-than quick key fills exact method LOQ using the lab decimal separator',async()=>{
    const onChange=jest.fn(),host=mountUi('components/workbench/NumericEditor.jsx',{value:'',onChange,validation:rules,numberFormat:{decimal:',',thousands:null}});
    await host.render();const event={key:'<',preventDefault:jest.fn()};input(host).props.onKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalled();expect(onChange).toHaveBeenCalledWith('<0,5');
    expect(host.all().find(node=>node.type==='button').props.disabled).toBe(false);
});
test('unconfigured LOQ disables the quick key with its stable reason; null warning bounds are disclosed',async()=>{
    const onChange=jest.fn(),host=mountUi('components/workbench/NumericEditor.jsx',{value:'100',onChange,validation:{loq:null,typicalMin:null,typicalMax:null,calibrationMax:null},numberFormat:format});
    await host.render();const quick=host.all().find(node=>node.type==='button');
    expect(quick.props).toMatchObject({disabled:true,'data-loq-code':'LOQ_NOT_CONFIGURED'});
    expect(quick.props.title).toBe('valueValidation.LOQ_NOT_CONFIGURED');
    const event={key:'<',preventDefault:jest.fn()};input(host).props.onKeyDown(event);
    expect(onChange).not.toHaveBeenCalled();expect(event.preventDefault).not.toHaveBeenCalled();
    expect(host.all().find(node=>node.props?.['data-value-severity']).props.title).toContain('valueValidation.calibrationMax: valueValidation.notConfigured');
});
test('a barcode-protected cell waits for the actual burst boundary before expanding a single less-than character',async()=>{
    const onChange=jest.fn(),host=mountUi('components/workbench/NumericEditor.jsx',{
        value:'',onChange,validation:rules,numberFormat:format,onBarcodeRejected:jest.fn()});
    await host.render();const editor=host.all().find(node=>node.props?.onBarcodeRejected);
    const event={key:'<',preventDefault:jest.fn()};editor.props.onKeyDown(event);
    expect(onChange).not.toHaveBeenCalled();expect(event.preventDefault).not.toHaveBeenCalled();
    // Only BarcodeSafeInput's accepted, buffered change may expand the quick key.
    editor.props.onChange({target:{value:'<'}});expect(onChange).toHaveBeenCalledWith('<0.5');
});
test.each(['WorksheetArea','SingleSampleEditor'])('%s passes the actual per-row server rules into the numeric input',async name=>{
    const row={workItemId:'owned-work',sampleId:'owned-sample',sampleDisplayId:'Owned sample',analysis:'PH_H2O',status:'IN_PROGRESS',
        numberFormat:format,valueRules:rules,readiness:{isReady:true},draft:{value:'65'}};
    const host=mountUi(`components/workbench/${name}.jsx`,{activeGroup:{analysis:row.analysis,unit:'pH',items:[row]},items:[row],onDraftChange:jest.fn(),onIndexChange:jest.fn(),currentIndex:0});
    await host.render();const editor=host.all().find(node=>node.props?.ariaLabel==='Owned sample determination');
    expect(editor.props).toMatchObject({value:'65',validation:rules,numberFormat:format});
});
test('all five client and server locales include every validation label and flag',()=>{
    const root=path.resolve(__dirname,'../../..');
    const keys=value=>Object.entries(value).flatMap(([key,item])=>typeof item==='object'?keys(item).map(child=>key+'.'+child):[key]);
    const expected=keys(JSON.parse(fs.readFileSync(path.join(root,'client/src/translations/en.json'),'utf8')).valueValidation).sort();
    for(const dir of ['client/src/translations','server/locales'])for(const locale of ['en','es','es-419','fr','pt']){
        const actual=JSON.parse(fs.readFileSync(path.join(root,dir,locale+'.json'),'utf8')).valueValidation;
        expect(keys(actual).sort()).toEqual(expected);
        expect(Object.values(actual.flags).every(value=>typeof value==='string'&&value.trim())).toBe(true);
    }
});
