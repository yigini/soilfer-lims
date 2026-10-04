'use strict';
const crypto = require('crypto');
const SCHEMA_VERSION = 'intake-2026-10-v1';
const LOCALES = ['en', 'es', 'es-419', 'fr', 'pt'];
const ALIASES = {container:['container','containerIntact','bagIntact'],label:['label','labelLegible'],quantity:['quantity','quantitySufficient','massAdequate'],condition:['condition','conditionGood','noLeakage'],coc:['coc','cocPresent']};
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, canonical(value[k])]));
    return value;
}
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const error = (status, code, details = {}) => Object.assign(new Error(code), {status, code, details});
const labels = (en,es,fr,pt) => ({en,es,'es-419':es,fr,pt});
const CRITERIA = [
    ['container', labels('Container intact and sealed','Envase íntegro y cerrado','Contenant intact et fermé','Recipiente intacto e fechado')],
    ['label', labels('Label legible and matches the sample','Etiqueta legible y coincidente con la muestra','Étiquette lisible et correspondant à l’échantillon','Etiqueta legível e correspondente à amostra')],
    ['quantity', labels('Quantity sufficient for requested testing','Cantidad suficiente para los ensayos solicitados','Quantité suffisante pour les essais demandés','Quantidade suficiente para os ensaios solicitados')],
    ['condition', labels('Sample condition acceptable','Estado de la muestra aceptable','État de l’échantillon acceptable','Condição da amostra aceitável')],
    ['coc', labels('Chain of custody present','Cadena de custodia presente','Chaîne de traçabilité présente','Cadeia de custódia presente')]
];
const CONTEXT = [
    {id:'receivedMass',type:'number',mapping:'receivedMass',unit:'g',min:0,max:1000000,label:labels('Received mass','Masa recibida','Masse reçue','Massa recebida')},
    {id:'moistureOnArrival',type:'choice',mapping:'moistureOnArrival',choices:['DRY','MOIST','WET','SATURATED'],label:labels('Moisture on arrival','Humedad al llegar','Humidité à l’arrivée','Humidade à chegada')},
    {id:'collectionDate',type:'date',mapping:'collectionDate',label:labels('Collection date','Fecha de muestreo','Date de prélèvement','Data de colheita')},
    {id:'depthTopCm',type:'number',mapping:'depthTopCm',unit:'cm',min:0,max:10000,label:labels('Top depth','Profundidad superior','Profondeur supérieure','Profundidade superior')},
    {id:'depthBottomCm',type:'number',mapping:'depthBottomCm',unit:'cm',min:0,max:10000,label:labels('Bottom depth','Profundidad inferior','Profondeur inférieure','Profundidade inferior')}
];
function seed(kind, matrix = 'SOIL') {
    const commercial = kind === 'COMMERCIAL';
    const research = kind === 'RESEARCH';
    return {schemaVersion:SCHEMA_VERSION,matrix,criteria:CRITERIA.map(([id,label])=>({id,label,enabled:true,required: id !== 'coc' || !research,allowed:['PASS','FAIL',...(id === 'coc' && research ? ['NA'] : [])],naOrigins:id==='coc'?['DESK_WALKIN']:[],noteOnNA:research,severity:'BLOCK',noteOnFail:false})),contextFields:matrix==='SOIL'?CONTEXT.filter(f=>!commercial||!['depthTopCm','depthBottomCm'].includes(f.id)).map(f=>({...f,enabled:true,required:false})):[]};
}
const SEEDS = [
    {id:'INTAKE-SEED-SOILFER',name:'SoilFER soil intake',kind:'SOILFER',matrix:'SOIL'},
    {id:'INTAKE-SEED-RESEARCH',name:'Research soil intake',kind:'RESEARCH',matrix:'SOIL'},
    {id:'INTAKE-SEED-COMMERCIAL',name:'Commercial soil intake',kind:'COMMERCIAL',matrix:'SOIL'},
    {id:'INTAKE-SEED-COMPATIBLE',name:'Compatible non-soil intake',kind:'SOILFER',matrix:'OTHER'}
].map(s=>({...s,revisionId:`${s.id}-1`,schema:seed(s.kind,s.matrix)}));
const MAPPINGS = new Set(CONTEXT.map(f=>f.mapping).concat(['latitude','longitude','positionalUncertaintyM','siteName','admin1','admin2','village','notes']));
function validateSchema(input, {basic = false} = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || JSON.stringify(input).length > 100000) throw error(422,'INVALID_INTAKE_SCHEMA');
    if (Object.keys(input).some(k=>!['schemaVersion','matrix','criteria','contextFields'].includes(k))) throw error(422,'UNSUPPORTED_SCHEMA_PROPERTY');
    if (input.schemaVersion !== SCHEMA_VERSION || !/^[A-Z][A-Z0-9_]{0,39}$/.test(input.matrix || '')) throw error(422,'INVALID_INTAKE_SCHEMA');
    for (const [kind,list] of [['criteria',input.criteria],['contextFields',input.contextFields]]) {
        if (!Array.isArray(list) || list.length > 64) throw error(422,'INVALID_INTAKE_SCHEMA');
        const ids = new Set();
        for (const entry of list) {
            const catalogue = kind==='criteria'?Object.keys(ALIASES):CONTEXT.map(f=>f.id);
            if (!entry || typeof entry!=='object' || !/^(?:[a-z][A-Za-z0-9_]{0,60}|custom:[a-z][a-z0-9_-]{0,60})$/.test(entry.id || '') || ids.has(entry.id)) throw error(422,'INVALID_SCHEMA_ID');
            ids.add(entry.id);
            if (basic && !catalogue.includes(entry.id)) throw error(422,'CUSTOM_FIELDS_REQUIRE_EDITOR');
            const properties = ['id','label','help','enabled','required','origins','matrices',...(kind==='criteria'?['allowed','naOrigins','noteOnNA','noteOnFail','severity']:['type','mapping','unit','min','max','maxLength','choices'])];
            if (Object.keys(entry).some(k=>!properties.includes(k))) throw error(422,'UNSUPPORTED_FIELD_PROPERTY',{id:entry.id});
            for (const key of ['enabled','required','noteOnNA','noteOnFail']) if (entry[key] !== undefined && typeof entry[key] !== 'boolean') throw error(422,'INVALID_FIELD_PROPERTY',{id:entry.id});
            for (const key of ['label','help']) {
                if (key==='label' && (!entry.label || typeof entry.label.en !== 'string' || !entry.label.en.trim())) throw error(422,'MISSING_FIELD_LABEL',{id:entry.id});
                if (entry[key] && (Array.isArray(entry[key]) || Object.entries(entry[key]).some(([lang,text])=>!LOCALES.includes(lang) || typeof text!=='string' || text.length>1000 || /[<>\x00-\x08\x0b\x0c]/.test(text)))) throw error(422,'UNSAFE_FIELD_LABEL',{id:entry.id});
            }
            for (const key of ['origins','matrices','naOrigins']) if (entry[key] && (!Array.isArray(entry[key]) || entry[key].length>20 || entry[key].some(v=>typeof v!=='string'||!/^[A-Z][A-Z0-9_]{0,39}$/.test(v)))) throw error(422,'INVALID_APPLICABILITY',{id:entry.id});
            if (kind==='criteria') {
                if (!Array.isArray(entry.allowed) || !entry.allowed.length || entry.allowed.some(v=>!['PASS','FAIL','NA'].includes(v)) || !['BLOCK','WARNING'].includes(entry.severity)) throw error(422,'INVALID_CRITERION',{id:entry.id});
            } else {
                if (!['text','textarea','number','date','boolean','choice'].includes(entry.type) || (entry.mapping && !MAPPINGS.has(entry.mapping)) || (entry.id.startsWith('custom:') && entry.mapping)) throw error(422,'UNSAFE_CONTEXT_MAPPING',{id:entry.id});
                if (entry.unit && (typeof entry.unit!=='string'||entry.unit.length>20||/[<>]/.test(entry.unit))) throw error(422,'INVALID_FIELD_UNIT');
                for(const key of ['min','max']) if(entry[key]!==undefined&&!Number.isFinite(entry[key])) throw error(422,'INVALID_FIELD_BOUNDS');
                if(entry.min!==undefined&&entry.max!==undefined&&entry.min>entry.max) throw error(422,'INVALID_FIELD_BOUNDS');
                if(entry.maxLength!==undefined&&(!Number.isInteger(entry.maxLength)||entry.maxLength<1||entry.maxLength>10000)) throw error(422,'INVALID_FIELD_BOUNDS');
                if(entry.type==='choice'&&(!Array.isArray(entry.choices)||!entry.choices.length||entry.choices.length>50||entry.choices.some(v=>typeof v!=='string'||v.length>100||/[<>]/.test(v)))) throw error(422,'INVALID_FIELD_CHOICES');
            }
        }
    }
    return canonical(input);
}
function applicable(entry, context) {return entry.enabled !== false && (!entry.origins?.length || entry.origins.includes(context.origin)) && (!entry.matrices?.length || entry.matrices.includes(context.matrix));}
function normalizeStatus(val) {
    if(typeof val==='boolean') return {status:val?'PASS':'FAIL',note:''};
    const raw=typeof val==='object'&&val?val.status:val;
    const status=typeof raw==='string'?raw.trim().toUpperCase():'';
    return {status:status==='OK'?'PASS':status==='N/A'?'NA':status,note:typeof val?.note==='string'?val.note.slice(0,4000):''};
}
function evaluate(schema, checklist, contextAnswers = {}, context = {}) {
    const items=checklist?.items ?? checklist ?? {};
    if(!items||typeof items!=='object'||Array.isArray(items)||!contextAnswers||typeof contextAnswers!=='object'||Array.isArray(contextAnswers)) throw error(422,'INVALID_INTAKE_ANSWERS');
    const failedItems=[],unansweredItems=[],invalidNAItems=[],unknownItems=[],resolvedItems={},fieldErrors={},values={};
    const known=new Set(['reason','nonConformance','notes','photos']);
    for(const rule of schema.criteria) {
        (ALIASES[rule.id]||[rule.id]).forEach(k=>known.add(k));
        if(!applicable(rule,context)) continue;
        const candidates=(ALIASES[rule.id]||[rule.id]).filter(k=>Object.hasOwn(items,k)).map(k=>normalizeStatus(items[k]));
        if(candidates.some(v=>v.status && !['PASS','FAIL','NA'].includes(v.status))) fieldErrors[rule.id]='INVALID_STATUS';
        const chosen=candidates.find(v=>v.status==='FAIL')||candidates.find(v=>v.status==='NA')||candidates.find(v=>v.status==='PASS')||candidates[0]||{status:'',note:''};
        resolvedItems[rule.id]=chosen;
        if(!chosen.status) {if(rule.required) unansweredItems.push(rule.id);continue;}
        if(chosen.status==='NA'&&!rule.allowed.includes('NA')&&!rule.naOrigins?.includes(context.origin)) invalidNAItems.push(rule.id);
        else if(!['PASS','FAIL','NA'].includes(chosen.status)||(!rule.allowed.includes(chosen.status)&&chosen.status!=='NA')) fieldErrors[rule.id]='INVALID_STATUS';
        if((chosen.status==='NA'&&rule.noteOnNA||chosen.status==='FAIL'&&rule.noteOnFail)&&!chosen.note.trim()) fieldErrors[rule.id]='NOTE_REQUIRED';
        if(chosen.status==='FAIL') failedItems.push({key:rule.id,note:chosen.note,severity:rule.severity});
    }
    Object.keys(items).filter(k=>!known.has(k)).forEach(k=>unknownItems.push(k));
    const fields=new Map(schema.contextFields.map(f=>[f.id,f]));
    for(const key of Object.keys(contextAnswers)) if(!fields.has(key)) fieldErrors[key]='UNKNOWN_FIELD';
    for(const f of schema.contextFields) {
        if(!applicable(f,context)) continue;
        let val=contextAnswers[f.id];
        if(val===null||val===undefined||val==='') {if(f.required) fieldErrors[f.id]='REQUIRED';continue;}
        if(f.type==='number') {
            // API stores canonical numbers; UI normalizes locale notation before submission.
            if(typeof val!=='number'||!Number.isFinite(val)||f.min!==undefined&&val<f.min||f.max!==undefined&&val>f.max) {fieldErrors[f.id]='INVALID_NUMBER';continue;}
        } else if(f.type==='boolean') {if(typeof val!=='boolean') {fieldErrors[f.id]='INVALID_BOOLEAN';continue;}}
        else if(typeof val!=='string'||val.length>(f.maxLength||4000)) {fieldErrors[f.id]='INVALID_TEXT';continue;}
        else if(f.type==='choice'&&!f.choices.includes(val)) {fieldErrors[f.id]='INVALID_CHOICE';continue;}
        else if(f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(val)||Number.isNaN(Date.parse(val))||new Date(val).toISOString().slice(0,10)!==val)) {fieldErrors[f.id]='INVALID_DATE';continue;}
        values[f.id]=val;
    }
    if(checklist?.nonConformance&&!failedItems.length) failedItems.push({key:'general',note:checklist.reason||'',severity:'BLOCK'});
    const isComplete=!unansweredItems.length&&!unknownItems.length&&!Object.keys(fieldErrors).length;
    return {isProvided:!!checklist&&(Object.keys(items).length>0||!!checklist.nonConformance),isComplete,isPassed:isComplete&&!invalidNAItems.length&&!failedItems.some(f=>f.severity==='BLOCK'),failedItems,unansweredItems,invalidNAItems,unknownItems,resolvedItems,fieldErrors,contextAnswers:values};
}
module.exports={SCHEMA_VERSION,LOCALES,ALIASES,CONTEXT,SEEDS,seed,hash,canonical,error,validateSchema,evaluate,applicable};
