const fs=require('node:fs'),path=require('node:path');
const {mountUi}=require('../helpers/qcWorksheetUi');
const row=(patch={})=>({workItemId:'owned',sampleId:'sample',status:'IN_PROGRESS',readiness:{isReady:true},
    numberFormat:{decimal:'.',thousands:null},valueRules:{min:2,max:14,loq:0.5,calibrationMax:20,unit:'mg/kg'},
    equipmentId:'instrument',draft:{value:'65',replicateNo:1,basis:'AIR_DRY'},...patch});
const api=rows=>({get:jest.fn(async()=>({data:rows})),post:jest.fn(async()=>({data:{}}))});

test('technician sends the exact typed range value/context/reason and never records a Result when requesting',async()=>{
    const axios=api([]),host=mountUi('components/workbench/ResultValueActions.jsx',{item:row()},{axios});
    await host.render();expect(host.find('request-override').props.disabled).toBe(true);
    host.find('override-reason').props.onChange({target:{value:'Checked the instrument output'}});await host.render();
    await host.find('request-override').props.onClick();
    expect(axios.post).toHaveBeenCalledTimes(1);expect(axios.post).toHaveBeenCalledWith('/api/result-overrides/work-items/owned',{
        value:'65',replicateNo:1,basis:'AIR_DRY',equipmentId:'instrument',unit:'mg/kg',reason:'Checked the instrument output'});
});
test.each(['bad number','<0.001','6'])('ineligible %s never offers an override request',async value=>{
    const host=mountUi('components/workbench/ResultValueActions.jsx',{item:row({draft:{value}})},{axios:api([])});await host.render();
    expect(host.all().some(node=>node.props?.['data-testid']==='request-override')).toBe(false);
});
test('using a real approved request selects only its id; cancellation calls the actual request endpoint',async()=>{
    const axios=api([{id:'approval',replicateNo:1,status:'APPROVED',rawValue:'65',unit:'mg/kg',decisionReason:'Checked'}]),choose=jest.fn();
    const host=mountUi('components/workbench/ResultValueActions.jsx',{item:row(),onChooseApproval:choose},{axios});await host.render();
    host.find('use-approval').props.onClick();expect(choose).toHaveBeenCalledWith('owned','approval');expect(axios.post).not.toHaveBeenCalled();
    host.find('override-reason').props.onChange({target:{value:'Context changed'}});await host.render();await host.find('cancel-override').props.onClick();
    expect(axios.post).toHaveBeenCalledWith('/api/result-overrides/approval/cancel',{reason:'Context changed'});
});
test('dilution is absent before recording, then calls only the unchanged repeat command when server preflight permits',async()=>{
    const axios=api([]),changed=jest.fn(),props={item:row({draft:{value:'25'},valueRules:{max:100,calibrationMax:20}}),onChanged:changed};
    const host=mountUi('components/workbench/ResultValueActions.jsx',props,{axios});await host.render();
    expect(host.find('record-before-dilution')).toBeDefined();expect(host.all().some(node=>node.props?.['data-testid']==='dilute-repeat')).toBe(false);
    props.item={...props.item,currentResult:'25',dilutionOpportunity:{eligible:true,attemptId:'retained'}};await host.render(props);
    host.find('override-reason').props.onChange({target:{value:'Dilute retained aliquot'}});await host.render();await host.find('dilute-repeat').props.onClick();
    expect(axios.post).toHaveBeenCalledTimes(1);expect(axios.post).toHaveBeenCalledWith('/api/work-items/owned/repeats',{
        reason:'ABOVE_RANGE_DILUTION',note:'Dilute retained aliquot'});expect(changed).toHaveBeenCalledTimes(1);
});
test('manager queue requires a reason and a different reviewer, then sends the exact decision',async()=>{
    const axios=api([{id:'r',sampleId:'sample',analysisCode:'PH',replicateNo:1,rawValue:'65',requestedBy:'tech',status:'REQUESTED',reason:'Extreme'}]);
    const host=mountUi('components/workbench/ResultOverrideInbox.jsx',{actorId:'manager'},{axios});await host.render();
    expect(host.find('approve-r').props.disabled).toBe(true);host.find('decision-reason-r').props.onChange({target:{value:'Reviewed original worksheet'}});
    await host.render();expect(host.find('approve-r').props.disabled).toBe(false);await host.find('approve-r').props.onClick();
    expect(axios.post).toHaveBeenCalledWith('/api/result-overrides/r/decision',{status:'APPROVED',reason:'Reviewed original worksheet'});
    await host.render({actorId:'tech'});expect(host.find('approve-r').props.disabled).toBe(true);expect(host.find('reject-r').props.disabled).toBe(true);
});
test('a user without review permission cannot load the manager queue',async()=>{
    const axios=api([]),host=mountUi('components/workbench/ResultOverrideInbox.jsx',{}, {axios,canEdit:false});await host.render();
    expect(axios.get).not.toHaveBeenCalled();expect(axios.post).not.toHaveBeenCalled();
});
test('all five client/server locales contain the complete approval and dilution labels',()=>{
    const root=path.resolve(__dirname,'../../..'),keys=value=>Object.entries(value).flatMap(([key,item])=>
        typeof item==='object'?keys(item).map(child=>key+'.'+child):[key]);
    const expected=keys(require('../../../client/src/translations/en.json').overrideRequests).sort();
    for(const dir of ['client/src/translations','server/locales'])for(const locale of ['en','es','es-419','fr','pt']){
        const messages=JSON.parse(fs.readFileSync(path.join(root,dir,locale+'.json'),'utf8')).overrideRequests;
        expect(keys(messages).sort()).toEqual(expected);
    }
});
