const fs = require('fs');
const path = require('path');
const request = require('supertest');

describe('PIP / Versioning & Documentation Contracts', () => {
    const rootDir = path.resolve(__dirname, '../../..');
    const serverPkgPath = path.resolve(rootDir, 'server/package.json');
    const clientPkgPath = path.resolve(rootDir, 'client/package.json');
    const changelogPath = path.resolve(rootDir, 'CHANGELOG.md');
    const versioningDocPath = path.resolve(rootDir, 'VERSIONING.md');

    test('1. server/package.json and client/package.json versions must match strictly', () => {
        expect(fs.existsSync(serverPkgPath)).toBe(true);
        expect(fs.existsSync(clientPkgPath)).toBe(true);

        const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, 'utf8'));
        const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));

        expect(serverPkg.version).toBeDefined();
        expect(clientPkg.version).toBeDefined();
        expect(serverPkg.version).toBe(clientPkg.version);

        // Must follow SemVer X.Y.Z
        const semVerRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
        expect(serverPkg.version).toMatch(semVerRegex);
    });

    test('2. VERSIONING.md exists and establishes SemVer policy', () => {
        expect(fs.existsSync(versioningDocPath)).toBe(true);
        const content = fs.readFileSync(versioningDocPath, 'utf8');
        expect(content).toContain('Semantic Versioning 2.0.0');
        expect(content).toContain('MAJOR.MINOR.PATCH');
        expect(content).toContain('Synchronization Rule');
    });

    test('3. CHANGELOG.md documents current version under Keep a Changelog standard', () => {
        expect(fs.existsSync(changelogPath)).toBe(true);
        const content = fs.readFileSync(changelogPath, 'utf8');
        const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, 'utf8'));

        expect(content).toContain(`## [${serverPkg.version}]`);
        expect(content).toContain('Keep a Changelog');
    });

    test('4. GET /api/health and GET /api/version expose server package version', async () => {
        const app = require('../../app');
        const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, 'utf8'));

        const healthRes = await request(app).get('/api/health');
        expect(healthRes.statusCode).toBe(200);
        expect(healthRes.body.status).toBe('ok');
        expect(healthRes.body.version).toBe(serverPkg.version);

        const versionRes = await request(app).get('/api/version');
        expect(versionRes.statusCode).toBe(200);
        expect(versionRes.body.status).toBe('ok');
        expect(versionRes.body.name).toBe('soilfer-lims');
        expect(versionRes.body.version).toBe(serverPkg.version);
    });

    test('5. Client views do not contain obsolete hardcoded version strings', () => {
        const workflowMapPath = path.resolve(rootDir, 'client/src/pages/SampleWorkflowMap.jsx');
        const workflowContent = fs.readFileSync(workflowMapPath, 'utf8');
        expect(workflowContent).not.toContain('v1.4.0');
        expect(workflowContent).toContain('__APP_VERSION__');

        const aboutPath = path.resolve(rootDir, 'client/src/pages/About.jsx');
        const aboutContent = fs.readFileSync(aboutPath, 'utf8');
        expect(aboutContent).toContain('__APP_VERSION__');
        expect(aboutContent).toContain('__BUILD_DATE__');
    });
});
