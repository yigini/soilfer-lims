const {mountUi}=require('../helpers/qcWorksheetUi');
const {referenceRows}=require('../../services/calculationReferenceLibrary');
const {decode}=require('../../services/calculationTemplateService');
const {calculate}=require('../../../shared/soilCalculation');
const inputs={absorbance:'3.00',blankConcentration:'0',extractVolume:'20',dilutionFactor:'2',sampleMass:'1',moistureCorrectionFactor:'1'};
const active={activationId:'activation',templateId:'template',templateVersion:1};
const template={...decode(referenceRows().find(row=>row.templateKey==='olsen-phosphorus')),outputDecimals:2,
    precisionSource:{kind:'LOCAL_SOP',citation:'Synthetic UI fixture SOP, two decimals'}};
const numberFormat={decimal:'.',thousands:null},curve={id:'curve',revision:1,slope:2,intercept:1,calibrationMax:2};
const units={native:{code:'mg/kg',quantityKind:'MASS_FRACTION',factorToBase:1},reporting:{code:'mg/kg',quantityKind:'MASS_FRACTION',factorToBase:1}};
const context={active,template,numberFormat,curve,units};
const calculation=calculate(template,inputs,{numberFormat,curve,units});
const item={sampleId:'sample',workItemId:'work',calculationTemplate:active,draft:{value:'40',values:{calculation:{...active,curveId:'curve',inputs}}}};
function mount(response=context){const axios={post:jest.fn(async()=>({data:{data:response}}))};
    return mountUi('components/workbench/CalculationEntry.jsx',{item,onDraftChange:jest.fn()}, {axios});}

test('inactive methods retain the old editor and issue no calculation preview request',async()=>{
    const view=mountUi('components/workbench/CalculationEntry.jsx',{item:{...item,calculationTemplate:null},children:'original-editor'});
    await view.render();expect(view.text()).toContain('original-editor');expect(view.axios.post).not.toHaveBeenCalled();
});
test('raw edits preserve the exact scalar and invalidate the final draft until authoritative confirmation',async()=>{
    const view=mount();await view.render();
    view.all().find(row=>row.props?.['data-worksheet-column']==='calculation-absorbance').props.onChange({target:{value:'3.002'}});
    await view.render();expect(view.props.onDraftChange).toHaveBeenLastCalledWith('work','',expect.objectContaining({values:{calculation:{...active,curveId:'curve',inputs:{...inputs,absorbance:'3.002'}}}}));
});
test('a later curve with the same numerical output cannot silently replace the preview basis',async()=>{
    const view=mount();await view.render();view.axios.post.mockResolvedValueOnce({data:{data:{...context,curve:{...curve,id:'later'},calculation}}});
    await view.all().find(row=>row.type==='button').props.onClick();await view.render();
    expect(view.props.onDraftChange).not.toHaveBeenCalled();expect(view.text()).toContain('calculations.saveRefused');
});
test('the matching authoritative preview retains raw measurements alongside the explicitly confirmed final value',async()=>{
    const view=mount();await view.render();view.axios.post.mockResolvedValueOnce({data:{data:{...context,calculation}}});
    await view.all().find(row=>row.type==='button').props.onClick();await view.render();
    expect(view.props.onDraftChange).toHaveBeenLastCalledWith('work','40',{replicateNo:1,values:{calculation:{...active,curveId:'curve',inputs}}});
});
test('recorded evidence displays the frozen raw inputs, constants and curve without any live resolver or calculation request',async()=>{
    const evidence={...calculation,resultId:'recorded',template,templateId:'old-template',templateVersion:3,activationId:'old-activation',parameters:JSON.stringify(template.parameters),
        inputs:JSON.stringify(inputs),intermediate:JSON.stringify(calculation.intermediate),curveId:'old-curve',curve:{...curve,id:'old-curve',r:1,rSquared:1,minPointsApplied:3,minRApplied:0.995,
            points:[{ordinal:1,standardConcentration:0,response:1},{ordinal:2,standardConcentration:1,response:3},{ordinal:3,standardConcentration:2,response:5}]}};
    const view=mountUi('components/sample/CalculationEvidence.jsx',{evidence,t:key=>key});await view.render();
    expect(view.text()).toContain('3.00');expect(view.text()).toContain('old-template');expect(view.text()).toContain('old-curve');
    expect(view.text()).toContain('0.995');expect(view.text()).toContain('calculations.rawInputs');
    expect(view.axios.get).not.toHaveBeenCalled();expect(view.axios.post).not.toHaveBeenCalled();
});
