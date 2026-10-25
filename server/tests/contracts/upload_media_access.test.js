'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// The app can only use this new, exclusively owned directory. No historical
// upload or working database is inspected, copied or changed by this suite.
const root = path.resolve(__dirname, '..', '.tmp', 'uploads_' + randomUUID());
fs.mkdirSync(root, { recursive: true });
process.env.LIMS_OWNED_UPLOAD_ROOT = root;
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { createSampleFixture } = require('../helpers/workflowFixtures');
const { scanUploadTypes } = require('../../scripts/report_upload_types.cjs');
const { MAX_IMAGE_BYTES } = require('../../utils/uploadFiles');

describe('Intake image uploads and current-scope access', () => {
    const lab = 'UPLOAD-LAB-A', foreignLab = 'UPLOAD-LAB-B', project = 'UPLOAD-PROJECT';
    const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==', 'base64');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64');
    const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
    let manager, foreign, admin, managerId;
    const upload = (bytes = jpeg, filename = 'camera.jpg', contentType = 'image/jpeg', token = manager) =>
        request(app).post('/api/reception/upload-photo').set('Authorization', `Bearer ${token}`)
            .attach('photos', bytes, { filename, contentType });
    const access = (paths, token = manager) => request(app).post('/api/uploads/access')
        .set('Authorization', `Bearer ${token}`).send({ paths });
    const read = (url, token) => {
        const operation = request(app).get(url);
        return token ? operation.set('Authorization', `Bearer ${token}`) : operation;
    };
    const fresh = async () => {
        const response = await upload();
        expect(response.status).toBe(200);
        return response.body.url;
    };
    const signed = async source => {
        const response = await access([source]);
        expect(response.status).toBe(200);
        return response.body.urls[0].url;
    };
    const legacy = async (bytes = jpeg, fields = {}, assignedLab = lab) => {
        const filename = 'intake_legacy_' + randomUUID() + '.jpg';
        const source = '/uploads/intake/' + filename;
        fs.mkdirSync(path.join(root, 'intake'), { recursive: true });
        fs.writeFileSync(path.join(root, 'intake', filename), bytes, { flag: 'wx' });
        const id = 'UPLOAD-SAMPLE-' + randomUUID();
        await createSampleFixture(prisma, { data: { id, originalId: id, assignedLab,
            labId: 'OLD-ACCESSION', projectCode: project, projectId: project, country: 'GTM',
            status: 'EXPECTED', intakePhotos: JSON.stringify([source]), ...fields } });
        return { source, id, filename };
    };

    beforeAll(async () => {
        for (const id of [lab, foreignLab]) await prisma.lab.create({ data: { id, code: id, name: id, country: 'GTM' } });
        await prisma.project.create({ data: { id: project, code: project, name: project, labId: lab, status: 'ACTIVE' } });
        manager = await getAuthToken('LAB_MANAGER', lab, ['GTM'], [project]);
        foreign = await getAuthToken('LAB_MANAGER', foreignLab, ['GTM'], [project]);
        admin = await getAuthToken('SUPER_ADMIN');
        managerId = jwt.decode(manager).id;
        await prisma.user.updateMany({ where: { id: { in: [managerId, jwt.decode(foreign).id, jwt.decode(admin).id] } },
            data: { mustChangePassword: false } });
    });
    afterAll(async () => { delete process.env.LIMS_OWNED_UPLOAD_ROOT; await prisma.$disconnect(); });

    test('anonymous upload, issuance and old-path reads are denied', async () => {
        expect((await request(app).post('/api/reception/upload-photo').attach('photos', jpeg, 'test.jpg')).status).toBe(401);
        expect((await request(app).post('/api/uploads/access').send({ paths: [] })).status).toBe(401);
        expect((await read('/uploads/intake/intake_old.jpg')).status).toBe(401);
    });
    test.each([
        ['JPEG', jpeg, '.jpg', 'image/jpeg'], ['PNG', png, '.png', 'image/png'], ['WebP', webp, '.webp', 'image/webp']
    ])('%s bytes determine the UUID extension and round trip with safe headers', async (_, bytes, extension, type) => {
        const response = await upload(bytes, 'caller-controlled.html', 'text/plain');
        expect(response.status).toBe(200);
        const source = response.body.url;
        expect(source).toMatch(new RegExp('^/uploads/intake/[a-f0-9-]{36}\\' + extension + '$'));
        expect(response.body.urls).toEqual([source]);
        expect(response.body.photos).toEqual([{ url: source }]);
        const result = await read(source, manager);
        expect(result.status).toBe(200);
        expect(result.body).toEqual(bytes);
        expect(result.headers).toMatchObject({ 'content-type': type, 'cache-control': 'private, no-store',
            'content-disposition': 'inline', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
        expect(result.headers['content-security-policy']).toBe("default-src 'none'; img-src 'self'; sandbox");
        expect(result.headers['accept-ranges']).toBeUndefined();
    });
    test.each([
        ['HTML as JPEG', '<html><script>alert(1)</script></html>', 'attack.jpg', 'image/jpeg'],
        ['SVG', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'attack.svg', 'image/svg+xml'],
        ['plain text as PNG', 'This is not an image', 'attack.png', 'image/png'],
        ['empty image', '', 'attack.webp', 'image/webp']
    ])('%s is rejected before any file in the batch is written', async (_, text, filename, type) => {
        const before = fs.readdirSync(path.join(root, 'intake'));
        const result = await request(app).post('/api/reception/upload-photo').set('Authorization', `Bearer ${manager}`)
            .attach('photos', jpeg, 'good.jpg').attach('photos', Buffer.from(text), { filename, contentType: type });
        expect(result.status).toBe(415);
        expect(fs.readdirSync(path.join(root, 'intake'))).toEqual(before);
    });
    test('file count and size limits fail without saving a partial batch', async () => {
        const before = fs.readdirSync(path.join(root, 'intake'));
        const tooMany = request(app).post('/api/reception/upload-photo').set('Authorization', `Bearer ${manager}`);
        for (let i = 0; i < 6; i++) tooMany.attach('photos', jpeg, `${i}.jpg`);
        expect((await tooMany).status).toBe(400);
        expect((await upload(Buffer.alloc(MAX_IMAGE_BYTES + 1), 'large.jpg')).status).toBe(413);
        expect(fs.readdirSync(path.join(root, 'intake'))).toEqual(before);
    });
    test('five valid files remain supported', async () => {
        const batch = request(app).post('/api/reception/upload-photo').set('Authorization', `Bearer ${manager}`).field('labId', lab);
        for (let i = 0; i < 5; i++) batch.attach('photos', jpeg, `${i}.jpg`);
        const response = await batch;
        expect(response.status).toBe(200);
        expect(new Set(response.body.urls).size).toBe(5);
    });
    test('pending new uploads retain server-recorded lab ownership', async () => {
        const source = await fresh();
        expect((await access([source], foreign)).status).toBe(403);
        expect((await read(source, foreign)).status).toBe(403);
        expect((await upload(jpeg, 'photo.jpg', 'image/jpeg', foreign).field('labId', lab)).status).toBe(403);
        expect((await request(app).post('/api/reception/upload-photo').set('Authorization', `Bearer ${admin}`)
            .field('labId', lab).attach('photos', jpeg, 'admin.jpg')).status).toBe(200);
    });
    test('an inserted foreign sample reference cannot acquire a new file', async () => {
        const source = await fresh(), id = 'UPLOAD-INJECT-' + randomUUID();
        await createSampleFixture(prisma, { data: { id, originalId: id, assignedLab: foreignLab, labId: foreignLab,
            country: 'GTM', projectCode: project, projectId: project, intakePhotos: JSON.stringify([source]) } });
        expect((await access([source], foreign)).status).toBe(404);
        expect((await read(source, foreign)).status).toBe(404);
    });
    test('signed access has exact path, short lifetime and no arbitrary URL inputs', async () => {
        const source = await fresh(), second = await fresh();
        const issued = await access([source]);
        expect(issued.status).toBe(200);
        expect(issued.headers['cache-control']).toBe('private, no-store');
        expect(issued.body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000) + 590);
        expect(issued.body.expiresAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 600);
        const url = issued.body.urls[0].url;
        expect((await read(url)).body).toEqual(jpeg);
        expect((await read(second + url.slice(source.length))).status).toBe(401);
        expect((await read(url + '&url=https://example.test/')).status).toBe(400);
        expect((await request(app).post('/api/uploads/access').set('Authorization', `Bearer ${manager}`)
            .send({ paths: [source], url: 'https://example.test/' })).status).toBe(400);
        expect((await access(['https://example.test/photo.jpg'])).status).toBe(400);
        const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 601000);
        try { expect((await read(url)).status).toBe(401); } finally { clock.mockRestore(); }
    });
    test('tampered signatures cannot authorize a read', async () => {
        const source = await fresh(), url = await signed(source);
        const parsed = new URL(url, 'http://localhost');
        const [body, signature] = parsed.searchParams.get('token').split('.');
        parsed.searchParams.set('token', body + '.' + (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1));
        expect((await read(parsed.pathname + parsed.search)).status).toBe(401);
    });
    test('a short remaining session bounds the issued image link', async () => {
        const source = await fresh(), payload = jwt.decode(manager);
        delete payload.exp;
        delete payload.iat;
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 30 });
        const response = await access([source], token);
        expect(response.status).toBe(200);
        expect(response.body.expiresAt).toBe(jwt.decode(token).exp);
    });
    test('malformed path lists and unsupported upload fields are rejected', async () => {
        for (const paths of [null, '/uploads/intake/test.jpg', ['/uploads/intake/../escape.jpg'], Array(101).fill('/uploads/intake/test.jpg')]) {
            expect((await access(paths)).status).toBe(400);
        }
        expect((await request(app).post('/api/reception/upload-photo').set('Authorization', `Bearer ${manager}`)
            .field('destination', 'spectra').attach('photos', jpeg, 'photo.jpg')).status).toBe(400);
    });
    test('a closed owning laboratory revokes pending image access', async () => {
        const source = await fresh(), url = await signed(source);
        await prisma.lab.update({ where: { id: lab }, data: { isActive: false } });
        try {
            expect((await read(url)).status).toBe(404);
            expect((await upload()).status).toBe(403);
        } finally { await prisma.lab.update({ where: { id: lab }, data: { isActive: true } }); }
    });
    test.each([
        ['revoked session', { tokenVersion: 1 }], ['inactive user', { isActive: false }],
        ['password change required', { mustChangePassword: true }], ['changed lab scope', { labId: foreignLab }]
    ])('%s is enforced again after issuing an image link', async (_, data) => {
        const source = await fresh(), url = await signed(source);
        await prisma.user.update({ where: { id: managerId }, data });
        try { expect([401, 403]).toContain((await read(url)).status); }
        finally { await prisma.user.update({ where: { id: managerId }, data: {
            tokenVersion: 0, isActive: true, mustChangePassword: false, labId: lab } }); }
    });
    test('an impersonation link retains and revalidates its administrator actor', async () => {
        const source = await fresh(), actorId = jwt.decode(admin).id;
        const impersonated = jwt.sign({ ...jwt.decode(manager), act: { id: actorId, tokenVersion: 0 } }, process.env.JWT_SECRET);
        const issued = await access([source], impersonated);
        expect(issued.status).toBe(200);
        const url = issued.body.urls[0].url;
        expect((await read(url)).status).toBe(200);
        await prisma.user.update({ where: { id: actorId }, data: { isActive: false } });
        try { expect((await read(url)).status).toBe(401); }
        finally { await prisma.user.update({ where: { id: actorId }, data: { isActive: true } }); }
    });
    test('legacy stable paths require exact persisted references and current assigned lab', async () => {
        const { source, id } = await legacy();
        expect((await read(source, manager)).body).toEqual(jpeg);
        expect((await read(await signed(source))).body).toEqual(jpeg);
        expect((await access([source], foreign)).status).toBe(403);
        const url = await signed(source);
        await prisma.sample.update({ where: { id }, data: { assignedLab: foreignLab } });
        expect((await read(url)).status).toBe(403);
    });
    test.each(['receptionPhotos', 'receptionIntakePhotos', 'nonConformancePhotos'])('legacy %s references remain usable', async field => {
        const saved = await legacy();
        const reception = field === 'receptionPhotos' ? { photos: [saved.source] } : { intakePhotos: [saved.source] };
        await prisma.sample.update({ where: { id: saved.id }, data: { intakePhotos: null,
            receptionData: field === 'nonConformancePhotos' ? null : JSON.stringify(reception),
            metadata: field === 'nonConformancePhotos' ? JSON.stringify({ nonConformance: { photos: [saved.source] } }) : null } });
        expect((await read(saved.source, manager)).status).toBe(200);
    });
    test('unreferenced and ambiguous legacy paths fail closed', async () => {
        const file = 'unreferenced_' + randomUUID() + '.jpg';
        fs.writeFileSync(path.join(root, 'intake', file), jpeg, { flag: 'wx' });
        expect((await read('/uploads/intake/' + file, manager)).status).toBe(404);
        const { source } = await legacy(), id = 'UPLOAD-AMBIGUOUS-' + randomUUID();
        await createSampleFixture(prisma, { data: { id, originalId: id, assignedLab: foreignLab,
            labId: foreignLab, country: 'GTM', projectCode: project, projectId: project, intakePhotos: JSON.stringify([source]) } });
        expect((await read(source, manager)).status).toBe(403);
        expect((await read(source, foreign)).status).toBe(403);
    });
    test('legacy non-images and oversized images are never served inline', async () => {
        const { source } = await legacy(Buffer.from('<svg><script>alert(1)</script></svg>'));
        expect((await read(source, manager)).status).toBe(415);
        const large = await legacy(Buffer.alloc(MAX_IMAGE_BYTES + 1));
        expect((await read(large.source, manager)).status).toBe(413);
    });
    test('unavailable legacy entries do not hide authorized photos in a mixed view', async () => {
        const valid = await fresh(), unsupported = await legacy(Buffer.from('<html>synthetic</html>'));
        const response = await access([unsupported.source, valid]);
        expect(response.status).toBe(200);
        expect(response.body.urls.map(row => row.sourceUrl)).toEqual([valid]);
        expect((await read(response.body.urls[0].url)).body).toEqual(jpeg);
    });
    test('saved sample references retain central project and national read scopes', async () => {
        const source = await fresh(), id = 'UPLOAD-READER-' + randomUUID();
        await createSampleFixture(prisma, { data: { id, originalId: id, assignedLab: lab, labId: 'OLD-ACCESSION',
            country: 'GTM', projectCode: project, projectId: project, intakePhotos: JSON.stringify([source]) } });
        for (const role of ['VIEWER', 'MASTER_USER']) {
            const token = await getAuthToken(role, null, ['GTM'], [project]);
            await prisma.user.update({ where: { id: jwt.decode(token).id }, data: { mustChangePassword: false } });
            const response = await access([source], token);
            expect(response.status).toBe(200);
            expect((await read(response.body.urls[0].url)).body).toEqual(jpeg);
        }
    });
    test('non-regular ownership receipts never downgrade to legacy access', async () => {
        const { source, filename } = await legacy();
        fs.mkdirSync(path.join(root, '.intake-ownership', filename + '.json'));
        expect((await read(source, manager)).status).toBe(404);
    });
    test.each([['spectra/raw.csv', 401], ['staging/manifest.json', 401],
        ['.intake-ownership/receipt.json', 401], ['intake/.hidden.jpg', 404]])('%s has no static fallback', async (suffix, anonymousStatus) => {
        expect((await read('/uploads/' + suffix)).status).toBe(anonymousStatus);
        expect((await read('/uploads/' + suffix, manager)).status).toBe(404);
    });
    test('traversal and encoded separators cannot select a filesystem path', async () => {
        for (const value of ['/uploads/intake/../spectra/raw.csv', '/uploads/intake/x%2fsecret.jpg', '/uploads/intake/x%5csecret.jpg', '/uploads/intake/%E0%A4%A.jpg']) {
            expect([400, 404]).toContain((await read(value, manager)).status);
        }
    });
    test('the report scans intake and spectral/staging headers without changing files', () => {
        const scanRoot = path.join(root, 'synthetic-report');
        for (const name of ['intake', 'spectra', 'staging']) fs.mkdirSync(path.join(scanRoot, name), { recursive: true });
        const records = { 'intake/photo.jpg': jpeg, 'intake/old.html': Buffer.from('<html>synthetic</html>'),
            'spectra/instrument.csv': Buffer.from('wavelength,value\n1,2\n'), 'staging/manifest.json': Buffer.from('{"synthetic":true}') };
        for (const [name, bytes] of Object.entries(records)) fs.writeFileSync(path.join(scanRoot, name), bytes, { flag: 'wx' });
        const before = Object.fromEntries(Object.keys(records).map(name => [name, fs.statSync(path.join(scanRoot, name)).mtimeMs]));
        // A directory junction works on Windows without developer-mode file
        // symlink privileges, and remains confined to these synthetic fixtures.
        fs.symlinkSync(path.join(scanRoot, 'spectra'), path.join(scanRoot, 'intake', 'linked'), 'junction');
        const report = scanUploadTypes(scanRoot);
        expect(report.readOnly).toBe(true);
        expect(report.errors).toEqual([]);
        expect(report.nonImageCount).toBe(3);
        expect(report.directories.map(row => row.state)).toEqual(['scanned', 'scanned', 'scanned']);
        expect(report.files.find(row => row.path === 'intake/photo.jpg').contentType).toBe('image/jpeg');
        expect(report.files.find(row => row.path === 'intake/linked').state).toBe('symlink-or-outside-refused');
        expect(report.files.some(row => row.path.startsWith('intake/linked/'))).toBe(false);
        expect(JSON.stringify(report)).not.toContain('wavelength,value');
        for (const [name, bytes] of Object.entries(records)) {
            expect(fs.readFileSync(path.join(scanRoot, name))).toEqual(bytes);
            expect(fs.statSync(path.join(scanRoot, name)).mtimeMs).toBe(before[name]);
        }
    });
});
