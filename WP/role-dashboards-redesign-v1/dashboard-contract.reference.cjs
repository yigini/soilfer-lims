// Reference-only proposed contract primitives. No database or application imports.
// Adopt through the implementation plan with actual server authorization/eligibility.
'use strict';
const canonicalRoles = ['SUPER_ADMIN','MASTER_USER','PROJECT_MANAGER','LAB_MANAGER','SAMPLE_RECEPTION','LAB_TECHNICIAN','SURVEYOR','AUDIT_USER','EXTERNAL_VIEWER','VIEWER'];
function scopedWhere(authorizedScope, queueCriteria={}, selectedFilters={}) {
  if (!authorizedScope || typeof authorizedScope !== 'object') throw new Error('An explicit authorized scope is required');
  // An empty scope is valid ONLY after the server resolves a privileged global view.
  return {AND:[authorizedScope,queueCriteria,selectedFilters]};
}
function initialQueue({allowed,explicit,remembered,priority,counts,fallback}) {
  if(allowed.includes(explicit))return explicit;
  if(allowed.includes(remembered))return remembered;
  return priority.find(k=>allowed.includes(k)&&Number.isFinite(counts[k])&&counts[k]>0)||fallback;
}
function availability(value,available=true) {
  if(!available)return {value:null,availability:'unavailable'};
  if(!Number.isFinite(value)||value<0)throw new Error('A known non-negative count is required');
  return {value,availability:'available'};
}
function methodGroupKey(w) {
  const fields=['labId','analysisCode','methodologyId','methodRevision','inputMode'];
  if(fields.some(k=>w[k]===undefined||w[k]===null))throw new Error('Resolve method identity before grouping');
  return JSON.stringify([...fields.map(k=>w[k]),w.runId||null]);
}
function groupedPage(eligibleDeterminations,{page=1,pageSize=25}={}) {
  if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw new Error('Invalid pagination');
  const seen=new Set(),groups=new Map();
  for(const w of eligibleDeterminations){
    if(!w.activeDeterminationId)throw new Error('Current determination identity is required');
    if(seen.has(w.activeDeterminationId))continue; // component/replicate evidence never multiplies work
    seen.add(w.activeDeterminationId);
    const key=methodGroupKey(w);if(!groups.has(key))groups.set(key,{key,determinationIds:[]});
    groups.get(key).determinationIds.push(w.activeDeterminationId);
  }
  const ordered=[...groups.values()].sort((a,b)=>a.key.localeCompare(b.key));
  return {rows:ordered.slice((page-1)*pageSize,page*pageSize),totalGroups:ordered.length,totalDeterminations:seen.size,page,pageSize,hasMore:page*pageSize<ordered.length};
}
module.exports={canonicalRoles,scopedWhere,initialQueue,availability,methodGroupKey,groupedPage};
