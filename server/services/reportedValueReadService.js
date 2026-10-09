const rules = require('./workflowStateRules');
const { readReportedSelection } = require('./reportedValueSelectionService');
const { validateReportedSources } = require('./reportedValueSourceService');

async function readSampleReportedValues(db,sample,{partial=false}={}) {
    return rules.inTransaction(db,async tx => {
        const items = sample.workItems || await tx.workItem.findMany({where:{sampleId:sample.id},orderBy:{id:'asc'}});
        const groups = [], values = [], sourceResults = [], errors = [], batches = new Map(), qcGates = {}, qcAcknowledgements = {}, workItemsByResult = {};
        for (const item of items.filter(row => row.status==='ACCEPTED' && !row.duplicateOf && !require('./workItemKinds').isNonMeasurement(row))) {
            try {
            const saved = await readReportedSelection(tx,item), first = saved.rows[0];
            const selection = { rule:first.rule,mode:first.mode,attemptIds:JSON.parse(first.attemptIds),reason:first.reason };
            const proof = await validateReportedSources(tx,item,saved.context,selection);
            groups.push({workItemId:item.id,selectionGroupId:first.selectionGroupId,mode:first.mode,reason:first.reason,
                selectedBy:first.selectedBy,selectedAt:first.selectedAt,rule:first.rule,policyVersion:first.policyVersion,rows:saved.rows});
            sourceResults.push(...proof.sources); proof.batches.forEach(row => batches.set(row.id,row));
            Object.assign(qcGates,proof.qcGates); Object.assign(qcAcknowledgements,proof.qcAcknowledgements);
            Object.assign(workItemsByResult,proof.workItemsByResult);
            for (const row of saved.rows) {
                const ids = JSON.parse(row.resultIds), sources = proof.sources.filter(source => ids.includes(source.id));
                const provenance = [...new Set(sources.map(source => source.provenance))];
                const bases = [...new Set(sources.map(source => source.basis))];
                values.push({ id:row.id,selectionId:row.id,selectionGroupId:row.selectionGroupId,workItemId:item.id,sampleId:item.sampleId,
                    param:row.analysisCode,value:row.valueText,numericValue:row.value,unit:row.unit,censoring:row.censoring,
                    methodologyId:row.methodologyId,mode:row.mode,reason:row.reason,rule:row.rule,policyVersion:row.policyVersion,
                    policyRule:row.policyRule,policySource:JSON.parse(row.evidenceSnapshot).policy?.source || null,
                    sourceResultIds:ids,attemptIds:selection.attemptIds,provenance:provenance.length===1 ? provenance[0] : null,
                    basis:bases.length===1 ? bases[0] : null,flags:[],isValid:true,
                    ...(row.derivation && {provenance:'DERIVED'}) });
            }
            } catch(error) {
                error.details={...error.details,workItemId:item.id};
                if(!partial || !['REPORTED_VALUE_SELECTION_REQUIRED','REPORTED_VALUE_STALE'].includes(error.code)) throw error;
                errors.push({sampleId:sample.id,workItemId:item.id,analysisCode:item.analysis,code:error.code,error:error.message});
            }
        }
        return {groups,values,sourceResults,errors,qcBatches:[...batches.values()],qcGates,qcAcknowledgements,workItemsByResult};
    });
}
function reportedValueText(row,locale='en') {
    if(row.mode!=='NOT_REPORTABLE') return row.value;
    const canonical=['en','es','es-419','fr','pt'].includes(locale)?locale:'en';
    const messages=require('../locales/'+canonical+'.json').reportedValue;
    let reason=row.reason;
    try {
        const stored=JSON.parse(reason);
        if(stored.code==='FRACTION_NOT_REPORTABLE' && Array.isArray(stored.fractions)) reason=stored.fractions.map(fraction=>
            messages.fractionNotReportable.replace('{{fraction}}',fraction.analysisCode).replace('{{selectionId}}',fraction.selectionId)).join(' ');
    } catch { /* Reviewer reasons remain their recorded text. */ }
    return messages.notReportable+': '+reason;
}
// Raw observations disclose membership without changing their row contract or
// requiring a publishable outcome. Stale or absent selections disclose null.
async function rawSelectionIds(db,results) {
    return rules.inTransaction(db,async tx=>{
        const output={}, owners={}, ids=new Set(results.map(row=>row.id));
        const selections=await tx.reportedValueSelection.findMany({where:{workItem:{sampleId:{in:[...new Set(results.map(row=>row.sampleId))]}}},orderBy:{workItemId:'asc'}});
        const workItemIds=[...new Set(selections.map(row=>row.workItemId))];
        for(const workItemId of workItemIds) {
            const item=await tx.workItem.findUnique({where:{id:workItemId}});
            let saved;
            try {saved=await readReportedSelection(tx,item);}
            catch(error) {
                if(['REPORTED_VALUE_STALE','REPORTED_VALUE_SELECTION_REQUIRED','REPORTED_VALUE_LINEAGE_INVALID'].includes(error.code)) continue;
                throw error;
            }
            for(const result of results.filter(row=>ids.has(row.id))) {
                const candidates=saved.rows.filter(row=>JSON.parse(row.resultIds).includes(result.id));
                const row=candidates.find(row=>row.analysisCode===result.param) || candidates[0];
                const own=row?.analysisCode===result.param;
                if(row && (output[result.id]===undefined || own && !owners[result.id])) {
                    output[result.id]=row.id; owners[result.id]=own;
                }
            }
        }
        return output;
    });
}
module.exports = { readSampleReportedValues, reportedValueText, rawSelectionIds };
