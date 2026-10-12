const {createHash}=require('node:crypto');
const {TextDecoder}=require('node:util');
const {parseDelimited}=require('../../shared/delimitedText');
const fail=(code,message)=>Object.assign(new Error(message),{statusCode:400,code});

// Decode source structure only. Units, dilution, matching and measurements
// belong to the scoped template/preview/commit owners; nothing here is numeric.
function decodeInstrumentDelimitedSource(bytes,delimiter){
 if(!Buffer.isBuffer(bytes)||!bytes.length)
  throw fail('IMPORT_FILE_EMPTY','Provide a nonempty instrument file.');
 if(!['\t',';',','].includes(delimiter))
  throw fail('IMPORT_DELIMITER_REQUIRED','Select the instrument file delimiter.');
 let text;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
 catch{throw fail('IMPORT_FILE_ENCODING_UNSUPPORTED','The instrument text file must use UTF-8.');}
 const rows=parseDelimited(text,delimiter);
 if(!rows.length)throw fail('IMPORT_FILE_EMPTY','The instrument file has no data rows.');
 return{sourceSha256:createHash('sha256').update(bytes).digest('hex'),rows};
}
module.exports={decodeInstrumentDelimitedSource};
