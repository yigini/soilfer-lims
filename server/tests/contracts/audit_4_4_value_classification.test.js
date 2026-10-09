const { classifyResultValue, loqQuickValue } = require('../../../shared/resultValueValidation');
const { validateNumericMethod } = require('../../services/workbenchValidationService');
const registry = require('../../config/policyRegistry');
const format = { decimal: '.', thousands: null };
const rules = { min: 2, max: 14, typicalMin: 4, typicalMax: 9, loq: 0.5, lod: 0.1, calibrationMax: 10, unit: 'pH' };
test.each([
    ['65','RED',['ABOVE_MAX','OUTSIDE_TYPICAL_RANGE','ABOVE_RANGE'],true],
    ['<0.001','RED',['CENSOR_LIMIT_BELOW_LOQ'],false],
    ['not-a-number','RED',['INVALID_FORMAT'],false],
    ['3','AMBER',['OUTSIDE_TYPICAL_RANGE'],false],
    ['11','AMBER',['OUTSIDE_TYPICAL_RANGE','ABOVE_RANGE'],false],
    ['6.01','VALID',[],false]
])('%s has the pinned immediate classification %s', (value,severity,flags,canOverride) => {
    const classified=classifyResultValue(value,rules,format);
    expect(classified).toMatchObject({severity,canOverride});
    expect(classified.flags).toEqual(expect.arrayContaining(flags));
    expect(classified.isValid).toBe(severity!=='RED');
    expect(validateNumericMethod(value,rules,format)).toEqual(classified);
});
test('a numeric reading below method LOQ is amber and never acquires an invented hard bound',()=>{
    expect(classifyResultValue('0.2',{loq:0.5,lod:0.1},format)).toMatchObject({severity:'AMBER',isValid:true,flags:['BELOW_LOQ']});
});
test('unconfigured typical and calibration checks are skipped, and unconfigured LOQ disables the quick key',()=>{
    expect(classifyResultValue('100',{typicalMin:null,typicalMax:null,calibrationMax:null,loq:null},format))
        .toMatchObject({severity:'VALID',isValid:true,flags:[]});
    expect(loqQuickValue({loq:null},format)).toEqual({value:null,code:'LOQ_NOT_CONFIGURED'});
});
test('the quick key uses exactly the configured LOQ and decimal separator',()=>{
    const comma={decimal:',',thousands:null},quick=loqQuickValue({loq:0.5},comma);
    expect(quick).toEqual({value:'<0,5',code:null});
    expect(classifyResultValue(quick.value,{loq:0.5},comma)).toMatchObject({isValid:true,canOverride:false,censoring:'BELOW_LOQ'});
});
test('null policy defaults are per-lab/method in every preset, with no invented physical limit',()=>{
    for(const key of ['results.typicalMin','results.typicalMax','results.calibrationMax']){
        expect(registry.definition(key)).toMatchObject({type:'number',nullable:true,scope:'LAB+METHOD'});
        expect(Object.values(registry.definition(key).presets)).toEqual([null,null,null]);
        expect(registry.valid(key,null)).toBe(true);expect(registry.valid(key,-5)).toBe(true);
    }
});
