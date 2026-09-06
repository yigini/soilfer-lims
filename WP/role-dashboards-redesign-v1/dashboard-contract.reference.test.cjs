const test=require('node:test');const assert=require('node:assert/strict');
const {canonicalRoles,scopedWhere,initialQueue,availability,groupedPage}=require('./dashboard-contract.reference.cjs');
test('all ten registered roles are represented',()=>assert.equal(new Set(canonicalRoles).size,10));
test('queue OR and selected filters preserve independent scope OR',()=>{
 const scope={OR:[{assignedLab:'A'},{labId:'A'}]},criteria={OR:[{status:'HOLD'},{status:'RECEIVED_REJECTED'}]};
 assert.deepEqual(scopedWhere(scope,criteria,{projectId:'P'}),{AND:[scope,criteria,{projectId:'P'}]});
 assert.throws(()=>scopedWhere(null));
});
test('explicit lane stays selected even when empty; invalid lane falls back to actionable final approval',()=>{
 const base={allowed:['intake','review','approve'],counts:{intake:0,review:0,approve:2},priority:['review','approve','intake'],fallback:'intake'};
 assert.equal(initialQueue({...base,explicit:'intake'}),'intake');assert.equal(initialQueue({...base,explicit:'admin'}),'approve');
 assert.equal(initialQueue({...base,remembered:'review'}),'review');assert.equal(initialQueue({...base,counts:{}}),'intake');
});
test('failed count is unavailable; genuine zero stays zero',()=>{
 assert.deepEqual(availability(0),{value:0,availability:'available'});assert.deepEqual(availability(undefined,false),{value:null,availability:'unavailable'});assert.throws(()=>availability(undefined));
});
const fixture=(id,revision=1,runId=null)=>({activeDeterminationId:id,labId:'A',analysisCode:'PH_H2O',methodologyId:'water',methodRevision:revision,inputMode:'SCALAR',runId});
test('forty determinations form one method group; QC/result rows do not inflate identity count',()=>{
 const rows=Array.from({length:40},(_,i)=>fixture('d'+i));const result=groupedPage([...rows,rows[0],rows[1]]);
 assert.equal(result.totalGroups,1);assert.equal(result.totalDeterminations,40);assert.equal(result.rows[0].determinationIds.length,40);
});
test('group before pagination, keeping methods, revisions, laboratories and existing runs separate',()=>{
 const rows=[fixture('a'),fixture('b',2),fixture('c',1,'run1'),{...fixture('d'),labId:'B'}];
 const first=groupedPage(rows,{page:1,pageSize:2}),second=groupedPage(rows,{page:2,pageSize:2});
 assert.equal(first.totalGroups,4);assert.equal(first.totalDeterminations,4);assert.equal(first.hasMore,true);assert.equal(second.hasMore,false);
 assert.equal(new Set([...first.rows,...second.rows].map(r=>r.key)).size,4);
});
test('601 active determinations are counted without preview-cap truncation',()=>assert.equal(groupedPage(Array.from({length:601},(_,i)=>fixture('d'+i))).totalDeterminations,601));
test('missing method identity is not silently merged',()=>assert.throws(()=>groupedPage([{...fixture('a'),methodRevision:null}])));
