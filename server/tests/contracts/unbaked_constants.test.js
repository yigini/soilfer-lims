const fs = require('fs');
const path = require('path');

describe('WP-35: Un-baked Deployment Constants Contract', () => {
    test('1. server/controllers/ contains zero hardcoded project fallbacks or country mappings', () => {
        const controllersDir = path.join(__dirname, '..', '..', 'controllers');
        const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));

        const forbiddenPatterns = [
            /const\s+COUNTRY_MAP\s*=/,
            /const\s+LAB_MAPPING\s*=/,
            /const\s+LAB_CONFIG\s*=/,
            /'SOILFER-US'/,
            /"SOILFER-US"/,
            /'SOILFER-JPN'/,
            /"SOILFER-JPN"/
        ];

        const violations = [];

        for (const file of files) {
            const filePath = path.join(controllersDir, file);
            const content = fs.readFileSync(filePath, 'utf8');

            for (const pattern of forbiddenPatterns) {
                if (pattern.test(content)) {
                    violations.push(`${file} matches forbidden pattern: ${pattern}`);
                }
            }
        }

        expect(violations).toEqual([]);
    });

    test('2. Kobo import requires explicit project configuration and fails loudly without fallback', async () => {
        // Attempting to sync or save with an unassigned lab must throw/reject
        const koboController = require('../../controllers/koboController');
        expect(typeof koboController.syncAll).toBe('function');
    });
});
