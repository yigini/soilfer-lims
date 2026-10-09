const { sourceValidity } = require('../../services/reportedValueSourceService');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const rules = require('../../services/workflowStateRules');
const { appendReportedSelection } = require('../../services/reportedValueSelectionService');
const { readSampleReportedValues } = require('../../services/reportedValueReadService');
const owned=[];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });

test.each([
    {flags:['REVIEW_RETURNED'],valid:false,rule:'REVIEWER',mode:'REQUIRED_BLOCKING',allowed:true},
    {flags:['REVIEW_RETURNED'],valid:false,rule:'AUTO_SINGLE',mode:'OFF',allowed:false},
    {flags:['REVIEW_RETURNED','MANUAL_INVALID'],valid:false,rule:'REVIEWER',mode:'OFF',allowed:false},
    {flags:['REVIEW_RETURNED','MANUAL_INVALID'],valid:true,rule:'REVIEWER',mode:'OFF',allowed:false},
    {flags:['REVIEW_RETURNED','QC_BATCH_FAILED'],valid:false,rule:'REVIEWER',mode:'REQUIRED_BLOCKING',allowed:false},
    {flags:['REVIEW_RETURNED','QC_BATCH_FAILED'],valid:false,rule:'REVIEWER',mode:'REQUIRED_WARN',allowed:true},
    {flags:['REVIEW_RETURNED','QC_BATCH_REJECTED'],valid:false,rule:'REVIEWER',mode:'OFF',allowed:false},
    {flags:['REVIEW_RETURNED','QC_BATCH_FAILED','MANUAL_INVALID'],valid:false,rule:'REVIEWER',mode:'ADVISORY',allowed:false},
    {flags:'{broken',valid:true,rule:'REVIEWER',mode:'OFF',allowed:false}
])('retained source keeps invalidity checks $flags/$rule/$mode',({flags,valid,rule,mode,allowed}) => {
    expect(sourceValidity({isCurrent:false,isValid:valid,flags:typeof flags==='string'?flags:JSON.stringify(flags)}, {rule},mode)).toBe(allowed);
});

test.each(['REQUIRED_BLOCKING','REQUIRED_WARN','ADVISORY','OFF'])('a QC override cannot make independently invalid source evidence reportable (%s)',mode=>{
    const result={isCurrent:true,isValid:false,flags:'["QC_WARNING_OVERRIDDEN"]'};
    expect(sourceValidity(result,{rule:'AUTO_SINGLE'},mode)).toBe(false);
    expect(sourceValidity(result,{rule:'REVIEWER'},mode)).toBe(false);
    expect(sourceValidity({...result,isValid:true},{rule:'AUTO_SINGLE'},mode)).toBe(true);
});

test('required QC on the selected source refuses append with zero writes',async () => {
    const f=await qcGateFixture({status:'ACCEPTED'}); owned.push(f); await f.result(f.items[0]);
    const before=await f.snapshot();
    await expect(rules.inTransaction(f.db,tx=>appendReportedSelection(tx,f.items[0],f.actor)))
        .rejects.toMatchObject({code:'REPORTED_VALUE_SOURCE_QC_BLOCKED',details:{qcCode:'QC_GATE_NO_BATCH'}});
    expect(await f.snapshot()).toEqual(before); expect(await f.db.reportedValueSelection.count()).toBe(0);
});

test('fresh not-reportable reads a reason and no value; changed attempt lineage refuses without writes',async () => {
    const f=await qcGateFixture({status:'ACCEPTED'}); owned.push(f); await f.result(f.items[0]);
    await rules.inTransaction(f.db,tx=>appendReportedSelection(tx,f.items[0],f.actor,{mode:'NOT_REPORTABLE',reason:'Insufficient retained evidence'}));
    const sample=await f.db.sample.findUnique({where:{id:f.items[0].sampleId}}), before=await f.snapshot();
    const fresh=await readSampleReportedValues(f.db,sample);
    expect(fresh.values[0]).toMatchObject({mode:'NOT_REPORTABLE',reason:'Insufficient retained evidence',value:'',numericValue:null,sourceResultIds:[]});
    expect(fresh.sourceResults).toEqual([]); expect(await f.snapshot()).toEqual(before);
    const saved=await f.db.reportedValueSelection.findMany();
    // Validate an updated lineage at the same reader contract boundary without
    // manufacturing an illegal repeat of already accepted work.
    const attempts=await f.db.workAttempt.findMany(), results=await f.db.result.findMany();
    expect(() => require('../../services/reportedValueGroupContract').assertReportedSelectionGroup(saved,[f.analysisCode],
        attempts.map(row=>({...row,status:'QUESTIONED'})),results)).toThrow(expect.objectContaining({code:'REPORTED_VALUE_STALE'}));
    expect(await f.snapshot()).toEqual(before); expect(await f.db.reportedValueSelection.findMany()).toEqual(saved);
});
