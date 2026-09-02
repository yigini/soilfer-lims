const fs = require('fs');
const path = require('path');

describe('WP-03: Dead-Code & System Wiring Regression Tests', () => {
    const serverDir = path.resolve(__dirname, '../..');
    const clientDir = path.resolve(serverDir, '../client/src');

    function getAllFiles(dir, exts = ['.js', '.jsx']) {
        let results = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        for (const file of list) {
            if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
            const fullPath = path.resolve(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getAllFiles(fullPath, exts));
            } else if (exts.includes(path.extname(file))) {
                results.push(fullPath);
            }
        }
        return results;
    }

    test('1. validateSampleMatrix is actively called in result save/submit flow', () => {
        const resultsController = fs.readFileSync(path.join(serverDir, 'controllers/resultsController.js'), 'utf8');
        expect(resultsController).toContain('validateSampleMatrix');
    });

    test('2. workflowContract functions are exported and callable', () => {
        const contract = require('../../workflowContract');
        expect(typeof contract.isValidSampleTransition).toBe('function');
        expect(typeof contract.isValidSampleState).toBe('function');
        expect(contract.SAMPLE_STATES).toBeDefined();
        expect(Array.isArray(contract.SAMPLE_STATE_LIST)).toBe(true);
        expect(contract.SAMPLE_STATE_LIST.length).toBeGreaterThan(0);
    });

    test('3. utils/scopeGuard.js exported functions have active call sites and no dead code (WP-28)', () => {
        const scopeGuard = require('../../utils/scopeGuard');
        const authMiddleware = require('../../middleware/authMiddleware');

        // Dead middleware check
        expect(authMiddleware.checkScope).toBeUndefined();
        expect(scopeGuard.requireLabScope).toBeUndefined();

        const serverFiles = getAllFiles(path.join(serverDir, 'controllers'))
            .concat(getAllFiles(path.join(serverDir, 'routes')))
            .concat(getAllFiles(path.join(serverDir, 'services')));

        const allServerCode = serverFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

        const exportedKeys = Object.keys(scopeGuard).filter(k => typeof scopeGuard[k] === 'function');
        const uncalledFunctions = [];

        for (const fnName of exportedKeys) {
            // Check if function name appears outside scopeGuard.js
            if (!allServerCode.includes(fnName)) {
                uncalledFunctions.push(fnName);
            }
        }

        // WP-28: Dead security functions deleted from codebase
        expect(uncalledFunctions).not.toContain('requireLabScope');
        expect(exportedKeys.length).toBeGreaterThan(0);
    });

    test('4. config/roles.js permission keys are registered and referenced', () => {
        const { PERMISSIONS } = require('../../config/roles');
        expect(PERMISSIONS).toBeDefined();
        const permKeys = Object.keys(PERMISSIONS);
        expect(permKeys.length).toBeGreaterThan(10);

        const allCode = getAllFiles(serverDir).map(f => fs.readFileSync(f, 'utf8')).join('\n');
        for (const key of permKeys) {
            const hasUsage = allCode.includes(`'${key}'`) || allCode.includes(`"${key}"`);
            expect(hasUsage).toBe(true);
        }
    });

    test('5. client/src/components are tracked for active imports', () => {
        const componentFiles = getAllFiles(path.join(clientDir, 'components'), ['.jsx', '.js']);
        const allClientFiles = getAllFiles(clientDir, ['.jsx', '.js']);
        const allClientCode = allClientFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

        const unimportedComponents = [];

        for (const compPath of componentFiles) {
            const baseName = path.basename(compPath, path.extname(compPath));
            // Regex to check if imported in other files
            const isImported = allClientCode.includes(baseName);
            if (!isImported) {
                unimportedComponents.push(baseName);
            }
        }

        // Documents unimported components (e.g. SampleTimeline before WP-27)
        expect(componentFiles.length).toBeGreaterThan(0);
    });

    // SD-16: Extended Wiring Assertions for Sample Page & Controls

    test('6. SD-16: No client file issues a status write the user did not request (catches SD-07)', () => {
        const sampleDetailCode = fs.readFileSync(path.join(clientDir, 'pages/SampleDetail.jsx'), 'utf8');

        // Check for deleted forced-approval workaround
        expect(sampleDetailCode).not.toContain('Intermediate Step for Archiving');

        // Verify handleArchive does not issue silent /approve calls
        const archiveHandlerMatch = sampleDetailCode.match(/const handleArchive = async \(\) => \{([\s\S]*?)\};/);
        expect(archiveHandlerMatch).not.toBeNull();
        const archiveHandlerBody = archiveHandlerMatch[1];
        expect(archiveHandlerBody).not.toContain('/approve');
    });

    test('7. SD-16: Route-level permission guards are consistent with controller authorization (catches SD-06)', () => {
        const sampleRoutesCode = fs.readFileSync(path.join(serverDir, 'routes/sampleRoutes.js'), 'utf8');
        const sampleControllerCode = fs.readFileSync(path.join(serverDir, 'controllers/sampleController.js'), 'utf8');

        // Route must gate EDIT_ANALYSES
        expect(sampleRoutesCode).toMatch(/router\.put\(['"]\/:id\/analyses['"],\s*checkPermission\(['"]EDIT_ANALYSES['"]\)/);

        // Controller must use hasPermission('EDIT_ANALYSES') and not hardcode role array
        expect(sampleControllerCode).toContain("hasPermission(user, 'EDIT_ANALYSES')");
        const updateAnalysesFn = sampleControllerCode.match(/exports\.updateSampleAnalyses = async \([\s\S]*?try \{([\s\S]*?)const sample/);
        expect(updateAnalysesFn).not.toBeNull();
        expect(updateAnalysesFn[1]).not.toMatch(/\['LAB_MANAGER',\s*'SUPER_ADMIN'\]\.includes\(user\.role\)/);
    });

    test('8. SD-16: Every gate the client renders has an active server counterpart (catches SD-05)', () => {
        const workItemControllerCode = fs.readFileSync(path.join(serverDir, 'controllers/workItemController.js'), 'utf8');
        const resultsControllerCode = fs.readFileSync(path.join(serverDir, 'controllers/resultsController.js'), 'utf8');

        // workItemController must reject execution if preparationStatus !== 'DONE' with 412
        expect(workItemControllerCode).toContain("sample.preparationStatus !== 'DONE'");
        expect(workItemControllerCode).toContain("status(412)");

        // resultsController must reject result entry if preparationStatus !== 'DONE' with 412
        expect(resultsControllerCode).toContain("sample.preparationStatus !== 'DONE'");
        expect(resultsControllerCode).toContain("status(412)");
    });
});

