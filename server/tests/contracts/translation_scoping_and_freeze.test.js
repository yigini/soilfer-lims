const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { assembleReport } = require('../../services/reportAssembly');

describe('Translation Scoping, Lab Isolation & Report Freeze Contracts', () => {
    let superAdminToken;
    let labManagerToken;
    let technicianToken;
    let technicianId;
    let testLab;

    beforeAll(async () => {
        // Find or create test lab
        testLab = await prisma.lab.findFirst();
        if (!testLab) {
            testLab = await prisma.lab.create({
                data: {
                    name: 'Test Reference Lab',
                    code: 'TLAB-01',
                    country: 'HND'
                }
            });
        }

        const languages = [
            { code: 'en', name: 'English', isDefault: true },
            { code: 'es', name: 'Español', isDefault: false },
            { code: 'es-419', name: 'Español (Latinoamérica)', isDefault: false },
            { code: 'fr', name: 'Français', isDefault: false },
            { code: 'pt', name: 'Português', isDefault: false }
        ];
        for (const lang of languages) {
            await prisma.language.upsert({
                where: { code: lang.code },
                update: {},
                create: {
                    code: lang.code,
                    name: lang.name,
                    isDefault: lang.isDefault,
                    translations: '{}'
                }
            });
        }

        superAdminToken = await getAuthToken('SUPER_ADMIN');
        labManagerToken = await getAuthToken('LAB_MANAGER', testLab.code || testLab.id);
        technicianToken = await getAuthToken('LAB_TECHNICIAN', testLab.code || testLab.id);

        const decoded = jwt.decode(technicianToken);
        technicianId = decoded.id;
    });

    test('1. Lab manager without global rights is rejected with 403 when updating global translations', async () => {
        const res = await request(app)
            .put('/api/admin/languages/es')
            .set('Authorization', `Bearer ${labManagerToken}`)
            .send({
                scope: 'global',
                translations: { 'test.global.key': 'Intento de sobreescritura global' }
            });

        expect(res.status).toBe(403);
        expect(res.body.code || res.body.error).toMatch(/AUTH_FORBIDDEN|Forbidden|Only Super Admin/i);
    });

    test('2. Super Admin can publish global translations', async () => {
        const res = await request(app)
            .put('/api/admin/languages/es')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                scope: 'global',
                translations: { 'test.verified.global': 'Término global verificado' }
            });

        expect(res.status).toBe(200);
        expect(res.body.messageCode).toBe('TRANSLATIONS_UPDATED');
        expect(res.body.data?.scope).toBe('GLOBAL');
    });

    test('3. Lab manager can update translations scoped to their laboratory', async () => {
        const res = await request(app)
            .put('/api/admin/languages/es')
            .set('Authorization', `Bearer ${labManagerToken}`)
            .send({
                scope: 'lab',
                translations: { 'common.search': 'Buscar en Laboratorio Local' }
            });

        expect(res.status).toBe(200);
        expect(res.body.data?.scope || res.body.scope).toBe('LAB');
    });

    test('4. Lab-scoped translations overlay on top of global catalog when fetching with labId', async () => {
        const labRes = await request(app)
            .get('/api/admin/languages/es/catalog')
            .set('Authorization', `Bearer ${labManagerToken}`);
        expect(labRes.status).toBe(200);

        const labCatalog = labRes.body.data || labRes.body;
        expect(labCatalog['common.search']?.value).toBe('Buscar en Laboratorio Local');
    });

    test('5. Updating lab default language does not bulk overwrite staff personal language preference', async () => {
        // Set technician language to 'pt'
        const patchRes = await request(app)
            .patch('/api/auth/preferences')
            .set('Authorization', `Bearer ${technicianToken}`)
            .send({ language: 'pt' });
        expect(patchRes.status).toBe(200);

        // Lab manager sets lab default language to 'fr'
        const defaultRes = await request(app)
            .put('/api/admin/languages/fr/default')
            .set('Authorization', `Bearer ${labManagerToken}`);
        expect(defaultRes.status).toBe(200);

        // Verify technician language preference in DB remains 'pt'
        const userInDb = await prisma.user.findUnique({
            where: { id: String(technicianId) },
            select: { language: true }
        });
        expect(userInDb.language).toBe('pt');
    });

    test('6. Report assembly freezes snapshot with locale and terminologyVersion metadata', async () => {
        const sample = await prisma.sample.findFirst({
            where: { status: { in: ['APPROVED', 'COMPLETED', 'ACCEPTED'] } }
        });

        if (sample) {
            const reportPayload = await assembleReport(sample.id, {
                username: 'manager',
                name: 'Lab Manager',
                language: 'es-419'
            });

            expect(reportPayload.content).toBeDefined();
            expect(reportPayload.content.meta).toBeDefined();
            expect(reportPayload.content.meta.locale).toBe('es-419');
            expect(reportPayload.content.meta.terminologyVersion).toBe('1.0');
            expect(reportPayload.content.meta.frozenAt).toBeDefined();
        }
    });
});
