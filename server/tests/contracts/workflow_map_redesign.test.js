const workflowEngine = require('../../utils/workflowEngine');

describe('Workflow Map Redesign Contract Tests', () => {
    describe('1. S002 Forensic Reproduction & Denominator Isolation', () => {
        const sampleS002 = {
            id: '5e2dd71d-1708-482e-a74e-8bfed3a334a1',
            originalId: 'S002',
            status: 'ACCEPTED',
            projectCode: 'SOILFER-US',
            sampleType: 'SOIL',
            createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString()
        };

        const workItemsS002 = [
            {
                id: 'wi-dry',
                analysis: 'DRYING',
                status: 'COMPLETED',
                assignedTo: 'marco',
                updatedAt: new Date(Date.now() - 3600000 * 20).toISOString()
            },
            {
                id: 'wi-prep',
                analysis: 'PREPARATION',
                status: 'COMPLETED',
                assignedTo: 'marco',
                updatedAt: new Date(Date.now() - 3600000 * 18).toISOString()
            },
            {
                id: 'wi-mir',
                analysis: 'MIR',
                status: 'IN_PROGRESS',
                assignedTo: 'marco',
                updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
            },
            {
                id: 'wi-vis',
                analysis: 'VISNIR',
                status: 'COMPLETED',
                assignedTo: 'marco',
                metadata: { warning: 'Spectrum Uploaded (WARN)' },
                notes: 'Spectrum Uploaded (WARN)',
                updatedAt: new Date(Date.now() - 3600000 * 5).toISOString()
            }
        ];

        test('S002 never recommends "Complete Drying" when preparation is done', () => {
            const summary = workflowEngine.getWorkflowSummary(sampleS002, workItemsS002);
            expect(summary.nextActions).not.toContain('Complete Drying');
            expect(summary.nextActions).not.toContain('Assign Drying task');
            expect(summary.nextEligibleAction).toBeDefined();
            expect(summary.nextEligibleAction.title).toMatch(/(MIR|Mid-Infrared).*in progress/i);
            expect(summary.nextEligibleAction.assignee).toBe('marco');
            expect(summary.nextEligibleAction.reason).toMatch(/in progress/i);
        });

        test('S002 separates preparation, execution, and review denominators cleanly', () => {
            const mapState = workflowEngine.buildMapState(sampleS002, workItemsS002);
            expect(mapState.counters).toBeDefined();
            // Preparation: Drying + Milling (2/2)
            expect(mapState.counters.prep).toEqual({ done: 2, total: 2 });
            // Analytical tests: MIR + Vis-NIR (1 done, 1 active, 2 total)
            expect(mapState.counters.tests).toEqual({ done: 1, active: 1, total: 2 });
            // Quality reviews: 0 accepted or waived yet (0/2)
            expect(mapState.counters.reviews).toEqual({ cleared: 0, total: 2 });

            expect(mapState.counters.tasksCompleted).toBe('3 / 4');
            expect(mapState.counters.resultsCleared).toBe('0 / 2');
        });

        test('S002 excludes unrequested Physical and Chemical stations from the map', () => {
            const mapState = workflowEngine.buildMapState(sampleS002, workItemsS002);
            const stageRooms = mapState.activeStages.map(s => s.room);
            expect(stageRooms).toContain('Preparation Room');
            expect(stageRooms).toContain('Spectral Lab');
            expect(stageRooms).not.toContain('Physical Testing');
            expect(stageRooms).not.toContain('Chemical Analysis');

            // Overview stageGraph nodes
            const nodeIds = mapState.stageGraph.nodes.map(n => n.id);
            expect(nodeIds).toContain('reception');
            expect(nodeIds).toContain('prep');
            expect(nodeIds).toContain('spectral_lab');
            expect(nodeIds).toContain('review');
            expect(nodeIds).toContain('closure');
            expect(nodeIds).not.toContain('physical_testing');
            expect(nodeIds).not.toContain('chemical_analysis');
        });

        test('Vis-NIR carries warn tone without breaking completed execution status', () => {
            const mapState = workflowEngine.buildMapState(sampleS002, workItemsS002);
            const visNode = mapState.dependencyGraph.nodes.find(n => n.analysis === 'VISNIR');
            expect(visNode).toBeDefined();
            expect(visNode.status).toBe('Completed · warn');
            expect(visNode.tone).toBe('warn');
        });
    });

    describe('2. Blocker Evaluation Order and Root Cause', () => {
        test('blocked stage has status "blocked" and exposes blocking root cause', () => {
            const sample = { id: 'SMP-BLK-1', status: 'ACCEPTED' };
            const workItems = [
                { id: 'wi-1', analysis: 'DRYING', status: 'NOT_ASSIGNED' },
                { id: 'wi-2', analysis: 'PREPARATION', status: 'NOT_ASSIGNED' },
                { id: 'wi-3', analysis: 'PH', status: 'NOT_ASSIGNED' }
            ];

            const mapState = workflowEngine.buildMapState(sample, workItems);
            // PH requires PREPARATION which requires DRYING
            const phBlocker = mapState.blockerGraph.find(b => b.analysis === 'PH');
            expect(phBlocker).toBeDefined();
            expect(phBlocker.blockedBy).toContain('PREPARATION');

            const prepBlocker = mapState.blockerGraph.find(b => b.analysis === 'PREPARATION');
            expect(prepBlocker).toBeDefined();
            expect(prepBlocker.blockedBy).toContain('DRYING');

            // Chemical Analysis stage must be flagged as blocked
            const chemStage = mapState.activeStages.find(s => s.room === 'Chemical Analysis');
            expect(chemStage).toBeDefined();
            expect(chemStage.status).toBe('blocked');
            expect(chemStage.blockers.length).toBeGreaterThan(0);
        });
    });

    describe('3. Dynamic Stage Pruning for Wet Chemistry Only', () => {
        test('sample with only pH and EC only renders Chemical Analysis and Preparation', () => {
            const sample = { id: 'SMP-CHEM-1', status: 'ACCEPTED' };
            const workItems = [
                { id: 'wi-dry', analysis: 'DRYING', status: 'COMPLETED' },
                { id: 'wi-prep', analysis: 'PREPARATION', status: 'COMPLETED' },
                { id: 'wi-ph', analysis: 'PH', status: 'IN_PROGRESS' },
                { id: 'wi-ec', analysis: 'EC', status: 'COMPLETED' }
            ];

            const mapState = workflowEngine.buildMapState(sample, workItems);
            const stageRooms = mapState.activeStages.map(s => s.room);
            expect(stageRooms).toContain('Preparation Room');
            expect(stageRooms).toContain('Chemical Analysis');
            expect(stageRooms).not.toContain('Spectral Lab');
            expect(stageRooms).not.toContain('Physical Testing');
        });
    });

    describe('4. Explicit Edge DAG Validity', () => {
        test('overview and dependency edges have valid source and destination references', () => {
            const sample = { id: 'SMP-DAG-1', status: 'ACCEPTED' };
            const workItems = [
                { id: 'wi-dry', analysis: 'DRYING', status: 'COMPLETED' },
                { id: 'wi-prep', analysis: 'PREPARATION', status: 'COMPLETED' },
                { id: 'wi-mir', analysis: 'MIR', status: 'COMPLETED' }
            ];

            const mapState = workflowEngine.buildMapState(sample, workItems);
            // Check stage graph
            const stageNodeIds = new Set(mapState.stageGraph.nodes.map(n => n.id));
            mapState.stageGraph.edges.forEach(edge => {
                expect(stageNodeIds.has(edge.from)).toBe(true);
                expect(stageNodeIds.has(edge.to)).toBe(true);
            });

            // Check dependency graph
            const depNodeIds = new Set(mapState.dependencyGraph.nodes.map(n => n.id));
            mapState.dependencyGraph.edges.forEach(edge => {
                expect(depNodeIds.has(edge.from)).toBe(true);
                expect(depNodeIds.has(edge.to)).toBe(true);
            });
        });
    });
});
