const { TransitionError } = require('./workflowStateRules');
const { TEXTURE_ALIASES } = require('./reportResultGovernance');
const FRACTIONS = Object.freeze(['SAND','SILT','CLAY']);
const fail = (code,message,details={}) => new TransitionError(message,409,code,details);
const json = value => { try {return typeof value==='string'?JSON.parse(value):value;} catch {return null;} };
const sorted = ids => [...ids].sort();

function derivationSources(result,attempt) {
    const flags=json(result.flags ?? []), evidence=json(attempt.evidenceData);
    if(!Array.isArray(flags)) return null;
    const links=flags.filter(flag=>typeof flag==='string' && flag.startsWith('SOURCE_'));
    if(links.length) {
        if(links.length!==3 || FRACTIONS.some(param=>links.filter(flag=>flag.startsWith('SOURCE_'+param+'_')).length!==1)) return null;
        return FRACTIONS.map(param=>links.find(flag=>flag.startsWith('SOURCE_'+param+'_')).slice(('SOURCE_'+param+'_').length));
    }
    const ids=evidence?.measurements?.find(row=>row.resultId===result.id)?.sourceResultIds || evidence?.sourceResultIds;
    return Array.isArray(ids) && ids.length===3 && new Set(ids).size===3 ? ids : null;
}

// Layout is inferred exclusively from retained ownership and derivation links.
// No analysis alias, reviewer payload, or missing fraction is guessed.
async function textureLayout(tx,item,evidence) {
    if(!TEXTURE_ALIASES.has(item.analysis)) return {kind:'SCALAR',outputParams:[item.analysis]};
    const items=await tx.workItem.findMany({where:{sampleId:item.sampleId,duplicateOf:null}});
    const involved=items.filter(row=>TEXTURE_ALIASES.has(row.analysis) || FRACTIONS.includes(row.analysis));
    const unsupported=()=>fail('REPORTED_VALUE_LAYOUT_UNSUPPORTED','The retained texture layout cannot be resolved.',
        {workItemIds:sorted(involved.map(row=>row.id))});
    const rows=evidence.lineage.eligible.flatMap(row=>row.results), params=new Set(rows.map(row=>row.param));
    const fractionItems=items.filter(row=>FRACTIONS.includes(row.analysis));
    if(involved.filter(row=>TEXTURE_ALIASES.has(row.analysis)).length!==1 || !rows.length) throw unsupported();
    if(params.size===4 && ['TEXTURE',...FRACTIONS].every(param=>params.has(param)) && !fractionItems.length &&
        evidence.lineage.eligible.every(candidate=>['TEXTURE',...FRACTIONS].every(param=>candidate.results.some(row=>row.param===param)))) {
        return {kind:'COMPOSITE',outputParams:['CLAY','SAND','SILT','TEXTURE']};
    }
    if(params.size!==1 || !params.has('TEXTURE') || fractionItems.length!==3 ||
        FRACTIONS.some(param=>fractionItems.filter(row=>row.analysis===param).length!==1)) throw unsupported();
    const sources={};
    const lab=evidence.sample.assignedLab || evidence.sample.labId;
    for(const candidate of evidence.lineage.eligible) for(const row of candidate.results) {
        const ids=derivationSources(row,candidate.attempt);
        if(!ids || ids.some(id=>typeof id!=='string' || !id) || new Set(ids).size!==3) throw unsupported();
        const fractions=await tx.result.findMany({where:{id:{in:ids}}});
        if(fractions.length!==3 || FRACTIONS.some(param=>fractions.filter(result=>result.param===param).length!==1)) throw unsupported();
        for(const source of fractions) {
            const owner=fractionItems.find(owner=>owner.analysis===source.param), attempt=await tx.workAttempt.findUnique({where:{id:source.attemptId || ''}});
            if(source.sampleId!==item.sampleId || !attempt || attempt.workItemId!==owner.id ||
                (owner.assignedLab || owner.labId || lab)!==lab) throw unsupported();
        }
        sources[row.id]=sorted(ids);
    }
    return {kind:'SEPARATE',outputParams:['TEXTURE'],fractionItems:FRACTIONS.map(param=>fractionItems.find(row=>row.analysis===param)),sources};
}

async function fractionSelections(tx,layout) {
    const fractions=[];
    for(const item of layout.fractionItems) {
        let saved;
        try {saved=await require('./reportedValueSelectionService').readReportedSelection(tx,item);}
        catch(error) {
            if(['REPORTED_VALUE_SELECTION_REQUIRED','REPORTED_VALUE_STALE','REPORTED_VALUE_LINEAGE_INVALID'].includes(error.code)) {
                throw fail('REPORTED_VALUE_SOURCE_SELECTION_REQUIRED','Choose a current reported value for every texture fraction first.',
                    {workItemIds:layout.fractionItems.map(row=>row.id),fraction:item.analysis});
            }
            throw error;
        }
        if(item.status!=='ACCEPTED' || saved.rows.length!==1 || saved.rows[0].analysisCode!==item.analysis) {
            throw fail('REPORTED_VALUE_SOURCE_SELECTION_REQUIRED','Accept and select every texture fraction first.',{workItemIds:[item.id]});
        }
        const row=saved.rows[0], selection={mode:row.mode,rule:row.rule,reason:row.reason,attemptIds:json(row.attemptIds)};
        const checked=await require('./reportedValueSourceService').validateReportedSources(tx,item,saved.context,selection);
        const ids=json(row.resultIds), cited=checked.sources.filter(source=>ids.includes(source.id));
        if(cited.length!==ids.length || new Set(ids).size!==ids.length || cited.some(source=>source.param!==item.analysis || source.sampleId!==item.sampleId)) {
            throw fail('REPORTED_VALUE_SOURCE_SELECTION_REQUIRED','The fraction selection has unresolved source evidence.',{workItemIds:[item.id]});
        }
        fractions.push({item,saved,checked,cited,proof:{analysisCode:item.analysis,workItemId:item.id,selectionId:row.id,
            selectionGroupId:row.selectionGroupId,mode:row.mode,value:row.value,valueText:row.valueText,unit:row.unit,
            censoring:row.censoring,resultIds:sorted(ids)}});
    }
    return fractions;
}

function fractionOutcome(context) {
    const fractions=context.fractions, proofs=fractions.map(row=>row.proof);
    const missing=proofs.filter(row=>row.mode==='NOT_REPORTABLE');
    if(missing.length) return {mode:'NOT_REPORTABLE',attemptIds:[],rule:'AUTO_DERIVED_FROM_FRACTIONS',
        reason:JSON.stringify({code:'FRACTION_NOT_REPORTABLE',fractions:missing.map(row=>({analysisCode:row.analysisCode,selectionId:row.selectionId}))}),
        fractionSelections:proofs,outputs:[{analysisCode:'TEXTURE',value:null,valueText:'',unit:null,censoring:'NONE',
            methodologyId:null,resultIds:[],derivation:'calculateUsdaTexture'}]};
    const value=require('../utils/soilCalculations').calculateUsdaTexture(...FRACTIONS.map(param=>proofs.find(row=>row.analysisCode===param).value));
    if(proofs.some(row=>row.censoring!=='NONE' || row.value===null || !Number.isFinite(row.value)) || !value.isValid) {
        throw fail('REPORTED_VALUE_TEXTURE_UNRESOLVED','The selected fraction values cannot produce a texture class.');
    }
    const sourceIds=sorted(fractions.flatMap(row=>row.proof.resultIds));
    if(new Set(sourceIds).size!==sourceIds.length) throw fail('REPORTED_VALUE_SOURCE_SELECTION_REQUIRED','Fraction source sets must be disjoint.');
    const replicas=fractions.map(row=>row.cited.length===1 ? row.cited[0].replicateNo ?? 1 : null);
    const matches=replicas.every(row=>row!==null && row===replicas[0]) ? context.lineage.eligible.flatMap(candidate=>
        candidate.results.filter(row=>JSON.stringify(context.layout.sources[row.id])===JSON.stringify(sourceIds))
            .map(result=>({result,attempt:candidate.attempt}))) : [];
    const matching=matches.length===1 ? matches[0] : null;
    const output={analysisCode:'TEXTURE',value:null,valueText:value.className,unit:null,censoring:'NONE',methodologyId:null,
        resultIds:sourceIds,derivation:'calculateUsdaTexture'};
    return {mode:'DERIVED',attemptIds:[],rule:'AUTO_DERIVED_FROM_FRACTIONS',reason:null,fractionSelections:proofs,
        outputs:[output],matching};
}

function separateTextureChoice(context,explicit,{allowMissingReason=false}={}) {
    const derived=fractionOutcome(context), matching=derived.matching;
    if(explicit!=null) {
        if(typeof explicit!=='object' || !['DERIVED','ATTEMPT','NOT_REPORTABLE'].includes(explicit.mode) ||
            Object.keys(explicit).some(key=>!['mode','attemptIds','reason'].includes(key)) ||
            explicit.reason!=null && typeof explicit.reason!=='string') throw fail('REPORTED_VALUE_SELECTION_INVALID','Choose the matching texture result or the selected-fraction derivation.');
        if(explicit.mode==='NOT_REPORTABLE') {
            if(!explicit.reason?.trim() || explicit.attemptIds!=null && (!Array.isArray(explicit.attemptIds) || explicit.attemptIds.length)) {
                throw fail('REPORTED_VALUE_SELECTION_INVALID','Not reportable needs a reason and no attempts.');
            }
            return {mode:'NOT_REPORTABLE',attemptIds:[],rule:'REVIEWER',reason:explicit.reason.trim(),fractionSelections:derived.fractionSelections,
                outputs:[{analysisCode:'TEXTURE',value:null,valueText:'',unit:null,censoring:'NONE',methodologyId:null,resultIds:[],derivation:null}]};
        }
        if(explicit.mode==='DERIVED' && explicit.attemptIds!=null && (!Array.isArray(explicit.attemptIds) || explicit.attemptIds.length) ||
            explicit.mode==='ATTEMPT' && (!matching || !Array.isArray(explicit.attemptIds) || explicit.attemptIds.length!==1 || explicit.attemptIds[0]!==matching.attempt.id)) {
            throw fail('REPORTED_VALUE_SELECTION_INVALID','The chosen attempt is not the exact matching texture result.');
        }
        if(!allowMissingReason && matching?.attempt.status==='QUESTIONED' && !explicit.reason?.trim()) throw fail('REPORTED_VALUE_REASON_REQUIRED','Explain the questioned texture choice.');
        if(explicit.mode==='DERIVED') return {...derived,rule:'REVIEWER',reason:derived.mode==='NOT_REPORTABLE'?derived.reason:explicit.reason?.trim() || null};
        return matchedChoice(derived,matching,'REVIEWER',explicit.reason?.trim() || null);
    }
    if(context.policy.value==='REVIEWER_PICKS' || context.lineage.eligible.some(row=>row.attempt.status==='QUESTIONED')) {
        throw fail('REPORTED_VALUE_SELECTION_REQUIRED','Choose the reported texture value explicitly.');
    }
    if(!['MEAN_IF_WITHIN_R','LATEST_VALID'].includes(context.policy.value)) throw fail('RESULT_POLICY_UNRESOLVED','The reported-value policy could not be resolved.');
    return matching ? matchedChoice(derived,matching,'AUTO_SINGLE',null) : derived;
}
function matchedChoice(derived,matching,rule,reason) {
    const row=matching.result;
    return {mode:'ATTEMPT',attemptIds:[matching.attempt.id],rule,reason,fractionSelections:derived.fractionSelections,
        outputs:[{analysisCode:'TEXTURE',value:null,valueText:row.value,unit:row.unit ?? null,censoring:row.censoring ?? 'NONE',
            methodologyId:row.methodologyId ?? null,resultIds:[row.id],derivation:'calculateUsdaTexture'}]};
}
function assertFractionSnapshot(context,rows) {
    if(context.layout.kind!=='SEPARATE') return;
    const stored=json(rows[0].evidenceSnapshot), current=context.fractions.map(row=>row.proof);
    if(JSON.stringify(stored?.fractionSelections)!==JSON.stringify(current)) throw fail('REPORTED_VALUE_STALE','The texture fraction selections changed.');
    if(rows[0].mode==='DERIVED') {
        const union=sorted(current.flatMap(row=>row.resultIds)), ids=json(rows[0].resultIds);
        if(!Array.isArray(ids) || JSON.stringify(ids)!==JSON.stringify(union)) throw fail('REPORTED_VALUE_STALE','The texture derivation source set differs.');
    }
}
module.exports={textureLayout,fractionSelections,separateTextureChoice,assertFractionSnapshot};
