// Export committed bytes without Windows EOL conversion; never reads a live DB.
const fs = require('node:fs'), cp = require('node:child_process'), crypto = require('node:crypto');
const [head, archive, indexFile] = process.argv.slice(2);
if (!/^[a-f0-9]{40}$/.test(head || '') || !archive || !indexFile
    || fs.existsSync(archive) || fs.existsSync(indexFile)) throw Error('Require exact head and two fresh output paths');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const rows = cp.execFileSync('git', ['ls-tree', '-r', '-z', head]).toString('utf8').split('\0').filter(Boolean).map(row => {
  const [metadata, path] = row.split('\t');
  const [mode, type, blob] = metadata.split(' ');
  if (type !== 'blob') throw Error('Unsupported source object: ' + path);
  return {path, mode, blob};
});
const objects = cp.execFileSync('git', ['cat-file', '--batch'], {
  input: rows.map(row => row.blob).join('\n') + '\n', maxBuffer: 256 * 1024 * 1024
});
let offset = 0;
for (const row of rows) {
  const newline = objects.indexOf(10, offset);
  const [blob, type, size] = objects.subarray(offset, newline).toString().split(' ');
  if (blob !== row.blob || type !== 'blob' || !/^\d+$/.test(size)) throw Error('Git object stream differs');
  row.bytes = Number(size);
  offset = newline + 1;
  row.sha256 = digest(objects.subarray(offset, offset + row.bytes));
  offset += row.bytes;
  if (objects[offset++] !== 10) throw Error('Git object framing differs');
}
if (offset !== objects.length) throw Error('Unexpected trailing Git bytes');
cp.execFileSync('git', ['-c', 'core.autocrlf=false', 'archive', '--format=tar.gz', '--output=' + archive, head]);
const index = {status:'COMMITTED_GIT_BLOB_INDEX', head, entries:rows};
fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n', {flag:'wx'});
console.log(JSON.stringify({head, entries:rows.length, archiveSha256:digest(fs.readFileSync(archive)),
  indexSha256:digest(fs.readFileSync(indexFile))}));
