const fs = require('fs');
const path = require('path');

module.exports = async function globalTeardown() {
    const tmpDir = path.resolve(__dirname, '.tmp');
    if (!fs.existsSync(tmpDir)) return;

    try {
        const files = fs.readdirSync(tmpDir);
        for (const file of files) {
            try {
                fs.unlinkSync(path.resolve(tmpDir, file));
            } catch (e) {
                // Ignore lock if held briefly on windows
            }
        }
    } catch (e) {
        // Ignore
    }
};
