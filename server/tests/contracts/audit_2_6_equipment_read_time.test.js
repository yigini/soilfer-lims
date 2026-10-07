const { qualificationAtRead, getReadiness, equipmentView } = require('../../services/equipmentQualificationService');
const policyService = require('../../services/policyService');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');
const { randomUUID } = require('node:crypto');

describe('Audit 2.6 equipment read-time qualification', () => {
    const now = new Date('2026-10-07T10:00:00.000Z');
    const asset = { id: 'read-only-asset', labId: 'policy-lab', criticality: 'CRITICAL', status: 'IN_SERVICE',
        qualification: { calibrationStatus: 'OK', verificationStatus: 'NOT_CONFIGURED',
            nextCalibrationDueDate: new Date('2026-10-06T10:00:00.000Z') } };

    test('a stale stored OK becomes OVERDUE without changing the source record', () => {
        const before = JSON.stringify(asset);
        expect(qualificationAtRead(asset, now).calibrationStatus).toBe('OVERDUE');
        expect(getReadiness(asset, { now })).toBe('BLOCKED');
        expect(JSON.stringify(asset)).toBe(before);
    });

    test('verification due dates also block while future calibration stays OK', () => {
        const current = { ...asset, qualification: { calibrationStatus: 'OK', verificationStatus: 'OK',
            nextCalibrationDueDate: new Date('2026-12-01'), nextVerificationDueDate: new Date('2026-10-01') } };
        expect(qualificationAtRead(current, now).verificationStatus).toBe('OVERDUE');
        expect(getReadiness(current, { now })).toBe('BLOCKED');
    });

    test('an unconfigured qualification has no implicit READY fallback', () => {
        expect(getReadiness({ ...asset, qualification: null }, { now })).toBe('NOT_CONFIGURED');
        expect(getReadiness({ ...asset, qualification: { calibrationStatus: 'NOT_CONFIGURED',
            verificationStatus: 'NOT_CONFIGURED' } }, { now })).toBe('NOT_CONFIGURED');
    });

    test.each([['BLOCK', 'BLOCKED'], ['WARN', 'WARNING'], ['ALLOW', 'READY']])(
        'unconfigured readiness obeys resolved %s policy', (action, expected) => {
            expect(getReadiness({ ...asset, qualification: null }, { now,
                unconfiguredReadiness: { CRITICAL: action } })).toBe(expected);
        });

    test('ALLOW never makes overdue qualification ready', () => {
        expect(getReadiness(asset, { now, unconfiguredReadiness: { CRITICAL: 'ALLOW' } })).toBe('BLOCKED');
    });

    test('equipment views read the lab policy and return the projected dates/status', async () => {
        const db = {};
        const get = jest.spyOn(policyService, 'get').mockResolvedValue({ CRITICAL: 'BLOCK', IMPORTANT: 'WARN', NON_CRITICAL: 'ALLOW' });
        try {
            const view = await equipmentView(asset, { db, now });
            expect(get).toHaveBeenCalledWith(asset.labId, 'equipment.unconfiguredReadiness', { db });
            expect(view.qualification.calibrationStatus).toBe('OVERDUE');
            expect(view.readiness).toBe('BLOCKED');
            expect(asset.qualification.calibrationStatus).toBe('OK');
            const warning = await equipmentView({ ...asset, criticality: 'IMPORTANT', qualification: null }, { db, now });
            expect(warning.readinessWarnings).toEqual(['EQUIPMENT_NOT_CONFIGURED_WARNING']);
        } finally { get.mockRestore(); }
    });
});

describe('Audit 2.6 authenticated equipment reads', () => {
    const suffix = randomUUID(), labId = `eq26-${suffix}`, userId = `eq26-user-${suffix}`;
    let token, overdue, unconfigured;
    beforeAll(async () => {
        await prisma.lab.create({ data: { id: labId, code: labId, name: 'Equipment read contract', country: 'TEST' } });
        await prisma.user.create({ data: { id: userId, username: userId, email: `${userId}@example.test`,
            password: 'owned-test-fixture', role: 'SUPER_ADMIN', isActive: true } });
        token = jwt.sign({ id: userId, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '1h' });
        const create = (id, due) => prisma.equipmentAsset.create({ data: { id, labId, name: id,
            assetType: 'PH_METER', internalAssetTag: id, status: 'IN_SERVICE', criticality: 'CRITICAL',
            qualification: { create: { id: randomUUID(), labId, calibrationStatus: due ? 'OK' : 'NOT_CONFIGURED',
                verificationStatus: 'NOT_CONFIGURED', nextCalibrationDueDate: due } } } });
        overdue = await create(`eq26-overdue-${suffix}`, new Date(Date.now() - 86400000));
        unconfigured = await create(`eq26-unconfigured-${suffix}`, null);
    });

    test('GET derives overdue status without any calibration event or database write', async () => {
        const before = await prisma.equipmentQualification.findUnique({ where: { equipmentId: overdue.id } });
        const audits = await prisma.auditLog.count();
        const response = await request(app).get(`/api/equipment/${overdue.id}`).set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
        expect(response.body.qualification.calibrationStatus).toBe('OVERDUE');
        expect(response.body.readiness).toBe('BLOCKED');
        expect(await prisma.equipmentQualification.findUnique({ where: { equipmentId: overdue.id } })).toEqual(before);
        expect(await prisma.equipmentEvent.count({ where: { equipmentId: overdue.id } })).toBe(0);
        expect(await prisma.auditLog.count()).toBe(audits);
    });

    test('GET uses the lab override for unconfigured critical equipment', async () => {
        const read = () => request(app).get(`/api/equipment/${unconfigured.id}`).set('Authorization', `Bearer ${token}`);
        expect((await read()).body.readiness).toBe('BLOCKED');
        await policyService.change({ id: userId, username: userId, role: 'SUPER_ADMIN' }, labId,
            { reason: 'Owned read-time policy contract', changes: [{ key: 'equipment.unconfiguredReadiness',
                value: { CRITICAL: 'WARN', IMPORTANT: 'BLOCK', NON_CRITICAL: 'ALLOW' } }] });
        const response = await read();
        expect(response.status).toBe(200);
        expect(response.body.readiness).toBe('WARNING');
        expect(response.body.readinessWarnings).toEqual(['EQUIPMENT_NOT_CONFIGURED_WARNING']);
        expect(await prisma.equipmentEvent.count({ where: { equipmentId: unconfigured.id } })).toBe(0);
    });
});
