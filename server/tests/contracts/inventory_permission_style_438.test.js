jest.mock('../../prisma', () => ({}));
const { checkPermission } = require('../../middleware/authMiddleware');
const { PERMISSIONS, hasPermission } = require('../../config/roles');
function result(middleware, user) {
    const response = { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    let next = false; middleware({ user }, response, () => { next = true; });
    return { next, code: response.code, body: response.body };
}
test('single permission style preserves every existing inventory receipt allow/deny result', () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
        const roles = [...new Set(Object.values(PERMISSIONS).flat())];
        const users = [null, {}, { role: '' }, ...roles.flatMap(role => [role, role.toLowerCase(), ` ${role} `, role.toLowerCase().replace('_', '_')].map(role => ({ role, username: 'fixture' })))];
        for (const user of users) {
            const previous = hasPermission(user, 'MANAGE_INVENTORY') ? { next: true, code: 200, body: null } : result(checkPermission('PREPARE_INVENTORY_LOT'), user);
            expect(result(checkPermission('PREPARE_INVENTORY_LOT', { alternativePermission: 'MANAGE_INVENTORY' }), user)).toEqual(previous);
            expect(result(checkPermission('PREPARE_INVENTORY_LOT').or('MANAGE_INVENTORY'), user)).toEqual(previous);
        }
        expect(result(checkPermission('MANAGE_INVENTORY'), { role: 'lab_manager' }).next).toBe(false);
    } finally { warning.mockRestore(); }
});
