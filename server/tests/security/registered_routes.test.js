// Keep local developer configuration outside this synthetic, test-owned run.
// The app, route handlers, authentication and database implementation are real.
jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

const { loadRegisteredRouteInventory } = require('../helpers/registeredRouteInventory');
const coveredRegistrations = require('../helpers/routeIsolationInventory.json');
const inventory = loadRegisteredRouteInventory(() => require('../../app'), {
    // The signed media handler is also registered inside the authenticated Kobo
    // router. Count both registrations; do not silently discard the duplicate.
    allowedDuplicateKeys: ['GET /api/kobo/media'],
});

describe('R2 real application route inventory', () => {
    test('every registered method/path has an explicit coverage registration', () => {
        const actual = inventory.routes.map(route => ({ key: route.key, registration: route.registration }));
        expect(actual).toEqual(coveredRegistrations);
    });

    test('nested mounted routes and both exchange aliases are included', () => {
        const keys = inventory.routes.map(route => route.key);
        expect(keys).toContain('GET /api/projects/:id/activity');
        expect(keys).toContain('GET /api/samples/:id/custody');
        expect(keys.some(key => key.includes('/api/v1/data-exchange/'))).toBe(true);
        expect(keys.some(key => key.includes('/api/v1/sis/'))).toBe(true);
        expect(keys.some(key => key.includes('/api/v2/data-exchange/'))).toBe(true);
        expect(keys.some(key => key.includes('/api/v2/sis/'))).toBe(true);
        expect(keys).toContain('GET /uploads/intake/:filename');
    });
});
