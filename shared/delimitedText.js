// Decode CSV/TXT cells without interpreting or changing measurement values.
// Quoting is structural; the decoded cell preserves its original whitespace.
function parseDelimited(text,delimiter){
 if(typeof text!=='string'||!['\t',';',','].includes(delimiter))throw new TypeError('Provide text and a supported delimiter.');
 const input=text.replace(/^\uFEFF/,''),rows=[];
 let cells=[],cell='',state='START',error=null,rowNumber=1,rowStart=1;
 const field=()=>{cells.push(cell);cell='';state='START';};
 const row=()=>{field();if(cells.some(value=>value.trim())||error)rows.push({cells,rowNumber:rowStart,error});cells=[];error=null;};
 for(let index=0;index<input.length;index++){
  const char=input[index];
  if(state==='QUOTED'){
   if(char==='"'){
    if(input[index+1]==='"'){cell+='"';index++;}else state='AFTER_QUOTE';
   }else{cell+=char;if(char==='\n'||char==='\r'&&input[index+1]!=='\n')rowNumber++;}
   continue;
  }
  if(char===delimiter){field();continue;}
  if(char==='\n'||char==='\r'){
   row();if(char==='\r'&&input[index+1]==='\n')index++;rowNumber++;rowStart=rowNumber;continue;
  }
  if(state==='AFTER_QUOTE'){
   if(char===' '||char==='\t')continue;
   error=error||'TRAILING_QUOTE_TEXT';cell+=char;continue;
  }
  if(char==='"'){
   if(state==='START')state='QUOTED';else{error=error||'UNEXPECTED_QUOTE';cell+=char;}
   continue;
  }
  cell+=char;state='UNQUOTED';
 }
 if(state==='QUOTED')error=error||'UNTERMINATED_QUOTE';
 if(cell.length||cells.length||state!=='START'||error)row();
 return rows;
}
function parsePastedRows(text){
 // Prefer spreadsheet tabs, then semicolons, when both are structural.
 // An unquoted decimal comma in comma CSV produces an extra cell and is refused.
 const candidates=['\t',';',','].map(delimiter=>{
  const rows=parseDelimited(text,delimiter);
  return{delimiter,rows,score:rows.filter(row=>!row.error&&row.cells.length===2).length,
   separated:rows.filter(row=>row.cells.length>1).length};
 });
 candidates.sort((left,right)=>right.score-left.score||right.separated-left.separated);
 return candidates[0];
}
module.exports={parseDelimited,parsePastedRows};
