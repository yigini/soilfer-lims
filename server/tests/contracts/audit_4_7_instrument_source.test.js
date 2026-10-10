const {createHash}=require('node:crypto');
const {decodeInstrumentDelimitedSource:decode}=require('../../services/instrumentDelimitedSource');

test.each(['\t',';',','])('file decoding preserves the exact source digest and quoted raw cells with delimiter %j',delimiter=>{
 const raw=['label',' 6,7500 ','mg/L',' 1.00 ','line\nwith "quote"','é土'];
 const encoded=raw.map(cell=>'"'+cell.replaceAll('"','""')+'"').join(delimiter);
 const bytes=Buffer.from('\uFEFF'+encoded+'\r\n'),before=Buffer.from(bytes),result=decode(bytes,delimiter);
 expect(result.sourceSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
 expect(result.rows).toEqual([{rowNumber:1,error:null,cells:raw}]);expect(bytes).toEqual(before);
});

test('forty sample rows with four analyte columns and six QC rows are decoded without matching, filtering or numeric interpretation',()=>{
 const header='sample;Ca;Mg;K;Na;unit;dilution';
 const sampleRows=Array.from({length:40},(_,index)=>'LAB-'+(index+1)+'; 1.0000 ;2,5000;<0.1;0;mg/L;2');
 const qcRows=['BLK-1','BLK-2','CCV-1','CCV-2','LRM-1','LRM-2'].map(id=>id+';0.0000;0.00;0;0;mg/L;1');
 const result=decode(Buffer.from([header,...sampleRows,...qcRows].join('\r\n')),';');
 expect(result.rows).toHaveLength(47);
 for(let index=0;index<40;index++)expect(result.rows[index+1]).toEqual({rowNumber:index+2,error:null,
  cells:['LAB-'+(index+1),' 1.0000 ','2,5000','<0.1','0','mg/L','2']});
 expect(result.rows.slice(41).map(row=>row.cells[0])).toEqual(['BLK-1','BLK-2','CCV-1','CCV-2','LRM-1','LRM-2']);
});

test('an unknown label, formula-looking value and malformed row remain decoded evidence for preview refusal',()=>{
 const bytes=Buffer.from('UNKNOWN,"=1+2",mg/L\nBROKEN,"unterminated');
 const result=decode(bytes,',');
 expect(result.rows[0]).toEqual({rowNumber:1,error:null,cells:['UNKNOWN','=1+2','mg/L']});
 expect(result.rows[1]).toMatchObject({rowNumber:2,error:'UNTERMINATED_QUOTE',cells:['BROKEN','unterminated']});
});

test.each([[Buffer.alloc(0),',','IMPORT_FILE_EMPTY'],[Buffer.from(' \r\n'),',','IMPORT_FILE_EMPTY'],
 [Buffer.from('A,1'),'AUTO','IMPORT_DELIMITER_REQUIRED'],[Buffer.from([0xff,0xfe,0x41,0]),',','IMPORT_FILE_ENCODING_UNSUPPORTED']])
 ('undecodable or unspecified source refuses with a stable error and unchanged input', (bytes,delimiter,code)=>{
 const before=Buffer.from(bytes);expect(()=>decode(bytes,delimiter)).toThrow(expect.objectContaining({statusCode:400,code}));expect(bytes).toEqual(before);
 });
