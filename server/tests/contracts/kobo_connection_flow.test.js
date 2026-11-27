'use strict';
// End-to-end Kobo connection flow: link membership, clear refusals, cursor
// reset on a new form, and submissions the LIMS cannot recognise.
const fs = require('fs');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');

const { file: fixtureDbPath } = beforeGuards({ actor: 'system:fixture' });
process.env.DATABASE_PATH = fixtureDbPath;
process.env.DATABASE_URL = 'file:' + fixtureDbPath;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-kobo-connection-flow';

const prisma = require('../../prisma');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const koboService = require('../../services/koboService');

// Zero network calls.
jest.mock('../../services/koboService', () => ({
    fetchSubmissions: jest.fn(),
    transformSubmission: jest.fn(),
    testConnection: jest.fn(async () => ({ success: false, error: 'fixture: no network' })),
    findValue: jest.fn((obj, keys) => {
        for (const k of keys) {
            if (obj && obj[k] !== undefined) return obj[k];
        }
        return undefined;
    })
}));

const projectRoutes = require('../../routes/projectRoutes');
const koboRoutes = require('../../routes/koboRoutes');
const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);
app.use('/api/kobo', koboRoutes);

describe('Kobo connection flow', () => {
    const SUFFIX = 'KCF-' + Date.now();
    let labOwner, labDest, project, config, tokenAdmin;

    beforeAll(async () => {
        labOwner = await prisma.lab.create({ data: { id: 'LAB-O-' + SUFFIX, code: 'LO-' + SUFFIX.slice(-4), name: 'Owner ' + SUFFIX, country: 'Guatemala', isActive: true } });
        labDest = await prisma.lab.create({ data: { id: 'LAB-D-' + SUFFIX, code: 'LDS-' + SUFFIX.slice(-4), name: 'Dest ' + SUFFIX, country: 'Guatemala', isActive: true } });
        const admin = await prisma.user.create({ data: { id: 'usr-adm-' + SUFFIX, username: 'adm_' + SUFFIX, email: 'adm@' + SUFFIX + '.test', password: 'h', role: 'SUPER_ADMIN', tokenVersion: 1 } });
        tokenAdmin = 'Bearer ' + jwt.sign({ id: admin.id, username: admin.username, role: admin.role, tokenVersion: 1 }, process.env.JWT_SECRET);
        project = await prisma.project.create({ data: { id: 'PROJ-' + SUFFIX, code: 'PROJ-' + SUFFIX, name: 'Flow ' + SUFFIX, status: 'ACTIVE', projectType: 'KOBO_LINKED', labId: labOwner.id } });
        config = await prisma.koboConfig.create({ data: { id: 'CFG-' + SUFFIX, labId: labOwner.id, projectCode: project.code, koboServerUrl: 'https://kobo.fixture.test', formId: 'form_' + SUFFIX, apiToken: 't', isActive: true, lastSubmissionId: '100' } });
    });

    afterAll(async () => {
        await prisma.$disconnect();
        for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${fixtureDbPath}${suffix}`, { force: true });
    });

    it('reports submissions without a site ID or barcode and keeps the cursor so they are read again', async () => {
        koboService.fetchSubmissions.mockResolvedValueOnce([{ _id: 201, _uuid: 'u-201', 'grp/unknown_field': 'x' }]);
        koboService.transformSubmission.mockReturnValueOnce([]);
        const res = await request(app).post(`/api/kobo/sync/${labOwner.id}?configId=${config.id}`).set('Authorization', tokenAdmin);
        expect(res.status).toBe(200);
        expect(res.body.newSamples).toBe(0);
        expect(res.body.unrecognized).toBe(1);
        expect(res.body.unrecognizedFieldNames).toContain('grp/unknown_field');
        const fresh = await prisma.koboConfig.findUnique({ where: { id: config.id } });
        expect(fresh.lastSubmissionId).toBe('100');
    });

    it('still moves past a submission that has a site but no sample', async () => {
        koboService.fetchSubmissions.mockResolvedValueOnce([{ _id: 202, _uuid: 'u-202', site_id: 'S-202' }]);
        koboService.transformSubmission.mockReturnValueOnce([]);
        const res = await request(app).post(`/api/kobo/sync/${labOwner.id}?configId=${config.id}`).set('Authorization', tokenAdmin);
        expect(res.status).toBe(200);
        expect(res.body.unrecognized).toBe(0);
        const fresh = await prisma.koboConfig.findUnique({ where: { id: config.id } });
        expect(fresh.lastSubmissionId).toBe('202');
    });

    it('starts reading from the beginning when the form changes', async () => {
        const res = await request(app).put(`/api/projects/${project.code}/kobo-connections/${config.id}`)
            .set('Authorization', tokenAdmin).send({ formId: 'form_new_' + SUFFIX, isActive: true });
        expect(res.status).toBe(200);
        const fresh = await prisma.koboConfig.findUnique({ where: { id: config.id } });
        expect(fresh.formId).toBe('form_new_' + SUFFIX);
        expect(fresh.lastSubmissionId).toBeNull();
    });

    it('says which lab is missing from the project instead of a generic refusal', async () => {
        const orphan = await prisma.koboConfig.create({ data: { id: 'CFG-ORPHAN-' + SUFFIX, labId: labDest.id, projectCode: project.code, koboServerUrl: 'https://kobo.fixture.test', formId: 'form_o_' + SUFFIX, apiToken: 't', isActive: false } });
        const res = await request(app).put(`/api/projects/${project.code}/kobo-connections/${orphan.id}`)
            .set('Authorization', tokenAdmin).send({ formId: 'form_o2_' + SUFFIX, isActive: false });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('LAB_NOT_PROJECT_MEMBER');
        expect(res.body.message).toContain('Labs & people');
        await prisma.koboConfig.delete({ where: { id: orphan.id } });
    });

    it('adds the Kobo destination lab to a new project so later edits and syncs are allowed', async () => {
        const code = 'NEWK-' + SUFFIX.slice(-6);
        const res = await request(app).post('/api/projects').set('Authorization', tokenAdmin).send({
            name: 'New Kobo ' + SUFFIX, code, projectType: 'KOBO_LINKED', labId: labOwner.id,
            destinationLabId: labDest.id, koboFormId: 'form_k_' + SUFFIX, koboApiToken: 'tok', koboServerUrl: 'https://kobo.fixture.test'
        });
        expect(res.status).toBeLessThan(300);
        const link = await prisma.projectLab.findUnique({ where: { projectCode_labId: { projectCode: code.toUpperCase(), labId: labDest.id } } });
        expect(link).not.toBeNull();
        const proj = await prisma.project.findUnique({ where: { code: code.toUpperCase() } });
        expect(JSON.parse(proj.assignedLabIds || '[]')).toContain(labDest.id);
    });
});
