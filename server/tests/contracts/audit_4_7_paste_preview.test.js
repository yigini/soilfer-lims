const fs=require('node:fs'),path=require('node:path');
const {parseDelimited,parsePastedRows}=require('../../../shared/delimitedText');
const {mountUi,content}=require('../helpers/qcWorksheetUi');
const item=(id,extra={})=>({workItemId:'wi-'+id,sampleId:'internal-'+id,originalId:'field-'+id,sampleDisplayId:'lab-'+id,
 status:'IN_PROGRESS',numberFormat:{decimal:'.',thousands:null},readiness:{isReady:true},...extra});
async function preview(text,items=[item('1')],delimiter='AUTO'){
 const apply=jest.fn(),close=jest.fn(),view=mountUi('components/workbench/PastePreviewModal.jsx',{
  isOpen:true,currentItems:items,analysisCode:'SOC',onApply:apply,onClose:close});
 await view.render();if(delimiter!=='AUTO'){view.find('paste-delimiter').props.onChange({target:{value:delimiter}});await view.render();}
 view.find('paste-input').props.onChange({target:{value:text}});await view.render();view.find('paste-preview').props.onClick();await view.render();
 return{view,apply,close,rows:()=>view.all().filter(node=>/^paste-row-/.test(node.props?.['data-testid']||''))};
}

test.each([['\t','lab-1\t 6.7500 '],[';', 'lab-1; 6,7500 '],[',','lab-1," 6,7500 "']])
('actual paste preview matches displayed lab code using %j and retains decoded value whitespace',async(delimiter,text)=>{
 expect(parsePastedRows(text).delimiter).toBe(delimiter);
 const f=await preview(text);expect(f.rows()).toHaveLength(1);expect(f.rows()[0].props['data-valid']).toBe(true);
 f.view.find('paste-apply').props.onClick();expect(f.apply).toHaveBeenCalledWith([{workItemId:'wi-1',value:delimiter==='\t'?' 6.7500 ':' 6,7500 '}]);
 expect(f.close).toHaveBeenCalledTimes(1);expect(f.view.axios.post).not.toHaveBeenCalled();expect(f.view.axios.put).not.toHaveBeenCalled();
});

test('40 labelled sample rows apply to 40 exact tasks; an unknown ID is displayed and excluded',async()=>{
 const items=Array.from({length:40},(_,index)=>item(String(index+1))),rows=items.map((row,index)=>row.sampleDisplayId+','+(6+index/100).toFixed(2));
 const f=await preview(rows.join('\r\n')+'\r\nUNKNOWN-LABEL,7.2',items);
 expect(f.rows()).toHaveLength(41);expect(f.rows().filter(row=>row.props['data-valid'])).toHaveLength(40);
 expect(content(f.rows()[40])).toContain('UNKNOWN-LABEL');expect(content(f.rows()[40])).toContain('pastePreview.unmatched');
 f.view.find('paste-apply').props.onClick();expect(f.apply).toHaveBeenCalledWith(items.map((row,index)=>({workItemId:row.workItemId,value:(6+index/100).toFixed(2)})));
 expect(f.view.axios.post).not.toHaveBeenCalled();
});

test('internal, original and explicitly supplied lab labels remain exact aliases',async()=>{
 for(const id of ['internal-1','field-1','sample-label-1']){
  const f=await preview(id+'\t7.2',[item('1',{sampleLabId:'sample-label-1'})]);expect(f.rows()[0].props['data-valid']).toBe(true);
  f.view.find('paste-apply').props.onClick();expect(f.apply).toHaveBeenCalledWith([{workItemId:'wi-1',value:'7.2'}]);
 }
});

test('colliding identifiers and different aliases for the same task never choose or overwrite a target',async()=>{
 const collision=await preview('shared-id\t7.2',[item('1',{originalId:'shared-id'}),item('2',{sampleDisplayId:'shared-id'})]);
 expect(collision.rows()[0].props['data-valid']).toBe(false);expect(content(collision.rows()[0])).toContain('pastePreview.ambiguousId');
 collision.view.find('paste-apply').props.onClick();expect(collision.apply).not.toHaveBeenCalled();
 const aliases=await preview('lab-1\t7.2\nfield-1\t8.1');expect(aliases.rows()).toHaveLength(2);
 expect(aliases.rows().every(row=>!row.props['data-valid']&&content(row).includes('pastePreview.duplicate'))).toBe(true);
 aliases.view.find('paste-apply').props.onClick();expect(aliases.apply).not.toHaveBeenCalled();
});

test('numeric ambiguity follows the supplied task policy and never uses the user locale as a fallback',async()=>{
 const ambiguous=await preview('lab-1;1,234');expect(ambiguous.rows()[0].props['data-valid']).toBe(false);
 expect(content(ambiguous.rows()[0])).toContain('pastePreview.invalidNumber');
 const configured=await preview('lab-1;1,234',[item('1',{numberFormat:{decimal:'.',thousands:','}})]);
 expect(configured.rows()[0].props['data-valid']).toBe(true);configured.view.find('paste-apply').props.onClick();
 expect(configured.apply).toHaveBeenCalledWith([{workItemId:'wi-1',value:'1,234'}]);
 const missing=await preview('lab-1\t7.2',[item('1',{numberFormat:null})]);expect(missing.rows()[0].props['data-valid']).toBe(false);
});

test('malformed quotes, extra cells, empty values and non-finite values remain visible and excluded',async()=>{
 for(const text of ['lab-1,6,75','lab-1,"7.2','lab-1,"7.2"extra','lab-1\t','lab-1\tInfinity','lab-1\t1e999']){
  const f=await preview(text);expect(f.rows()).toHaveLength(1);expect(f.rows()[0].props['data-valid']).toBe(false);
  f.view.find('paste-apply').props.onClick();expect(f.apply).not.toHaveBeenCalled();
 }
});

test('edited text or delimiter requires a fresh preview and queue status changes are re-evaluated',async()=>{
 const f=await preview('lab-1\t7.2');f.view.find('paste-input').props.onChange({target:{value:'unknown\t8.1'}});await f.view.render();
 expect(f.rows()).toHaveLength(0);f.view.find('paste-apply').props.onClick();expect(f.apply).not.toHaveBeenCalled();
 f.view.find('paste-input').props.onChange({target:{value:'lab-1\t7.2'}});await f.view.render();f.view.find('paste-preview').props.onClick();await f.view.render();
 await f.view.render({currentItems:[item('1',{status:'ACCEPTED'})]});expect(f.rows()[0].props['data-valid']).toBe(false);
 f.view.find('paste-apply').props.onClick();expect(f.apply).not.toHaveBeenCalled();
 f.view.find('paste-delimiter').props.onChange({target:{value:','}});await f.view.render();expect(f.rows()).toHaveLength(0);
});

test('explicit delimiter resolves an identifier containing another supported separator',async()=>{
 const f=await preview('field;source,7.2',[item('1',{originalId:'field;source'})],',');
 expect(f.rows()[0].props['data-valid']).toBe(true);f.view.find('paste-apply').props.onClick();expect(f.apply).toHaveBeenCalledWith([{workItemId:'wi-1',value:'7.2'}]);
});

test('quoted IDs, escaped quotes, embedded newlines, BOM and physical row numbers decode without losing cell evidence',()=>{
 expect(parseDelimited('\uFEFF"lab,01";" 6,7500 "\r\n"lab""02";"7\r\n.2"\r\nlast;0\r\n',';')).toEqual([
  {cells:['lab,01',' 6,7500 '],rowNumber:1,error:null},{cells:['lab"02','7\r\n.2'],rowNumber:2,error:null},{cells:['last','0'],rowNumber:4,error:null}]);
 expect(parseDelimited('lab,"7.2',',')).toEqual([{cells:['lab','7.2'],rowNumber:1,error:'UNTERMINATED_QUOTE'}]);
 expect(()=>parseDelimited('text','|')).toThrow(TypeError);
});

test('all five locales contain the same complete paste-preview keys and parameter placeholders',()=>{
 const locales=['en','es','es-419','fr','pt'],values=locales.map(locale=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../client/src/translations/'+locale+'.json'),'utf8')).pastePreview);
 expect(Object.keys(values[0])).toHaveLength(21);
 for(const value of values){expect(Object.keys(value).sort()).toEqual(Object.keys(values[0]).sort());
  for(const [key,text]of Object.entries(value)){expect(typeof text).toBe('string');expect(text.trim()).not.toBe('');
   expect((text.match(/\{\w+\}/g)||[]).sort()).toEqual((values[0][key].match(/\{\w+\}/g)||[]).sort());}}
});
