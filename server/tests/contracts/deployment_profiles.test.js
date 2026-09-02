const fs = require('fs');
const path = require('path');
const { seedProfile } = require('../../seeds/profile');
const prisma = require('../../prisma');

describe('WP-36: Declarative Deployment Profiles Contract', () => {
    const profilesRoot = path.resolve(__dirname, '..', '..', '..', 'profiles');

    test('1. Profiles contain strictly JSON files (zero executable code)', () => {
        const profileDirs = ['soilfer', 'default'];

        for (const pName of profileDirs) {
            const pPath = path.join(profilesRoot, pName);
            expect(fs.existsSync(pPath)).toBe(true);

            const files = fs.readdirSync(pPath);
            expect(files.length).toBeGreaterThan(0);

            for (const f of files) {
                expect(f.endsWith('.json')).toBe(true);
            }
        }
    });

    test('2. SoilFER profile defines exactly 7 laboratories and 2 multi-lab projects', () => {
        const labs = JSON.parse(fs.readFileSync(path.join(profilesRoot, 'soilfer', 'labs.json'), 'utf8'));
        expect(labs.length).toBe(7);

        const labIds = labs.map(l => l.id);
        expect(labIds).toEqual(expect.arrayContaining([
            'GTM-LAB1', 'HND-LAB1', 'GHA-LAB1', 'KEN-LAB1',
            'ZMB-LAB1', 'TUN-LAB1', 'MOZ-LAB1'
        ]));

        const projects = JSON.parse(fs.readFileSync(path.join(profilesRoot, 'soilfer', 'projects.json'), 'utf8'));
        expect(projects.length).toBe(2);
        const pCodes = projects.map(p => p.code);
        expect(pCodes).toContain('SOILFER-US');
        expect(pCodes).toContain('SOILFER-JPN');
    });

    test('3. Default profile defines single generic lab without hardcoded countries', () => {
        const labs = JSON.parse(fs.readFileSync(path.join(profilesRoot, 'default', 'labs.json'), 'utf8'));
        expect(labs.length).toBe(1);
        expect(labs[0].id).toBe('DEFAULT-LAB');
    });

    test('4. Programmatic profile execution seeds target system cleanly', async () => {
        const soilferResult = await seedProfile('soilfer', prisma);
        expect(soilferResult.seededLabs).toBe(7);
        expect(soilferResult.seededProjects).toBe(2);

        const defaultResult = await seedProfile('default', prisma);
        expect(defaultResult.seededLabs).toBe(1);
        expect(defaultResult.seededProjects).toBe(1);

        // Restore soilfer profile
        await seedProfile('soilfer', prisma);
    });
});
