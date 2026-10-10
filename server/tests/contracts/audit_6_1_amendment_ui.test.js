const fs=require('node:fs'),path=require('node:path');
const {mountUi}=require('../helpers/qcWorksheetUi');
const pending={id:'full-amendment-uuid',type:'SCIENTIFIC',reason:'Review the original reading',status:'PENDING',version:1,createdBy:'requester',selectedWorkItemIds:'["accepted"]'};
function mount({canEdit=true,user='authoriser',requiresSecondPerson=true,amendments=[pending],axios:provided}={}){
 const axios=provided||{get:jest.fn(async()=>({data:{amendments,requiresSecondPerson}})),post:jest.fn(async()=>({data:{amendment:{...pending,status:'APPROVED',version:2}}}))};
 return mountUi('components/sample/AmendmentDialog.jsx',{sampleId:'owned-sample',sampleStatus:'APPROVED',initialType:'SCIENTIFIC',onClose:jest.fn(),onChanged:jest.fn(),
  workItems:[{id:'accepted',analysis:'PH_H2O',status:'ACCEPTED'},{id:'unfinished',analysis:'SOC',status:'IN_PROGRESS'},{id:'duplicate',analysis:'TN',status:'ACCEPTED',duplicateOf:'parent'}]},
  {canEdit,user:{username:user},axios});
}
const button=(view,label)=>view.all().find(node=>node.type==='button'&&node.props.children===label);
test('actual dialog requests only selected accepted lines and keeps the reason and request separate from authorisation',async()=>{
 const view=mount({amendments:[]});await view.render();
 const checks=view.all().filter(node=>node.type==='input'&&node.props.type==='checkbox');expect(checks).toHaveLength(1);
 checks[0].props.onChange({target:{checked:true}});view.all().find(node=>node.type==='textarea').props.onChange({target:{value:' Confirm against original worksheet '}});
 await view.render();await button(view,'amendment.request').props.onClick();await view.render();
 expect(view.axios.post).toHaveBeenCalledTimes(1);expect(view.axios.post).toHaveBeenCalledWith('/api/samples/owned-sample/amendments',
  expect.objectContaining({type:'SCIENTIFIC',reason:'Confirm against original worksheet',reasonCode:'CLIENT_RETEST',selectedWorkItemIds:['accepted'],idempotencyKey:expect.any(String)}));
 expect(view.text()).toContain('amendment.pendingNotice');expect(view.props.onChanged).toHaveBeenCalledTimes(1);view.unmount();
});
test('a requester waits for a second person while the lab self-authorisation policy enables the same button',async()=>{
 const second=mount({user:'requester'});await second.render();expect(button(second,'amendment.authorise').props.disabled).toBe(true);expect(second.text()).toContain('amendment.awaitOther');second.unmount();
 const advisory=mount({user:'requester',requiresSecondPerson:false});await advisory.render();expect(button(advisory,'amendment.authorise').props.disabled).toBe(false);expect(advisory.text()).toContain('amendment.selfAllowed');advisory.unmount();
});
test('an authoriser sends the persisted request version and retains the full UUID',async()=>{
 const view=mount();await view.render();expect(view.text()).toContain(pending.id);await button(view,'amendment.authorise').props.onClick();await view.render();
 expect(view.axios.post).toHaveBeenCalledWith('/api/samples/owned-sample/amendments/'+pending.id+'/authorise',
  expect.objectContaining({expectedVersion:1,idempotencyKey:expect.any(String)}));expect(view.text()).toContain('amendment.authorisedNotice');view.unmount();
});
test('permission loss prevents reading amendment requests and sends no mutation',async()=>{
 const view=mount({canEdit:false});await view.render();expect(view.axios.get).not.toHaveBeenCalled();expect(view.axios.post).not.toHaveBeenCalled();
 expect(button(view,'amendment.authorise')).toBeUndefined();expect(view.text()).toContain('amendment.permission');view.unmount();
});
test('an authorisation refusal preserves the request and permits an idempotent retry',async()=>{
 const view=mount();view.axios.post.mockRejectedValueOnce({response:{data:{error:'Owned stale request refusal'}}});await view.render();
 await button(view,'amendment.authorise').props.onClick();await view.render();expect(view.text()).toContain('Owned stale request refusal');expect(view.text()).toContain(pending.reason);
 const first=view.axios.post.mock.calls[0][1];await button(view,'amendment.authorise').props.onClick();await view.render();
 expect(view.axios.post.mock.calls[1][1].idempotencyKey).toBe(first.idempotencyKey);view.unmount();
});
test.each(['en','es','es-419','fr','pt'])('amendment workflow notices and labels are present in %s without changing old keys',locale=>{
 const client=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../client/src/translations',locale+'.json'),'utf8')).amendment;
 const server=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../locales',locale+'.json'),'utf8')).amendment;
 for(const key of ['title','help','permission','secondPerson','selfAllowed','type','repeatReason','selectedLines','noLines','reason','request','history','empty','requester','authoriser','authorise','awaitOther','pendingNotice','authorisedNotice','failed'])expect(client[key].trim()).not.toBe('');
 for(const type of ['CLERICAL','SCIENTIFIC','ORDER','REPORT'])expect(client.types[type].trim()).not.toBe('');
 for(const key of ['pending','authorised','failed'])expect(server[key].trim()).not.toBe('');
});
