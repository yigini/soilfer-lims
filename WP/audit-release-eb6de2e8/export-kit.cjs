// Export release tooling from raw Git blobs, preserving every reviewed byte.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto');
const [head, target] = process.argv.slice(2);
if (!/^[a-f0-9]{40}$/.test(head || '') || !target || fs.existsSync(target)) {
  throw Error('Require an exact kit commit and a fresh output directory');
}
const prefix = 'WP/audit-release-eb6de2e8/';
const rows = cp.execFileSync('git',['ls-tree','-r','-z',head,'--',prefix]).toString().split('\0').filter(Boolean);
fs.mkdirSync(target, {mode:0o700});
const files = [];
for (const row of rows) {
  const [metadata, name] = row.split('\t');
  const [mode, type, blob] = metadata.split(' ');
  const relative = name.slice(prefix.length);
  if (!['100644','100755'].includes(mode) || type !== 'blob' || path.basename(relative) !== relative) {
    throw Error('Unsupported kit source: ' + name);
  }
  const bytes = cp.execFileSync('git',['cat-file','blob',blob]);
  fs.writeFileSync(path.join(target,relative),bytes,{flag:'wx'});
  files.push({name:relative,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
const index = {status:'RAW_GIT_KIT_EXPORT',head,files};
fs.writeFileSync(path.join(target,'kit-source-index.json'),JSON.stringify(index,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({head,root:path.resolve(target),count:files.length}));
