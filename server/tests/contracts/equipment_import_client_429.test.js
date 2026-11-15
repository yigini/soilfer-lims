const { utilities, csv, excel, options } = require('../helpers/inventoryImportClient');
const XLSX = require('../../../client/node_modules/xlsx');
const { localeTranslator } = require('../helpers/clientTranslation');
test.each(['en','fr','pt','es','es-419'])('%s equipment workbook round-trips template headers and allowed values',async locale=>{
    const t=localeTranslator(locale),workbook=utilities.inventoryImportTemplate(t,'equipment');
    expect(workbook.SheetNames).toEqual(['equipment',t('bulkImport.allowedValuesSheet')]);
    const sheets=await utilities.readInventoryImportFile(excel(workbook),t);
    const mapping=utilities.initialInventoryImportMapping(sheets,t,utilities.EQUIPMENT_COLUMNS);
    const payload=utilities.prepareInventoryImport(sheets,mapping,options,utilities.EQUIPMENT_COLUMNS);
    expect(Object.keys(payload.sheets)).toEqual(['equipment']);
    expect(payload.sheets.equipment[0]).toMatchObject({internalAssetTag:'EXAMPLE-METER',name:t('bulkImport.exampleEquipment'),assetType:'PH_METER',criticality:'IMPORTANT'});
    expect(XLSX.utils.sheet_to_json(workbook.Sheets[t('bulkImport.allowedValuesSheet')],{header:1}).some(row=>row[0]==='eligibleAnalyses' && row[1]===t('bulkImport.eligibleAnalysesHint'))).toBe(true);
});
test('one equipment CSV sheet is inferred, physical row numbers and plain formula text are preserved',async()=>{
    const t=localeTranslator('en'),sheets=await utilities.readInventoryImportFile(csv('internalAssetTag,name,assetType,lastCalibrationDate,eligibleAnalyses\nM-01,\'=1+1,PH_METER,2026-11-01,pH | electricalConductivity'));
    const mapping=utilities.initialInventoryImportMapping(sheets,t,utilities.EQUIPMENT_COLUMNS);
    const payload=utilities.prepareInventoryImport(sheets,mapping,options,utilities.EQUIPMENT_COLUMNS);
    expect(payload.sheets.equipment[0]).toMatchObject({rowNumber:2,name:'=1+1',lastCalibrationDate:'2026-11-01',eligibleAnalyses:'pH | electricalConductivity'});
});
