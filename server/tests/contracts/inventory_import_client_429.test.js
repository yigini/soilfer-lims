const { utilities, csv, excel, options } = require('../helpers/inventoryImportClient');
const XLSX = require('../../../client/node_modules/xlsx');
const { localeTranslator } = require('../helpers/clientTranslation');

test.each(['en','fr','pt','es','es-419'])('%s template reads into three correctly mapped sheets; allowed values are ignored', async locale => {
    const t = localeTranslator(locale), workbook = utilities.inventoryImportTemplate(t);
    expect(workbook.SheetNames).toEqual(['locations','items','lots',t('bulkImport.allowedValuesSheet')]);
    const sheets = await utilities.readInventoryImportFile(excel(workbook), t), mapping = utilities.initialInventoryImportMapping(sheets, t);
    const payload = utilities.prepareInventoryImport(sheets, mapping, { ...options, fileName: 'practice.xlsx' });
    expect(Object.keys(payload.sheets)).toEqual(['locations','items','lots']);
    expect(payload.sheets.locations[0]).toMatchObject({ rowNumber: 2, name: t('bulkImport.exampleLocation'), purpose: 'REAGENT' });
    expect(payload.sheets.items[0]).toMatchObject({ shortCode: 'EXAMPLE-ITEM', unitOfMeasure: 'mL' });
    expect(payload.sheets.lots[0]).toMatchObject({ quantity: '10.5', expiryDate: '2030-12-31' });
});
test.each([',',';','\t'])('existing delimited helper reads %s quoting and retains physical row numbers', async delimiter => {
    const text = ['name'+delimiter+'purpose', '"Shelf, \"\"one\"\""'+delimiter+'REAGENT', '', 'Shelf two'+delimiter+'REAGENT'].join('\n');
    const sheets = await utilities.readInventoryImportFile(csv(text));
    expect(sheets[0].rows[0]).toMatchObject({ rowNumber: 2, cells: ['Shelf, "one"','REAGENT'] });
    expect(sheets[0].rows[1].rowNumber).toBe(4);
});
test.each(['=SUM(A1)', '+text', '-1', '@value', "'original", '  =hidden'])('server CSV escape round-trips %s as literal cell text', async value => {
    const { csvCell } = require('../../utils/importCsv');
    const sheets = await utilities.readInventoryImportFile(csv('name,purpose\n'+csvCell(value)+',REAGENT'));
    expect(sheets[0].rows[0].cells[0]).toBe(value);
});
test('CSV with an unquoted decimal comma or broken quotes is refused instead of dropping cells', async () => {
    for (const source of ['itemShortCode,lotNumber,quantity\nCODE,LOT,10,5','name,purpose\n"unfinished,REAGENT'])
        await expect(utilities.readInventoryImportFile(csv(source))).rejects.toMatchObject({ code: 'IMPORT_INVALID_CSV' });
});
test('XLSX numbers use stored values, dates become ISO dates, and formulas remain plain text', async () => {
    const workbook = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([['quantity','expiryDate','traceabilityNotes'],[10.5,45291,'']]);
    sheet.B2.z = 'dd/mm/yyyy'; sheet.C2 = { t: 'n', f: '1+1', v: 2 };
    XLSX.utils.book_append_sheet(workbook,sheet,'lots');
    const loaded = await utilities.readInventoryImportFile(excel(workbook));
    expect(loaded[0].rows[0].cells).toEqual(['10.5','2023-12-31','=1+1']);
});
test('limits are enforced for CSV, Excel sheet dimensions and expanded JSON', async () => {
    await expect(utilities.readInventoryImportFile({ name: 'large.csv', size: 2*1024*1024+1 })).rejects.toMatchObject({ code:'IMPORT_TOO_LARGE' });
    await expect(utilities.readInventoryImportFile(csv('name,purpose\n'+Array.from({length:2001},(_,i)=>'Shelf'+i+',REAGENT').join('\n')))).rejects.toMatchObject({code:'IMPORT_TOO_LARGE'});
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['name'],...Array.from({length:2001},()=>['Shelf'])]),'locations');
    await expect(utilities.readInventoryImportFile(excel(workbook))).rejects.toMatchObject({code:'IMPORT_TOO_LARGE'});
    const sheets=[{id:'sheet',name:'locations',headers:['name'],rows:[{rowNumber:2,cells:['x'.repeat(2*1024*1024)]}]}];
    expect(()=>utilities.prepareInventoryImport(sheets,{sheet:{dataset:'locations',columns:{name:0}}},options)).toThrow('IMPORT_TOO_LARGE');
});
test('mapping sends only selected fields and names of ignored columns, and refuses ambiguous maps', async () => {
    const sheets=await utilities.readInventoryImportFile(csv('Label,purpose,Private extra\nShelf,REAGENT,do not upload this cell'));
    const mapping={'sheet-0':{dataset:'locations',columns:{name:0,purpose:1}}};
    const payload=utilities.prepareInventoryImport(sheets,mapping,options);
    expect(payload.sheets.locations[0]).toMatchObject({name:'Shelf',purpose:'REAGENT','unmapped:2:Private extra':''});
    expect(JSON.stringify(payload)).not.toContain('do not upload this cell');
    expect(()=>utilities.prepareInventoryImport(sheets,{'sheet-0':{dataset:'locations',columns:{name:0,purpose:0}}},options)).toThrow('IMPORT_DUPLICATE_MAPPING');
    expect(()=>utilities.prepareInventoryImport(sheets,{},options)).toThrow('IMPORT_NO_SHEET_SELECTED');
    expect(()=>utilities.prepareInventoryImport([...sheets,{...sheets[0],id:'two'}],{...mapping,two:mapping['sheet-0']},options)).toThrow('IMPORT_DUPLICATE_SHEET');
});
test('all five import dictionaries have the same keys and interpolation parameters', () => {
    const flatten=(v,p='')=>Object.fromEntries(Object.entries(v).flatMap(([k,x])=>typeof x==='string'?[[p+k,x]]:Object.entries(flatten(x,p+k+'.'))));
    const english=flatten(require('../../../client/src/translations/en.json').bulkImport);
    for(const locale of ['en','fr','pt','es','es-419']){
        const rows=flatten(require(`../../../client/src/translations/${locale}.json`).bulkImport);expect(Object.keys(rows).sort()).toEqual(Object.keys(english).sort());
        for(const key of Object.keys(rows)){expect(rows[key].trim()).not.toBe('');const vars=s=>[...s.matchAll(/{{(\w+)}}/g)].map(m=>m[1]).sort();expect(vars(rows[key])).toEqual(vars(english[key]));}
    }
});

test('an Excel sheet starting below row one preserves all used rows and their source numbers', async () => {
    const workbook=XLSX.utils.book_new(),sheet={};XLSX.utils.sheet_add_aoa(sheet,[['name','purpose'],['Offset shelf','REAGENT']],{origin:'A5001'});XLSX.utils.book_append_sheet(workbook,sheet,'locations');
    const loaded=await utilities.readInventoryImportFile(excel(workbook));expect(loaded[0].rows).toHaveLength(1);expect(loaded[0].rows[0]).toMatchObject({rowNumber:5002,cells:['Offset shelf','REAGENT']});
});
test('control characters in headers are refused and selected cell text stays literal for server validation', async () => {
    await expect(utilities.readInventoryImportFile(csv('name\u0000,purpose\nShelf,REAGENT'))).rejects.toMatchObject({code:'IMPORT_CONTROL_CHARACTER'});
    const loaded=await utilities.readInventoryImportFile(csv('name,purpose\nShelf\u0085text,REAGENT'));expect(loaded[0].rows[0].cells[0]).toContain('\u0085');
});
