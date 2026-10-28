'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Keep local installation details and obsolete example keys out of tracked text.
const patterns = [
    ['46', '19', '33', '37'].join('\\.'),
    ['yigini', 'net'].join('\\.'),
    ['soillab', 'server'].join('-'),
    ['C:', 'Users', 'yigin'].join('[/\\\\]+'),
    ['soilfer', 'secret', 'key'].join('-'),
    ['super', 'secret', 'production', 'key'].join('-'),
    'eyJ[[:alnum:]_-]{10,}[.][[:alnum:]_-]{10,}[.][[:alnum:]_-]{10,}',
    ['github[.]com', 'yigini', 'soilfer-lims', '(issues|pull)', ''].join('/')
];
const result = spawnSync('git', ['grep', '-Il', '-E', patterns.join('|'), '--', '.'], {
    cwd: path.resolve(__dirname, '../..'), encoding: 'utf8'
});
if (result.error || result.status !== 0 && result.status !== 1) {
    console.error('Repository text check could not run.');
    process.exit(1);
}
if (result.status === 0) {
    console.error(`Repository text check failed (${result.stdout.trim().split('\n').length} tracked files).`);
    process.exit(1);
}
console.log('Repository text check passed.');
