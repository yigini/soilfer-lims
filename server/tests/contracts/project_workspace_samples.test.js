'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');

describe('Project Workspace Samples Server-Side Search, Filtering & Pagination Contracts', () => {
    const SUFFIX = 'PAG-' + Date.now();
    let testLab;
    let testManager;
    let authManager;
    let project;
    const trackedSampleIds = [];

    const signToken = (user) => {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                labId: user.labId,
                tokenVersion: user.tokenVersion || 1
            },
            process.env.JWT_SECRET || 'test-secret-key-12345',
            { expiresIn: '1h' }
        );
    };

    beforeAll(async () => {
        // Setup lab
        testLab = await prisma.lab.create({
            data: { id: 'LAB-' + SUFFIX, code: 'L' + SUFFIX.slice(-3), name: 'Lab ' + SUFFIX, country: 'Guatemala', isActive: true }
        });

        // Setup manager user
        testManager = await prisma.user.create({
            data: {
                id: 'usr-mgr-' + SUFFIX,
                username: 'mgr_' + SUFFIX,
                email: 'mgr@' + SUFFIX + '.test',
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: testLab.id,
                tokenVersion: 1
            }
        });
        authManager = `Bearer ${signToken(testManager)}`;

        // Create test project
        project = await prisma.project.create({
            data: {
                id: 'PROJ-' + SUFFIX,
                code: 'PROJ-' + SUFFIX,
                name: 'Pagination Project ' + SUFFIX,
                status: 'ACTIVE',
                projectType: 'OPEN_INTAKE',
                labId: testLab.id,
                expectedSampleCount: 60
            }
        });
        await prisma.projectLab.create({
            data: { id: 'pl-' + SUFFIX, projectCode: project.code, labId: testLab.id, role: 'OWNER' }
        });

        // Create 60 samples:
        // - 50 samples on page 1 (EXPECTED)
        // - 9 samples on page 2 (EXPECTED)
        // - 1 sample on page 2 with unique search ID and status PROCESSING
        for (let i = 1; i <= 50; i++) {
            const sid = `SMP-${SUFFIX}-P1-${String(i).padStart(3, '0')}`;
            trackedSampleIds.push(sid);
            await prisma.sample.create({
                data: {
                    id: sid,
                    originalId: sid,
                    projectId: project.id,
                    projectCode: project.code,
                    status: 'EXPECTED',
                    assignedLab: testLab.id
                }
            });
        }

        for (let i = 51; i <= 59; i++) {
            const sid = `SMP-${SUFFIX}-P2-${String(i).padStart(3, '0')}`;
            trackedSampleIds.push(sid);
            await prisma.sample.create({
                data: {
                    id: sid,
                    originalId: sid,
                    projectId: project.id,
                    projectCode: project.code,
                    status: 'EXPECTED',
                    assignedLab: testLab.id
                }
            });
        }

        const specialId = `SMP-${SUFFIX}-SPECIAL-BEYOND-P1`;
        trackedSampleIds.push(specialId);
        await prisma.sample.create({
            data: {
                id: specialId,
                originalId: specialId,
                projectId: project.id,
                projectCode: project.code,
                status: 'PROCESSING',
                assignedLab: testLab.id
            }
        });
    });

    afterAll(async () => {
        if (trackedSampleIds.length > 0) {
            await prisma.sample.deleteMany({ where: { id: { in: trackedSampleIds } } });
        }
        if (project) {
            await prisma.projectLab.deleteMany({ where: { projectCode: project.code } });
            await prisma.project.deleteMany({ where: { id: project.id } });
        }
        if (testManager) {
            await prisma.user.deleteMany({ where: { id: testManager.id } });
        }
        if (testLab) {
            await prisma.lab.deleteMany({ where: { id: testLab.id } });
        }
    });

    it('returns page 1 with 50 samples and correct total count header of 60', async () => {
        const res = await request(app)
            .get(`/api/projects/${project.id}/samples?page=1&limit=50`)
            .set('Authorization', authManager);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(50);
        expect(res.headers['x-total-count']).toBe('60');

        // Confirm the beyond-page-1 sample is NOT in this initial page
        const found = res.body.find(s => s.id.includes('SPECIAL-BEYOND-P1'));
        expect(found).toBeUndefined();
    });

    it('returns page 2 with remaining 10 samples including the beyond-page-1 sample', async () => {
        const res = await request(app)
            .get(`/api/projects/${project.id}/samples?page=2&limit=50`)
            .set('Authorization', authManager);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(10);
        expect(res.headers['x-total-count']).toBe('60');

        const found = res.body.find(s => s.id.includes('SPECIAL-BEYOND-P1'));
        expect(found).toBeDefined();
        expect(found.status).toBe('PROCESSING');
    });

    it('searches across the whole project and finds matching sample beyond page 1 on page 1 of results', async () => {
        const res = await request(app)
            .get(`/api/projects/${project.id}/samples?page=1&limit=50&q=SPECIAL-BEYOND-P1`)
            .set('Authorization', authManager);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.headers['x-total-count']).toBe('1');
        expect(res.body[0].id).toContain('SPECIAL-BEYOND-P1');
        expect(res.body[0].status).toBe('PROCESSING');
    });

    it('filters by stage index across the entire project (stage 2 / labWork)', async () => {
        const res = await request(app)
            .get(`/api/projects/${project.id}/samples?page=1&limit=50&stage=2`)
            .set('Authorization', authManager);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.headers['x-total-count']).toBe('1');
        expect(res.body[0].status).toBe('PROCESSING');
    });

    it('filters by named stage key across the entire project (stage=labWork)', async () => {
        const res = await request(app)
            .get(`/api/projects/${project.id}/samples?page=1&limit=50&stage=labWork`)
            .set('Authorization', authManager);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.headers['x-total-count']).toBe('1');
        expect(res.body[0].status).toBe('PROCESSING');
    });

    it('filters by stage 0 (awaitingArrival) and paginates across 59 expected samples', async () => {
        // Page 1 of stage 0
        const resPage1 = await request(app)
            .get(`/api/projects/${project.id}/samples?page=1&limit=50&stage=0`)
            .set('Authorization', authManager);

        expect(resPage1.status).toBe(200);
        expect(resPage1.body.length).toBe(50);
        expect(resPage1.headers['x-total-count']).toBe('59');

        // Page 2 of stage 0
        const resPage2 = await request(app)
            .get(`/api/projects/${project.id}/samples?page=2&limit=50&stage=0`)
            .set('Authorization', authManager);

        expect(resPage2.status).toBe(200);
        expect(resPage2.body.length).toBe(9);
        expect(resPage2.headers['x-total-count']).toBe('59');
    });

    it('combines search and stage filters accurately', async () => {
        const res = await request(app)
            .get(`/api/projects/${project.id}/samples?page=1&limit=50&stage=0&q=P2-055`)
            .set('Authorization', authManager);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.headers['x-total-count']).toBe('1');
        expect(res.body[0].id).toContain('P2-055');
    });

    it('returns empty array and zero total count when search yields no matches', async () => {
        const res = await request(app)
            .get(`/api/projects/${project.id}/samples?page=1&limit=50&q=DOES-NOT-EXIST-ANYWHERE`)
            .set('Authorization', authManager);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
        expect(res.headers['x-total-count']).toBe('0');
    });

    it('returns empty array when page exceeds total pages without error', async () => {
        const res = await request(app)
            .get(`/api/projects/${project.id}/samples?page=99&limit=50`)
            .set('Authorization', authManager);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
        expect(res.headers['x-total-count']).toBe('60');
    });
});
