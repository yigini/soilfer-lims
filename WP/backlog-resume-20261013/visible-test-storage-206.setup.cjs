'use strict';
// Local test fixture only; stock assertions and application source are unchanged.
const realPath = jest.requireActual('path');
const fs = require('node:fs');
const serverRoot = realPath.resolve(__dirname, '../../server');
const originalUploads = realPath.join(serverRoot, 'uploads');
const visibleDist = process.env.LIMS_VISIBLE_CLIENT_DIST;
const visibleUploads = process.env.LIMS_VISIBLE_TEST_UPLOADS;
if (!visibleDist || !visibleUploads || !fs.existsSync(realPath.join(visibleDist, 'index.html')) ||
    !fs.statSync(visibleUploads).isDirectory()) throw new Error('Hash-verified visible test storage is required.');
jest.doMock('path', () => {
    const real = jest.requireActual('path');
    const visible = value => {
        if (!real.isAbsolute(value)) return value;
        const normalized = real.resolve(value);
        if (normalized === originalUploads) return visibleUploads;
        if (normalized.startsWith(originalUploads + real.sep)) {
            return real.join(visibleUploads, real.relative(originalUploads, normalized));
        }
        return value;
    };
    return { ...real,
        join(...parts) {
            if (parts.length === 4 && real.resolve(parts[0]) === serverRoot &&
                parts[1] === '..' && parts[2] === 'client' && parts[3] === 'dist') return visibleDist;
            return visible(real.join(...parts));
        },
        resolve(...parts) { return visible(real.resolve(...parts)); }
    };
});
