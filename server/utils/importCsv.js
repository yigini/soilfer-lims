// CSV cells are always quoted. Leading apostrophes are escaped too so a matching
// client decoder can preserve an original apostrophe during an export/reimport.
function csvCell(value) {
    let text = value == null ? '' : String(value);
    if (/^[\u0000-\u0020]*[=+\-@']/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}
module.exports = { csvCell };
