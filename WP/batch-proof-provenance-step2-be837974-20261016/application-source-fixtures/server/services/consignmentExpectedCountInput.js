const { IntakeError } = require('./intakeErrors');

// This adapter reads request keys only; it never accepts a stored consignment.
function declaredCountFromRequest(header = {}) {
    const hasNew = Object.hasOwn(header, 'declaredExpectedCount') && header.declaredExpectedCount !== undefined;
    const hasLegacy = Object.hasOwn(header, 'expectedCount') && header.expectedCount !== undefined;
    if (!hasNew && !hasLegacy || hasNew && hasLegacy && header.declaredExpectedCount === null && header.expectedCount === null) return null;
    if (hasNew && hasLegacy && header.declaredExpectedCount !== header.expectedCount) throw new IntakeError(422, { code: 'CONSIGNMENT_EXPECTED_COUNT_CONFLICT', message: 'The declared count request fields conflict.' });
    const value = hasNew ? header.declaredExpectedCount : header.expectedCount;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new IntakeError(422, { code: 'CONSIGNMENT_EXPECTED_COUNT_INVALID', message: 'The declared count must be a positive integer.' });
    return value;
}
module.exports = { declaredCountFromRequest };
