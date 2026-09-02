const workflowEngine = require('../../utils/workflowEngine');
const prisma = require('../../prisma');
const { generateWorkItemsForSample } = require('../../controllers/workItemController');

describe('WP-25: Catalogue-Driven Workflow Graph and DAG Validation', () => {
    test('1. Self-referential prerequisite is refused', () => {
        const result = workflowEngine.validatePrerequisites('PH', ['PH'], []);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/cannot depend on itself/i);
    });

    test('2. Two-node cyclic prerequisite is refused', () => {
        const existingAnalyses = [
            { code: 'A', prerequisites: ['B'] }
        ];
        // Now B attempts to depend on A -> Cycle A -> B -> A
        const result = workflowEngine.validatePrerequisites('B', ['A'], existingAnalyses);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/Cyclic prerequisite dependency detected/i);
        expect(result.cycle).toContain('A');
        expect(result.cycle).toContain('B');
    });

    test('3. Multi-node cyclic prerequisite is refused', () => {
        const existingAnalyses = [
            { code: 'A', prerequisites: ['B'] },
            { code: 'B', prerequisites: ['C'] },
            { code: 'C', prerequisites: ['D'] }
        ];
        // D attempts to depend on A -> Cycle A -> B -> C -> D -> A
        const result = workflowEngine.validatePrerequisites('D', ['A'], existingAnalyses);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/Cyclic prerequisite dependency detected/i);
    });

    test('4. Valid acyclic DAG dependencies are permitted', () => {
        const existingAnalyses = [
            { code: 'DRYING', prerequisites: [] },
            { code: 'PREPARATION', prerequisites: ['DRYING'] },
            { code: 'PH', prerequisites: ['PREPARATION'] }
        ];
        // EC depends on PREPARATION and PH
        const result = workflowEngine.validatePrerequisites('EC', ['PREPARATION', 'PH'], existingAnalyses);
        expect(result.valid).toBe(true);
    });

    test('5. Work items are generated in order of catalogue executionOrder', async () => {
        // Upsert 2 test analyses with distinct executionOrder
        await prisma.analysis.upsert({
            where: { code: 'DAG_TEST_LATE' },
            create: { code: 'DAG_TEST_LATE', name: 'Late Test', executionOrder: 90 },
            update: { executionOrder: 90 }
        });
        await prisma.analysis.upsert({
            where: { code: 'DAG_TEST_EARLY' },
            create: { code: 'DAG_TEST_EARLY', name: 'Early Test', executionOrder: 10 },
            update: { executionOrder: 10 }
        });

        const sampleId = `SMP-DAG-${Date.now()}`;
        const sample = await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: `ORIG-${sampleId}`,
                status: 'EXPECTED',
                labId: 'LAB-TEST',
                assignedLab: 'LAB-TEST',
                requiredAnalyses: JSON.stringify(['DAG_TEST_LATE', 'DAG_TEST_EARLY'])
            }
        });

        const generated = await generateWorkItemsForSample(sample);
        const analyticalItems = generated.filter(w => ['DAG_TEST_LATE', 'DAG_TEST_EARLY'].includes(w.analysis));

        expect(analyticalItems.length).toBe(2);
        // Early test (order 10) must appear before late test (order 90)
        expect(analyticalItems[0].analysis).toBe('DAG_TEST_EARLY');
        expect(analyticalItems[1].analysis).toBe('DAG_TEST_LATE');

        // Cleanup
        await prisma.workItem.deleteMany({ where: { sampleId: sample.id } });
        await prisma.sample.delete({ where: { id: sample.id } });
        await prisma.analysis.deleteMany({ where: { code: { in: ['DAG_TEST_LATE', 'DAG_TEST_EARLY'] } } });
    });
});
