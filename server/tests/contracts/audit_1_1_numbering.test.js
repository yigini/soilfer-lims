const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../../prisma');
const policy = require('../../services/policyService');
const { registry, valid, PRESETS } = require('../../config/policyRegistry');
const { allocateConsignmentNumber, formatNumber } = require('../../services/consignmentNumberService');
const { getAuthToken } = require('../setup');
const id = () => crypto.randomUUID();

describe('Audit 1.1: laboratory consignment numbering', () => {
    let lab, manager;
    beforeEach(async () => {
        lab = await prisma.lab.create({ data: { id: id(), code: `A11${id().slice(0, 8).toUpperCase()}`, name: 'Consignment contract lab', country: 'GTM', timezone: 'Europe/Rome' } });
        manager = jwt.decode(await getAuthToken('LAB_MANAGER', lab.id));
    });
    const edit = changes => policy.change(manager, lab.id, { changes, reason: 'Consignment numbering approval' });
    const issue = (issuedAt = new Date(), projectCode) => prisma.$transaction(async tx => {
        const code = await allocateConsignmentNumber(tx, { labReference: lab.id, issuedAt, projectCode });
        return tx.consignment.create({ data: { id: id(), code, labId: lab.id, receivedBy: manager.username } });
    });
    test('50 simultaneous consignment transactions issue distinct numbers in their own namespace', async () => {
        const rows = await Promise.all(Array.from({ length: 50 }, () => issue()));
        expect(new Set(rows.map(row => row.code)).size).toBe(50);
        expect(rows.every(row => row.code.startsWith(`CSG-${lab.code}-`))).toBe(true);
        expect(await prisma.labSequence.findFirst({ where: { labId: lab.id, scope: 'CONSIGNMENT' } })).toMatchObject({ next: 51 });
        expect(await prisma.labSequence.count({ where: { labId: lab.id, scope: 'SAMPLE' } })).toBe(0);
    }, 60000);
    test('downstream failure rolls back the consignment and its sequence together', async () => {
        let reserved;
        await expect(prisma.$transaction(async tx => {
            reserved = await allocateConsignmentNumber(tx, { labReference: lab.id });
            await tx.consignment.create({ data: { id: id(), code: reserved, labId: lab.id, receivedBy: manager.username } });
            throw new Error('synthetic receipt failure');
        })).rejects.toThrow('synthetic receipt failure');
        expect(await prisma.consignment.count({ where: { labId: lab.id } })).toBe(0);
        expect(await prisma.labSequence.count({ where: { labId: lab.id } })).toBe(0);
        expect((await issue()).code).toBe(reserved);
    });
    test('yearly rollover uses the lab timezone; NEVER continues in year zero', async () => {
        expect((await issue('2026-12-31T22:30:00Z')).code).toContain('-2026-00001');
        expect((await issue('2026-12-31T23:30:00Z')).code).toContain('-2027-00001');
        await edit([{ key: 'consignment.sequenceReset', value: 'NEVER' }]);
        expect((await issue('2026-10-04T12:00:00Z')).code).toContain('-2026-00002');
        expect((await issue('2027-10-04T12:00:00Z')).code).toContain('-2027-00003');
        expect(await prisma.labSequence.findFirst({ where: { labId: lab.id, scope: 'CONSIGNMENT', year: 0 } })).toMatchObject({ next: 4 });
    });
    test('project formatting is lab policy; project does not partition the sequence and missing project writes nothing', async () => {
        await edit([{ key: 'consignment.numberFormat', value: '{PROJECT}.{LAB}.{YY}.{SEQ:3}' }]);
        await expect(issue('2026-10-04T12:00:00Z')).rejects.toMatchObject({ statusCode: 409, code: 'CONSIGNMENT_PROJECT_REQUIRED' });
        expect(await prisma.labSequence.count({ where: { labId: lab.id } })).toBe(0);
        expect(await prisma.consignment.count({ where: { labId: lab.id } })).toBe(0);
        expect((await issue('2026-10-04T12:00:00Z', 'P1')).code).toBe(`P1.${lab.code}.26.001`);
        expect((await issue('2026-10-04T12:00:00Z', 'P2')).code).toBe(`P2.${lab.code}.26.002`);
    });
    test('a historical collision is preserved and skipped; policy edits never renumber issued consignments', async () => {
        const old = await prisma.consignment.create({ data: { id: id(), code: `CSG-${lab.code}-2026-00001`, labId: lab.id, receivedBy: manager.username } });
        expect((await issue('2026-10-04T12:00:00Z')).code).toBe(`CSG-${lab.code}-2026-00002`);
        await edit([{ key: 'consignment.numberFormat', value: 'DELIVERY-{LAB}-{SEQ:3}' }]);
        expect((await issue('2026-10-04T12:00:00Z')).code).toBe(`DELIVERY-${lab.code}-003`);
        expect(await prisma.consignment.findUnique({ where: { id: old.id } })).toMatchObject({ code: old.code });
    });
    test('central defaults and token validator match Claude scope; bare root-client allocation is refused', async () => {
        for (const preset of PRESETS) {
            expect(registry['consignment.numberFormat'].presets[preset]).toBe('CSG-{LAB}-{YYYY}-{SEQ:5}');
            expect(registry['consignment.sequenceReset'].presets[preset]).toBe('YEARLY');
        }
        expect(registry['consignment.numberFormat'].scope).toBe('LAB');
        expect(valid('consignment.numberFormat', '{PROJECT}-{LAB}-{YY}-{SEQ:6}')).toBe(true);
        expect(valid('consignment.numberFormat', '{LAB}-{SEQ:6}{CHK}')).toBe(false);
        expect(valid('report.numberFormat', '{PROJECT}-{LAB}-{SEQ:6}')).toBe(false);
        expect(() => formatNumber('{LAB}', { labCode: lab.code, year: 2026, sequence: 1 })).toThrow();
        await expect(allocateConsignmentNumber(prisma, { labReference: lab.id })).rejects.toMatchObject({ statusCode: 409, code: 'CONSIGNMENT_TRANSACTION_REQUIRED' });
    });
});
