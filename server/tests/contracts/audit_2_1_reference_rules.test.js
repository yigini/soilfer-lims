const { eligibility } = require('../../services/referenceMaterialRules');
const { convertValue } = require('../../services/referenceMaterialService');
const now = new Date('2026-10-06T12:00:00.000Z');

test('reference expiry is an instant boundary, and the earlier material/lot expiry governs eligibility', () => {
    const material = { status: 'ACTIVE', labId: 'owned-reference-lab', expiryDate: '2026-10-06T12:00:00.001Z' };
    expect(eligibility(material, now).eligible).toBe(true);
    expect(eligibility({ ...material, expiryDate: now }, now)).toMatchObject({ eligible: false, reason: 'EXPIRED' });
    expect(eligibility({ ...material, inventoryLotId: 'owned-lot', inventoryLot: {
        labId: material.labId, status: 'AVAILABLE', expiryDate: '2026-10-06T11:59:59.999Z'
    } }, now)).toMatchObject({ eligible: false, reason: 'EXPIRED', effectiveExpiry: new Date('2026-10-06T11:59:59.999Z') });
    expect(eligibility({ ...material, expiryDate: null }, now)).toMatchObject({ eligible: true, effectiveExpiry: null });
});

test.each(['QUARANTINED', 'EXPIRED', 'RETIRED'])('material status %s blocks placement independently of date', status => {
    expect(eligibility({ status, labId: 'owned-reference-lab' }, now)).toMatchObject({ eligible: false, reason: status });
});

test.each(['QUARANTINED', 'EXPIRED', 'DISPOSED'])('linked inventory status %s blocks an otherwise active material', status => {
    expect(eligibility({ status: 'ACTIVE', labId: 'owned-reference-lab', inventoryLotId: 'owned-lot', inventoryLot: {
        labId: 'owned-reference-lab', status
    } }, now)).toMatchObject({ eligible: false, reason: `INVENTORY_${status}` });
});

test('missing/cross-lab linked inventory and invalid expiry fail closed', () => {
    expect(eligibility({ status: 'ACTIVE', labId: 'owned-reference-lab', inventoryLotId: 'missing' }, now).eligible).toBe(false);
    expect(eligibility({ status: 'ACTIVE', labId: 'owned-reference-lab', inventoryLotId: 'owned-lot', inventoryLot: {
        labId: 'another-lab', status: 'AVAILABLE'
    } }, now)).toMatchObject({ eligible: false, reason: 'INVENTORY_SCOPE_INVALID' });
    expect(eligibility({ status: 'ACTIVE', expiryDate: 'invalid' }, now)).toMatchObject({ eligible: false, reason: 'EXPIRY_INVALID' });
});

test('assigned values convert through controlled unit factors without rounding or changing sign', () => {
    const grams = { quantityKind: 'MASS_FRACTION', factorToBase: 1 };
    const milligrams = { quantityKind: 'MASS_FRACTION', factorToBase: 0.001 };
    expect(convertValue(1.23456789, grams, milligrams)).toBe(1234.5678899999998);
    expect(convertValue(-2, grams, milligrams)).toBe(-2000);
    expect(convertValue(0, grams, milligrams)).toBe(0);
});

test.each([
    [null, { quantityKind: 'MASS_FRACTION', factorToBase: 1 }],
    [{ quantityKind: 'MASS_FRACTION', factorToBase: 1 }, null],
    [{ quantityKind: 'MASS_FRACTION', factorToBase: 1 }, { quantityKind: 'CEC', factorToBase: 1 }],
    [{ quantityKind: 'MASS_FRACTION', factorToBase: 0 }, { quantityKind: 'MASS_FRACTION', factorToBase: 1 }],
    [{ quantityKind: 'MASS_FRACTION', factorToBase: Infinity }, { quantityKind: 'MASS_FRACTION', factorToBase: 1 }]
])('incompatible/missing/non-finite units refuse with a stable 409', (from, to) => {
    expect(() => convertValue(1, from, to)).toThrow(expect.objectContaining({ statusCode: 409, code: 'REFERENCE_UNIT_INCOMPATIBLE' }));
});
