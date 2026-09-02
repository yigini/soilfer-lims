const fs = require('fs');
const path = require('path');
const prisma = require('../../prisma');

describe('WP-37: External Mapping Shelf Contract', () => {
    test('1. Analysis and Methodology tables contain 0 dormant glosis_* columns', async () => {
        // Query SQLite schema
        const analysisCols = await prisma.$queryRawUnsafe('PRAGMA table_info(Analysis)');
        const analysisColNames = analysisCols.map(c => c.name);
        expect(analysisColNames).not.toContain('glosisProperty');
        expect(analysisColNames).not.toContain('glosisPropertyUri');
        expect(analysisColNames).not.toContain('glosisAttribute');
        expect(analysisColNames).not.toContain('glosisUri');

        const methodCols = await prisma.$queryRawUnsafe('PRAGMA table_info(Methodology)');
        const methodColNames = methodCols.map(c => c.name);
        expect(methodColNames).not.toContain('glosisProcedure');
        expect(methodColNames).not.toContain('glosisNotation');
        expect(methodColNames).not.toContain('glosisDefinition');
        expect(methodColNames).not.toContain('glosisReference');
        expect(methodColNames).not.toContain('glosisCitation');
        expect(methodColNames).not.toContain('glosisUri');
    });

    test('2. ExternalMapping table exists and stores external ontology cross-references', async () => {
        const testMapping = await prisma.externalMapping.create({
            data: {
                entityType: 'ANALYSIS',
                entityKey: 'pH',
                scheme: 'GLOSIS',
                code: 'glosis_cl:SoilPhPropertyCode',
                uri: 'http://glosis.org/ont/property/pH'
            }
        });

        expect(testMapping.id).toBeDefined();
        expect(testMapping.entityKey).toBe('pH');
        expect(testMapping.scheme).toBe('GLOSIS');

        // Clean up test mapping
        await prisma.externalMapping.delete({ where: { id: testMapping.id } });
    });

    test('3. GlosisExplorer UI component is deleted', () => {
        const explorerPath = path.resolve(__dirname, '..', '..', '..', 'client', 'src', 'components', 'admin', 'GlosisExplorer.jsx');
        expect(fs.existsSync(explorerPath)).toBe(false);
    });
});
