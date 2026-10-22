'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const dns = require('node:dns').promises;
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, generateToken } = require('../setup');
const { createSampleFixture } = require('../helpers/workflowFixtures');
const media = require('../../services/koboMediaService');

// Real HTTP mounts, session validation, sample scope and database. Only external
// transport/DNS are replaced; all data is synthetic in the owned suite database.
describe('Recorded field media access', () => {
    const lab = 'MEDIA-LAB-A', foreignLab = 'MEDIA-LAB-B', project = 'MEDIA-PROJECT';
    const sampleId = 'MEDIA-SPECIMEN', configId = 'MEDIA-CONFIG';
    const source = 'https://media.example.test/api/v2/assets/FORM_A/data/123/attachments/456/';
    const small = 'https://media.example.test/api/v2/assets/FORM_A/data/attachments/small/?media_file=synthetic.jpg';
    const attachment = { id: 456, filename: 'synthetic.jpg', download_url: source, download_small: small };
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9]);
    let manager, foreign, managerId, get, lookup;
    const issue = token => request(app).get(`/api/kobo/media/samples/${sampleId}`)
        .set('Authorization', `Bearer ${token}`);
    const signedUrl = async (token = manager) => {
        const response = await issue(token);
        expect(response.status).toBe(200);
        return response.body.urls.find(row => row.sourceUrl === source).url;
    };

    beforeAll(async () => {
        for (const id of [lab, foreignLab]) await prisma.lab.create({ data: { id, code: id, name: id, country: 'GTM' } });
        await prisma.project.create({ data: { id: project, code: project, name: project, labId: lab, status: 'ACTIVE' } });
        manager = await getAuthToken('LAB_MANAGER', lab, ['GTM'], [project]);
        foreign = await getAuthToken('LAB_MANAGER', foreignLab, ['GTM'], [project]);
        managerId = jwt.decode(manager).id;
        await prisma.user.updateMany({ where: { id: { in: [managerId, jwt.decode(foreign).id] } },
            data: { mustChangePassword: false } });
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, assignedLab: lab,
            labId: 'LEGACY-ACCESSION', projectCode: project, projectId: project, country: 'GTM', status: 'EXPECTED',
            fieldMetadata: JSON.stringify({ attachments: { value: [attachment] } }) } });
        await prisma.koboConfig.create({ data: { id: configId, labId: lab, projectCode: project,
            koboServerUrl: 'https://media.example.test', formId: 'FORM_A', apiToken: 'synthetic-lab-a-token' } });
        await prisma.koboConfig.create({ data: { id: 'MEDIA-FOREIGN-CONFIG', labId: foreignLab, projectCode: project,
            koboServerUrl: 'https://media.example.test', formId: 'FORM_A', apiToken: 'synthetic-lab-b-token' } });
    });
    beforeEach(() => {
        lookup = jest.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
        get = jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: jpeg,
            headers: { 'content-type': 'image/jpeg', 'content-length': String(jpeg.length) } });
    });
    afterEach(() => jest.restoreAllMocks());

    test('anonymous arbitrary proxy and issuance are rejected without outbound I/O', async () => {
        expect((await request(app).get('/api/kobo/media').query({ url: source })).status).toBe(401);
        expect((await request(app).get(`/api/kobo/media/samples/${sampleId}`)).status).toBe(401);
        expect(get).not.toHaveBeenCalled();
        expect(lookup).not.toHaveBeenCalled();
    });
    test('owning-scope issuance is private, short lived, exact-record only; other lab is denied', async () => {
        const response = await issue(manager);
        expect(response.status).toBe(200);
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(response.body.urls.map(row => row.sourceUrl)).toEqual([source, small]);
        expect(response.body.expiresAt - Math.floor(Date.now() / 1000)).toBeGreaterThan(590);
        expect(response.body.expiresAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 600);
        expect(response.text).not.toContain('synthetic-lab-a-token');
        expect((await issue(foreign)).status).toBe(403);
        expect(get).not.toHaveBeenCalled();
    });
    test('signed image uses its exact lab/config, no redirects/proxy, pinned public DNS and safe headers', async () => {
        const url = await signedUrl();
        const response = await request(app).get(url);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(jpeg);
        expect(response.headers).toMatchObject({ 'content-type': 'image/jpeg', 'cache-control': 'private, no-store',
            'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-disposition': 'inline' });
        expect(response.headers['content-security-policy']).toContain('sandbox');
        expect(get).toHaveBeenCalledWith(source, expect.objectContaining({
            headers: { Authorization: 'Token synthetic-lab-a-token' }, maxRedirects: 0, proxy: false,
            maxContentLength: media.MAX_IMAGE_BYTES, maxBodyLength: media.MAX_IMAGE_BYTES, timeout: 15000
        }));
        const agent = get.mock.calls[0][1].httpsAgent;
        const pinned = await new Promise((resolve, reject) => agent.options.lookup('media.example.test', { all: true },
            (error, addresses) => error ? reject(error) : resolve(addresses)));
        expect(pinned).toEqual([{ address: '93.184.216.34', family: 4 }]);
        expect(lookup).toHaveBeenCalledTimes(1);
    });
    test('a valid reference cannot be combined with caller-controlled URLs', async () => {
        const url = await signedUrl();
        expect((await request(app).get(url + '&url=' + encodeURIComponent(source))).status).toBe(400);
        expect((await request(app).get(`/api/kobo/media/samples/${sampleId}?url=${encodeURIComponent(source)}`)
            .set('Authorization', `Bearer ${manager}`)).status).toBe(400);
        expect(get).not.toHaveBeenCalled();
    });
    test.each([
        'https://media.example.test/api/v2/assets.json',
        'https://media.example.test/api/v2/assets/FORM_B/data/123/attachments/456/',
        'https://other.example.test/api/v2/assets/FORM_A/data/123/attachments/456/',
        'http://media.example.test/api/v2/assets/FORM_A/data/123/attachments/456/',
        'https://media.example.test/api/v2/assets/FORM_A/data/123/attachments/456/?token=not-a-secret'
    ])('stored non-attachment or unauthorized origin is not issued: %s', async badSource => {
        await prisma.sample.update({ where: { id: sampleId }, data: { fieldMetadata: JSON.stringify({ attachments: [
            { ...attachment, download_url: badSource, download_small: undefined }
        ] }) } });
        try {
            const response = await issue(manager);
            expect(response.status).toBe(200);
            expect(response.body.urls).toEqual([]);
            expect(get).not.toHaveBeenCalled();
        } finally {
            await prisma.sample.update({ where: { id: sampleId }, data: {
                fieldMetadata: JSON.stringify({ attachments: { value: [attachment] } }) } });
        }
    });
    test('legacy raw stored attachments receive the same exact reference policy', async () => {
        await prisma.sample.update({ where: { id: sampleId }, data: { fieldMetadata: '{}',
            metadata: JSON.stringify({ _attachments: [{ ...attachment, download_small: undefined, download_small_url: small }] }) } });
        try { expect((await issue(manager)).body.urls.map(row => row.sourceUrl)).toEqual([source, small]); }
        finally { await prisma.sample.update({ where: { id: sampleId }, data: { metadata: null,
            fieldMetadata: JSON.stringify({ attachments: { value: [attachment] } }) } }); }
    });
    test('expired and tampered references fail before DNS/HTTP', async () => {
        const url = await signedUrl(), token = new URL('http://local' + url).searchParams.get('token');
        const tampered = token.slice(0, -2) + (token.at(-2) === 'A' ? 'B' : 'A') + token.at(-1);
        expect((await request(app).get('/api/kobo/media').query({ token: tampered })).status).toBe(401);
        const now = Date.now();
        jest.spyOn(Date, 'now').mockReturnValue(now + 601000);
        expect((await request(app).get(url)).status).toBe(401);
        expect(get).not.toHaveBeenCalled();
        expect(lookup).not.toHaveBeenCalled();
    });
    test.each([{ isActive: false }, { mustChangePassword: true }, { tokenVersion: 1 }, { labId: foreignLab }])(
        'current principal state invalidates an already issued URL: %j', async changed => {
            const url = await signedUrl();
            await prisma.user.update({ where: { id: managerId }, data: changed });
            try { expect([401, 403]).toContain((await request(app).get(url)).status); expect(get).not.toHaveBeenCalled(); }
            finally { await prisma.user.update({ where: { id: managerId },
                data: { isActive: true, mustChangePassword: false, tokenVersion: 0, labId: lab } }); }
        });
    test('impersonation actor revocation invalidates the issued reference', async () => {
        const actor = await prisma.user.create({ data: { id: 'MEDIA-ACTOR', username: 'media_actor',
            email: 'media_actor@example.test', password: 'synthetic-unused', role: 'SUPER_ADMIN' } });
        const principal = await prisma.user.findUnique({ where: { id: managerId } });
        const token = jwt.sign({ ...jwt.decode(generateToken(principal)), act: { id: actor.id, tokenVersion: 0 } },
            process.env.JWT_SECRET);
        const url = await signedUrl(token);
        await prisma.user.update({ where: { id: actor.id }, data: { tokenVersion: 1 } });
        expect((await request(app).get(url)).status).toBe(401);
        expect(get).not.toHaveBeenCalled();
    });
    test('deactivated configuration and changed stored reference revoke old capabilities', async () => {
        const url = await signedUrl();
        await prisma.koboConfig.update({ where: { id: configId }, data: { isActive: false } });
        try { expect((await request(app).get(url)).status).toBe(404); }
        finally { await prisma.koboConfig.update({ where: { id: configId }, data: { isActive: true } }); }
        await prisma.sample.update({ where: { id: sampleId }, data: { fieldMetadata: '{}' } });
        try { expect((await request(app).get(url)).status).toBe(404); }
        finally { await prisma.sample.update({ where: { id: sampleId }, data: {
            fieldMetadata: JSON.stringify({ attachments: { value: [attachment] } }) } }); }
        expect(get).not.toHaveBeenCalled();
    });
    test('redirects are not followed and upstream error/config details are never reflected', async () => {
        const url = await signedUrl();
        get.mockResolvedValue({ status: 302, headers: { location: 'https://other.example.test' }, data: Buffer.alloc(0) });
        expect((await request(app).get(url)).status).toBe(502);
        expect(get).toHaveBeenCalledTimes(1);
        get.mockRejectedValue(new Error('synthetic-lab-a-token upstream details'));
        const response = await request(app).get(url);
        expect(response.status).toBe(502);
        expect(response.text).not.toContain('synthetic-lab-a-token');
    });
    test.each(['text/html', 'image/svg+xml', 'application/json'])('non-raster %s is refused', async type => {
        get.mockResolvedValue({ status: 200, data: Buffer.from('<script>synthetic</script>'), headers: { 'content-type': type } });
        expect((await request(app).get(await signedUrl())).status).toBe(415);
    });
    test('buffer, declared length and axios decompression limits reject oversized data', async () => {
        const url = await signedUrl();
        get.mockResolvedValue({ status: 200, data: Buffer.alloc(media.MAX_IMAGE_BYTES + 1), headers: { 'content-type': 'image/jpeg' } });
        expect((await request(app).get(url)).status).toBe(413);
        get.mockResolvedValue({ status: 200, data: jpeg,
            headers: { 'content-type': 'image/jpeg', 'content-length': String(media.MAX_IMAGE_BYTES + 1) } });
        expect((await request(app).get(url)).status).toBe(413);
        get.mockRejectedValue(Object.assign(new Error('maxContentLength size exceeded'), { code: 'ERR_BAD_RESPONSE' }));
        expect((await request(app).get(url)).status).toBe(413);
    });
    test.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fc00::1'])(
        'private resolved address %s is rejected before credentials can leave', async address => {
            lookup.mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }]);
            expect((await request(app).get(await signedUrl())).status).toBe(404);
            expect(get).not.toHaveBeenCalled();
        });
});
