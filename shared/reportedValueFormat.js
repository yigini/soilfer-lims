// Storage and exports keep full precision. Only report rendering rounds a
// selected numeric value, using the methodology precision frozen in the report.
function formatReportedValue(item) {
    const value=item.value;
    if(value===null || value===undefined) return '—';
    const text=String(value);
    if(item.reportedMode==='NOT_REPORTABLE' || item.censoring && item.censoring!=='NONE' || /^[<>]/.test(text.trim())) return text;
    const precision=item.decimalPlaces;
    if(!Number.isInteger(precision) || precision<0 || precision>100 || !text.trim()) return text;
    const numeric=Number(text);
    return Number.isFinite(numeric)?numeric.toFixed(precision):text;
}
module.exports={formatReportedValue};
