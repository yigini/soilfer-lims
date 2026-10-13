'use strict';
// Local validation only: keep stock app/assertions; relocate byte-identical assets.
const actualPath = jest.requireActual('path');
const fs = require('node:fs');
const serverRoot = actualPath.resolve(__dirname, '../../server');
const visibleDist = process.env.LIMS_VISIBLE_CLIENT_DIST;
if (!visibleDist || !fs.existsSync(actualPath.join(visibleDist, 'index.html'))) {
    throw new Error('A separately hash-verified visible client asset fixture is required.');
}
jest.doMock('path', () => {
    const real = jest.requireActual('path');
    return { ...real, join(...parts) {
        if (parts.length === 4 && real.resolve(parts[0]) === serverRoot &&
            parts[1] === '..' && parts[2] === 'client' && parts[3] === 'dist') return visibleDist;
        return real.join(...parts);
    } };
});
