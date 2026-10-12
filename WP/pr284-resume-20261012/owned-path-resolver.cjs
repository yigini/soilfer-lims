// Local environment adapter only. Resolve normally, then address files of the
// SAME managed checkout through its verified non-hidden R: filesystem alias.
// No imports, tests, assertions, fixtures, permissions or hooks are omitted.
const path = require('node:path');
const fs = require('node:fs');
const original = 'C:\\Users\\yigin\\.codex\\worktrees\\audit-qc-integration\\soilfer-lims';
const alias = 'R:\\';
module.exports = (request, options) => {
    const resolved = options.defaultResolver(request, options);
    let relative = path.relative(original, resolved);
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
        relative = path.relative(alias, resolved);
        if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) return resolved;
    }
    // Keep fixture/caller identities at their original paths. Only the two
    // unchanged delivery modules need the non-hidden address for Express.
    const delivery = ['server/app.js', 'server/controllers/spectralController.js'].includes(relative.replace(/\\/g, '/'));
    const addressed = path.join(delivery ? alias : original, relative);
    const first = fs.statSync(resolved), second = fs.statSync(addressed);
    if (first.dev !== second.dev || first.ino !== second.ino || first.size !== second.size)
        throw new Error('Owned local path alias does not reference the same physical file');
    return addressed;
};
