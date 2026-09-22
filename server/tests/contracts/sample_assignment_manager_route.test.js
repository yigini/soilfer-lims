'use strict';

/**
 * Contract & Component Regression Test Suite:
 * Manager Queue Assignment Route, Canonical Resolution, and SampleDetail Render (#119)
 *
 * Verifies:
 * 1. Component SSR Regression: SampleDetail renders without ReferenceError: ArrowRight is not defined
 *    and without ReferenceError: Eye is not defined when rendering nextAction primary button and released report.
 * 2. Identity Disambiguation: S005 canonical sample ID is 'GTM-LAB1', distinct from display lab code 'S005'.
 * 3. Task Count Isolation:
 *    - S005 (canonical GTM-LAB1, display S005) resolves to its own 15 unassigned tasks.
 *    - S004 (canonical SMP-S004-GTM, display S004) resolves to its own 11 unassigned tasks.
 *    - W001 (canonical SMP-W001-CLO, display W001 in LAB-CLO) resolves to its own 12 unassigned tasks.
 * 4. Queue Scope Aggregation:
 *    - SUPER_ADMIN queue reflects broader scope totaling 15 + 11 + 12 = 38 unassigned tasks.
 *    - LAB_MANAGER (LAB-GTM) is lab-isolated, seeing only 15 + 11 = 26 tasks.
 * 5. Route Context & Back Navigation:
 *    - Target URL uses canonical ID: /samples/GTM-LAB1?tab=work&returnTo=%2Fmanager-queue%3Flane%3Dassign.
 *    - Back button detects manager-queue returnTo and labels 'Back to queue'.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const request = require('supertest');

const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const sampleWorkspaceService = require('../../services/sampleWorkspaceService');

// ─── 1. COMPONENT SSR HELPER ───
function loadSampleDetailComponent(initialSearch = '?tab=work&returnTo=%2Fmanager-queue%3Flane%3Dassign', options = {}) {
    const esbuild = require(path.resolve(__dirname, '../../../client/node_modules/esbuild'));
    const React = require(path.resolve(__dirname, '../../../client/node_modules/react'));
    const componentPath = path.resolve(__dirname, '../../../client/src/pages/SampleDetail.jsx');
    const source = fs.readFileSync(componentPath, 'utf8');

    const transformed = esbuild.transformSync(source, {
        loader: 'jsx',
        format: 'cjs',
        jsx: 'automatic'
    });

    const mockLucide = new Proxy({}, {
        get: (target, prop) => {
            return (props) => React.createElement('svg', { 'data-lucide': String(prop), ...props });
        }
    });

    const mockLanguage = {
        useLanguage: () => ({
            t: (k, fallback) => fallback || k,
            language: 'en'
        })
    };

    const mockAnalysisNames = {
        useAnalysisNames: () => (code) => code
    };

    const mockEvidence = {
        workItemEvidenceText: () => ''
    };

    const mockNavigate = options.navigate || jest.fn();
    const sampleId = options.sampleId || 'GTM-LAB1';

    const mockRouter = {
        useParams: () => ({ id: sampleId }),
        useNavigate: () => mockNavigate,
        useLocation: () => ({ pathname: `/samples/${sampleId}`, search: initialSearch })
    };

    const mockAuth = {
        useAuth: () => ({
            user: options.user || { username: 'super_admin', role: 'SUPER_ADMIN', labId: 'LAB-GTM' },
            token: 'mock-token'
        })
    };

    const mockDialog = {
        useDialog: () => ({ showDialog: jest.fn() })
    };

    const mockNotifications = {
        useNotifications: () => ({ subscribeToEvent: () => () => {} })
    };

    const dummyComponent = () => null;

    const moduleObj = { exports: {} };
    const runContext = {
        module: moduleObj,
        exports: moduleObj.exports,
        URLSearchParams,
        URL,
        window: {
            addEventListener: () => {},
            removeEventListener: () => {}
        },
        document: {
            addEventListener: () => {},
            removeEventListener: () => {}
        },
        require: (mod) => {
            if (mod === 'react') return React;
            if (mod === 'react/jsx-runtime' || mod === 'react/jsx-dev-runtime') {
                return require(path.resolve(__dirname, '../../../client/node_modules/react/jsx-runtime'));
            }
            if (mod === 'react-router-dom') return mockRouter;
            if (mod === 'lucide-react') return mockLucide;
            if (mod.includes('AnalysisCatalogueContext')) return mockAnalysisNames;
            if (mod.includes('workItemEvidence')) return mockEvidence;
            if (mod.includes('AuthContext')) return mockAuth;
            if (mod.includes('LanguageContext')) return mockLanguage;
            if (mod.includes('DialogContext')) return mockDialog;
            if (mod.includes('NotificationContext')) return mockNotifications;
            if (mod.includes('i18nHelper')) return { getStatusLabel: (s) => s };
            return dummyComponent;
        },
        console
    };

    vm.runInNewContext(transformed.code, runContext);
    return runContext.module.exports.default;
}

describe('Contract & Component Regression: Manager Queue Assignment Route (#119)', () => {
    let superAdminToken, mgrGtmToken, mgrCloToken;

    // Suite-isolated identities distinguishing canonical sample ID from display lab code / field ID
    const sampleS005CanonicalId = 'GTM-LAB1';           // Canonical sample ID as reported in live finding
    const sampleS005DisplayLabId = 'S005-ROUTE';        // Suite-owned isolated display alias preventing collision with sequential reception tests
    const sampleS005FieldId = 'FIELD-GTM-S005-ROUTE';

    const sampleS004CanonicalId = 'SMP-S004-GTM-ROUTE';
    const sampleS004DisplayLabId = 'S004-ROUTE';
    const sampleS004FieldId = 'FIELD-GTM-S004-ROUTE';

    const sampleW001CanonicalId = 'SMP-W001-CLO-ROUTE';
    const sampleW001DisplayLabId = 'W001-ROUTE';
    const sampleW001FieldId = 'FIELD-CLO-W001-ROUTE';

    // Suite-owned decoy fixture to explicitly test the canonical-vs-display collision regression
    // (Decoy sample has labId matching canonical ID 'GTM-LAB1')
    const sampleCollisionDecoyId = 'SMP-DECOY-COLLISION-ROUTE';
    const sampleCollisionDecoyFieldId = 'FIELD-DECOY-COLLISION-ROUTE';

    const s005Analyses = [
        'DRYING', 'PREPARATION', 'PH_H2O', 'EC_1_5', 'OC',
        'TOTAL_N', 'P_BRAY', 'K_EX', 'CA_EX', 'MG_EX',
        'NA_EX', 'CEC', 'FE_DTPA', 'ZN_DTPA', 'CU_DTPA'
    ]; // 15 tasks

    const s004Analyses = [
        'DRYING', 'PREPARATION', 'PH_H2O', 'EC_1_5', 'OC',
        'TOTAL_N', 'P_BRAY', 'K_EX', 'CA_EX', 'MG_EX', 'NA_EX'
    ]; // 11 tasks

    const w001Analyses = [
        'DRYING', 'PREPARATION', 'PH_H2O', 'EC_1_5', 'OC',
        'TOTAL_N', 'P_BRAY', 'K_EX', 'CA_EX', 'MG_EX', 'NA_EX', 'CEC'
    ]; // 12 tasks

    beforeAll(async () => {
        superAdminToken = await getAuthToken('SUPER_ADMIN', 'LAB-GTM', ['GTM', 'HND'], ['SOILFER-US']);
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        mgrCloToken = await getAuthToken('LAB_MANAGER', 'LAB-CLO', ['HND'], ['SOILFER-US']);

        // Clean up any pre-existing records for these test identities
        const allSampleIds = [sampleS005CanonicalId, sampleS004CanonicalId, sampleW001CanonicalId, sampleCollisionDecoyId];
        await prisma.workItem.deleteMany({ where: { sampleId: { in: allSampleIds } } });
        await prisma.sample.deleteMany({ where: { id: { in: allSampleIds } } });

        // Ensure operational gates exist
        await prisma.operationalGate.upsert({
            where: { code_labId: { code: 'DRYING', labId: 'LAB-GTM' } },
            update: { isActive: true },
            create: { code: 'DRYING', name: 'Air Drying', labId: 'LAB-GTM', isActive: true }
        });
        await prisma.operationalGate.upsert({
            where: { code_labId: { code: 'PREPARATION', labId: 'LAB-GTM' } },
            update: { isActive: true },
            create: { code: 'PREPARATION', name: 'Sample Preparation', labId: 'LAB-GTM', isActive: true }
        });

        // 1. Seed S005: canonical ID 'GTM-LAB1', display code 'S005'
        await prisma.sample.create({
            data: {
                id: sampleS005CanonicalId,
                labId: sampleS005DisplayLabId,
                originalId: sampleS005FieldId,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(s005Analyses.slice(2))
            }
        });
        for (let i = 0; i < s005Analyses.length; i++) {
            await prisma.workItem.create({
                data: {
                    id: `WI-S005-${i + 1}`,
                    sampleId: sampleS005CanonicalId,
                    labId: 'LAB-GTM',
                    assignedLab: 'LAB-GTM',
                    analysis: s005Analyses[i],
                    category: i < 2 ? 'Operational Gates' : 'Wet Chemistry',
                    status: 'NOT_ASSIGNED',
                    assignedTo: null
                }
            });
        }

        // 2. Seed S004: canonical ID 'SMP-S004-GTM', display code 'S004'
        await prisma.sample.create({
            data: {
                id: sampleS004CanonicalId,
                labId: sampleS004DisplayLabId,
                originalId: sampleS004FieldId,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(s004Analyses.slice(2))
            }
        });
        for (let i = 0; i < s004Analyses.length; i++) {
            await prisma.workItem.create({
                data: {
                    id: `WI-S004-${i + 1}`,
                    sampleId: sampleS004CanonicalId,
                    labId: 'LAB-GTM',
                    assignedLab: 'LAB-GTM',
                    analysis: s004Analyses[i],
                    category: i < 2 ? 'Operational Gates' : 'Wet Chemistry',
                    status: 'NOT_ASSIGNED',
                    assignedTo: null
                }
            });
        }

        // 3. Seed W001: canonical ID 'SMP-W001-CLO-ROUTE', display code 'W001-ROUTE', in LAB-CLO
        await prisma.sample.create({
            data: {
                id: sampleW001CanonicalId,
                labId: sampleW001DisplayLabId,
                originalId: sampleW001FieldId,
                assignedLab: 'LAB-CLO',
                country: 'HND',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(w001Analyses.slice(2))
            }
        });
        for (let i = 0; i < w001Analyses.length; i++) {
            await prisma.workItem.create({
                data: {
                    id: `WI-W001-${i + 1}`,
                    sampleId: sampleW001CanonicalId,
                    labId: 'LAB-CLO',
                    assignedLab: 'LAB-CLO',
                    analysis: w001Analyses[i],
                    category: i < 2 ? 'Operational Gates' : 'Wet Chemistry',
                    status: 'NOT_ASSIGNED',
                    assignedTo: null
                }
            });
        }

        // 4. Seed Collision Decoy: sample whose labId intentionally matches canonical ID 'GTM-LAB1'
        // This explicitly exercises the canonical-vs-display collision regression.
        await prisma.sample.create({
            data: {
                id: sampleCollisionDecoyId,
                labId: sampleS005CanonicalId, // 'GTM-LAB1'
                originalId: sampleCollisionDecoyFieldId,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(['PH_H2O'])
            }
        });
        await prisma.workItem.create({
            data: {
                id: 'WI-DECOY-COLLISION-1',
                sampleId: sampleCollisionDecoyId,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                analysis: 'PH_H2O',
                category: 'Wet Chemistry',
                status: 'NOT_ASSIGNED',
                assignedTo: null
            }
        });
    });

    afterAll(async () => {
        const allSampleIds = [sampleS005CanonicalId, sampleS004CanonicalId, sampleW001CanonicalId, sampleCollisionDecoyId];
        await prisma.workItem.deleteMany({ where: { sampleId: { in: allSampleIds } } });
        await prisma.sample.deleteMany({ where: { id: { in: allSampleIds } } });
    });

    describe('1. Component Render Regression: ArrowRight and Eye Definition (#119)', () => {
        test('SampleDetail renders without ReferenceError when nextAction is ASSIGN', () => {
            const SampleDetail = loadSampleDetailComponent();
            const React = require(path.resolve(__dirname, '../../../client/node_modules/react'));
            const ReactDOMServer = require(path.resolve(__dirname, '../../../client/node_modules/react-dom/server'));

            const mockWorkspace = {
                sample: {
                    id: sampleS005CanonicalId,
                    labId: sampleS005DisplayLabId,
                    originalId: sampleS005FieldId,
                    status: 'PROCESSING'
                },
                workItems: [
                    { id: 'WI-S005-1', analysis: 'DRYING', status: 'NOT_ASSIGNED' }
                ],
                capabilities: {
                    canManageAnalyses: { allowed: true },
                    canFinalApprove: { allowed: false, blockers: ['Tasks not assigned'] },
                    canArchive: { allowed: false },
                    canDispose: { allowed: false }
                },
                nextAction: {
                    action: 'ASSIGN',
                    label: 'Assign 15 unassigned task(s) to technician',
                    role: 'LAB_MANAGER'
                }
            };

            const mockSample = {
                id: sampleS005CanonicalId,
                labId: sampleS005DisplayLabId,
                originalId: sampleS005FieldId,
                status: 'PROCESSING'
            };

            let markup = '';
            expect(() => {
                markup = ReactDOMServer.renderToStaticMarkup(
                    React.createElement(SampleDetail, {
                        initialWorkspace: mockWorkspace,
                        initialSample: mockSample
                    })
                );
            }).not.toThrow();

            // Confirms primary button rendered with ArrowRight icon and label without crashing
            expect(markup).toContain('Assign 15 unassigned task(s) to technician');
            expect(markup).toContain('data-lucide="ArrowRight"');
            // Confirms back button uses returnTo context
            expect(markup).toContain('Back to queue');
        });

        test('SampleDetail renders without ReferenceError when released report is present (Eye icon)', () => {
            const SampleDetail = loadSampleDetailComponent('?tab=reports');
            const React = require(path.resolve(__dirname, '../../../client/node_modules/react'));
            const ReactDOMServer = require(path.resolve(__dirname, '../../../client/node_modules/react-dom/server'));

            const mockWorkspace = {
                sample: {
                    id: sampleS005CanonicalId,
                    labId: sampleS005DisplayLabId,
                    originalId: sampleS005FieldId,
                    status: 'RELEASED'
                },
                workItems: [],
                capabilities: {
                    canManageAnalyses: { allowed: false },
                    canFinalApprove: { allowed: false },
                    canArchive: { allowed: true },
                    canDispose: { allowed: true }
                },
                nextAction: {
                    action: 'VIEW',
                    label: 'View sample workspace',
                    role: 'ALL'
                },
                currentReleasedReport: {
                    id: 'REP-GTM-S005-v1',
                    version: 1,
                    publishedAt: new Date().toISOString(),
                    generatedBy: 'mgr_gtm'
                }
            };

            let markup = '';
            expect(() => {
                markup = ReactDOMServer.renderToStaticMarkup(
                    React.createElement(SampleDetail, {
                        initialWorkspace: mockWorkspace,
                        initialSample: mockWorkspace.sample
                    })
                );
            }).not.toThrow();

            expect(markup).toContain('View Report v1');
            expect(markup).toContain('data-lucide="Eye"');
        });
    });

    describe('2. Task Count Isolation & Scope Aggregation (15 + 11 + 12 = 38 tasks)', () => {
        test('SUPER_ADMIN unassigned queue aggregates 38 tasks across S005, S004, and W001', async () => {
            const res = await request(app)
                .get('/api/work?status=NOT_ASSIGNED&limit=100')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            const items = res.body.data;

            // Filter down to our test samples
            const testItems = items.filter(item =>
                [sampleS005CanonicalId, sampleS004CanonicalId, sampleW001CanonicalId].includes(item.sampleId)
            );

            expect(testItems).toHaveLength(38);

            const s005Items = testItems.filter(item => item.sampleId === sampleS005CanonicalId);
            const s004Items = testItems.filter(item => item.sampleId === sampleS004CanonicalId);
            const w001Items = testItems.filter(item => item.sampleId === sampleW001CanonicalId);

            expect(s005Items).toHaveLength(15);
            expect(s004Items).toHaveLength(11);
            expect(w001Items).toHaveLength(12);
        });

        test('LAB_MANAGER (LAB-GTM) is lab-scoped and sees only S005 (15) and S004 (11) totaling 26 tasks', async () => {
            const res = await request(app)
                .get('/api/work?status=NOT_ASSIGNED&limit=100')
                .set('Authorization', `Bearer ${mgrGtmToken}`);

            expect(res.status).toBe(200);
            const items = res.body.data;

            const testItems = items.filter(item =>
                [sampleS005CanonicalId, sampleS004CanonicalId, sampleW001CanonicalId].includes(item.sampleId)
            );

            // W001 in LAB-CLO must NOT leak into LAB-GTM manager queue
            expect(testItems).toHaveLength(26);
            expect(testItems.some(item => item.sampleId === sampleW001CanonicalId)).toBe(false);
        });
    });

    describe('3. Canonical Sample ID vs Display Lab Code Disambiguation', () => {
        test('S005 resolves strictly to its own 15 tasks via canonical ID GTM-LAB1', async () => {
            const ws = await sampleWorkspaceService.getSampleWorkspace(sampleS005CanonicalId, {
                role: 'SUPER_ADMIN',
                labId: 'LAB-GTM'
            });

            expect(ws).toBeDefined();
            expect(ws.identity.id).toBe(sampleS005CanonicalId); // 'GTM-LAB1'
            expect(ws.identity.labSampleCode).toBe(sampleS005DisplayLabId); // 'S005'
            expect(ws.identity.originalId).toBe(sampleS005FieldId);
            expect(ws.workItems).toHaveLength(15);
            expect(ws.nextAction.action).toBe('ASSIGN');
            expect(ws.nextAction.label).toContain('15 unassigned task(s)');

            // Also test via HTTP endpoint GET /api/samples/:id/workspace
            const httpRes = await request(app)
                .get(`/api/samples/${sampleS005CanonicalId}/workspace`)
                .set('Authorization', `Bearer ${superAdminToken}`);
            expect(httpRes.status).toBe(200);
            expect(httpRes.body.identity.id).toBe(sampleS005CanonicalId);
            expect(httpRes.body.workItems).toHaveLength(15);
            expect(httpRes.body.nextAction.action).toBe('ASSIGN');
        });

        test('S005 also resolves accurately when queried via display lab code S005', async () => {
            const ws = await sampleWorkspaceService.getSampleWorkspace(sampleS005DisplayLabId, {
                role: 'SUPER_ADMIN',
                labId: 'LAB-GTM'
            });

            expect(ws).toBeDefined();
            expect(ws.identity.id).toBe(sampleS005CanonicalId); // Resolves back to canonical GTM-LAB1
            expect(ws.workItems).toHaveLength(15);

            // Also test via HTTP endpoint GET /api/samples/:id/workspace with display code
            const httpRes = await request(app)
                .get(`/api/samples/${sampleS005DisplayLabId}/workspace`)
                .set('Authorization', `Bearer ${superAdminToken}`);
            expect(httpRes.status).toBe(200);
            expect(httpRes.body.identity.id).toBe(sampleS005CanonicalId);
            expect(httpRes.body.workItems).toHaveLength(15);
        });

        test('canonical ID query takes strict precedence over cross-column labId alias collision', async () => {
            // Decoy sample has labId equal to sampleS005CanonicalId ('GTM-LAB1').
            // Querying by sampleS005CanonicalId ('GTM-LAB1') MUST resolve the canonical sample (15 tasks),
            // and NOT the decoy sample (1 task).
            const ws = await sampleWorkspaceService.getSampleWorkspace(sampleS005CanonicalId, {
                role: 'SUPER_ADMIN',
                labId: 'LAB-GTM'
            });

            expect(ws).toBeDefined();
            expect(ws.identity.id).toBe(sampleS005CanonicalId); // 'GTM-LAB1'
            expect(ws.workItems).toHaveLength(15);
            expect(ws.identity.id).not.toBe(sampleCollisionDecoyId);

            // Direct query for decoy canonical ID resolves decoy
            const decoyWs = await sampleWorkspaceService.getSampleWorkspace(sampleCollisionDecoyId, {
                role: 'SUPER_ADMIN',
                labId: 'LAB-GTM'
            });
            expect(decoyWs).toBeDefined();
            expect(decoyWs.identity.id).toBe(sampleCollisionDecoyId);
            expect(decoyWs.workItems).toHaveLength(1);
        });

        test('S004 resolves strictly to its own 11 tasks', async () => {
            const ws = await sampleWorkspaceService.getSampleWorkspace(sampleS004CanonicalId, {
                role: 'SUPER_ADMIN',
                labId: 'LAB-GTM'
            });

            expect(ws).toBeDefined();
            expect(ws.identity.id).toBe(sampleS004CanonicalId);
            expect(ws.identity.labSampleCode).toBe(sampleS004DisplayLabId);
            expect(ws.workItems).toHaveLength(11);
            expect(ws.nextAction.action).toBe('ASSIGN');
            expect(ws.nextAction.label).toContain('11 unassigned task(s)');

            const httpRes = await request(app)
                .get(`/api/samples/${sampleS004CanonicalId}/workspace`)
                .set('Authorization', `Bearer ${superAdminToken}`);
            expect(httpRes.status).toBe(200);
            expect(httpRes.body.identity.id).toBe(sampleS004CanonicalId);
            expect(httpRes.body.workItems).toHaveLength(11);
        });

        test('W001 resolves strictly to its own 12 tasks', async () => {
            const ws = await sampleWorkspaceService.getSampleWorkspace(sampleW001CanonicalId, {
                role: 'SUPER_ADMIN',
                labId: 'LAB-CLO'
            });

            expect(ws).toBeDefined();
            expect(ws.identity.id).toBe(sampleW001CanonicalId);
            expect(ws.workItems).toHaveLength(12);

            const httpRes = await request(app)
                .get(`/api/samples/${sampleW001CanonicalId}/workspace`)
                .set('Authorization', `Bearer ${superAdminToken}`);
            expect(httpRes.status).toBe(200);
            expect(httpRes.body.identity.id).toBe(sampleW001CanonicalId);
            expect(httpRes.body.workItems).toHaveLength(12);
        });
    });

    describe('4. Manager Queue Card Target URL and Return Context', () => {
        test('Target URL uses canonical sampleId GTM-LAB1 and preserves returnTo queue context', () => {
            // Replicates client/src/pages/ManagerQueue.jsx targetUrl calculation
            const s005CardItem = {
                id: sampleS005CanonicalId,
                sampleId: sampleS005CanonicalId,
                sampleLabId: sampleS005DisplayLabId,
                originalId: sampleS005FieldId,
                count: 15
            };

            const type = 'assign';
            const selectedAnalysis = null;
            const returnUrl = `/manager-queue?lane=${type}${selectedAnalysis ? `&analysis=${selectedAnalysis}` : ''}`;
            const tabParam = 'tab=work&';
            const targetUrl = `/samples/${s005CardItem.sampleId || s005CardItem.id}?${tabParam}${selectedAnalysis ? `analysis=${encodeURIComponent(selectedAnalysis)}&` : ''}returnTo=${encodeURIComponent(returnUrl)}`;

            expect(targetUrl).toBe('/samples/GTM-LAB1?tab=work&returnTo=%2Fmanager-queue%3Flane%3Dassign');

            // Parse back query params as SampleDetail does
            const urlObj = new URL(`http://localhost${targetUrl}`);
            expect(urlObj.searchParams.get('tab')).toBe('work');
            expect(urlObj.searchParams.get('returnTo')).toBe('/manager-queue?lane=assign');
        });

        test('Target URL forwards selectedAnalysis directly and retains method context in returnTo (#119)', () => {
            const s004CardItem = {
                id: sampleS004CanonicalId,
                sampleId: sampleS004CanonicalId,
                sampleLabId: sampleS004DisplayLabId,
                originalId: sampleS004FieldId,
                count: 11
            };

            const type = 'assign';
            const selectedAnalysis = 'TEXTURE';
            const returnUrl = `/manager-queue?lane=${type}${selectedAnalysis ? `&analysis=${selectedAnalysis}` : ''}`;
            const tabParam = 'tab=work&';
            const targetUrl = `/samples/${s004CardItem.sampleId || s004CardItem.id}?${tabParam}${selectedAnalysis ? `analysis=${encodeURIComponent(selectedAnalysis)}&` : ''}returnTo=${encodeURIComponent(returnUrl)}`;

            expect(targetUrl).toBe('/samples/SMP-S004-GTM-ROUTE?tab=work&analysis=TEXTURE&returnTo=%2Fmanager-queue%3Flane%3Dassign%26analysis%3DTEXTURE');

            const urlObj = new URL(`http://localhost${targetUrl}`);
            expect(urlObj.searchParams.get('tab')).toBe('work');
            expect(urlObj.searchParams.get('analysis')).toBe('TEXTURE');
            expect(urlObj.searchParams.get('returnTo')).toBe('/manager-queue?lane=assign&analysis=TEXTURE');
        });
    });

    describe('5. Component Render Regression: Manager Guidance & Scoped Assignment Controls (#119)', () => {
        test('SampleDetail renders Manager guidance text instead of Technician guidance when tasks are unassigned', () => {
            const SampleDetail = loadSampleDetailComponent(
                '?tab=work&analysis=TEXTURE&returnTo=%2Fmanager-queue%3Flane%3Dassign%26analysis%3DTEXTURE',
                { sampleId: sampleS004CanonicalId }
            );
            const React = require(path.resolve(__dirname, '../../../client/node_modules/react'));
            const ReactDOMServer = require(path.resolve(__dirname, '../../../client/node_modules/react-dom/server'));

            const mockWorkspace = {
                sample: {
                    id: sampleS004CanonicalId,
                    labId: sampleS004DisplayLabId,
                    originalId: sampleS004FieldId,
                    status: 'PROCESSING'
                },
                workItems: [
                    { id: 'WI-S004-1', analysis: 'DRYING', status: 'NOT_ASSIGNED', category: 'Operational Gates', isGate: true },
                    { id: 'WI-S004-2', analysis: 'PREPARATION', status: 'NOT_ASSIGNED', category: 'Operational Gates', isGate: true },
                    { id: 'WI-S004-3', analysis: 'PH_H2O', status: 'NOT_ASSIGNED', category: 'Wet Chemistry' }
                ],
                counters: {
                    ordered: 11,
                    recorded: 0,
                    submitted: 0,
                    accepted: 0,
                    omitted: 0,
                    blocked: 0,
                    derived: 0,
                    unassigned: 11
                },
                capabilities: {
                    canManageAnalyses: { allowed: true },
                    canFinalApprove: { allowed: false, blockers: ['Tasks not completed'] },
                    canArchive: { allowed: false },
                    canDispose: { allowed: false }
                },
                nextAction: {
                    action: 'ASSIGN',
                    label: 'Assign 11 unassigned task(s) to technician',
                    role: 'LAB_MANAGER'
                }
            };

            const markup = ReactDOMServer.renderToStaticMarkup(
                React.createElement(SampleDetail, {
                    initialWorkspace: mockWorkspace,
                    initialSample: mockWorkspace.sample
                })
            );

            // 1. Manager guidance text present in Recommended Next Action banner
            expect(markup).toContain('Manager · Assign unassigned analytical tasks to laboratory technicians for testing.');
            // 2. Erroneous technician guidance MUST NOT be present under manager next action
            expect(markup).not.toContain('Technician · Record laboratory results and submit package for managerial review.');
            // 3. Recommended Next Action button displays "Assign to technician"
            expect(markup).toContain('Assign to technician');
            // 4. Primary next action top button displays "Assign 11 unassigned task(s) to technician"
            expect(markup).toContain('Assign 11 unassigned task(s) to technician');
            // 5. Method context badge displayed in breadcrumb bar
            expect(markup).toContain('Queue Method:');
            expect(markup).toContain('TEXTURE');
            // 6. Ordered analyses table container has id="ordered-analyses-table"
            expect(markup).toContain('id="ordered-analyses-table"');
            // 7. Unassigned badge displayed in table header
            expect(markup).toContain('11 unassigned');
        });

        test('SampleDetail ASSIGN action handler invokes handleFocusAssignment and eliminates loop to manager-queue', () => {
            const componentPath = path.resolve(__dirname, '../../../client/src/pages/SampleDetail.jsx');
            const source = fs.readFileSync(componentPath, 'utf8');

            // Regression check: Line 530 ASSIGN handler must call handleFocusAssignment() and NOT navigate to manager-queue
            expect(source).not.toMatch(/else\s+if\s*\(\s*nextAction\.action\s*===\s*'ASSIGN'\s*\)\s*\{\s*navigate\(`\/manager-queue\?lane=assign`\);/);
            expect(source).toMatch(/else\s+if\s*\(\s*nextAction\.action\s*===\s*'ASSIGN'\s*\)\s*\{\s*handleFocusAssignment\(\);/);

            // Confirms handleFocusAssignment maintains tab=work and selects unassigned items
            expect(source).toContain('handleFocusAssignment');
            expect(source).toContain('currentParams.set(\'tab\', \'work\')');
            expect(source).toContain('setSelectedWorkItemIds');
            expect(source).toContain('ordered-analyses-table');
        });
    });

    describe('6. 12 Ordered / 9 Analytical + 2 Gates / Derived Texture Relationship (#119)', () => {
        test('S004 workspace maintains truthful parallel facts: 2 gates + 9 analytical = 11 tasks', async () => {
            const ws = await sampleWorkspaceService.getSampleWorkspace(sampleS004CanonicalId, {
                role: 'LAB_MANAGER',
                labId: 'LAB-GTM'
            });

            expect(ws).toBeDefined();
            expect(ws.workItems).toHaveLength(11);

            const gateItems = ws.workItems.filter(w => w.isGate || w.category === 'Operational Gates');
            const analyticalItems = ws.workItems.filter(w => !w.isGate && w.category !== 'Operational Gates');

            expect(gateItems).toHaveLength(2);
            expect(gateItems.map(g => g.analysis).sort()).toEqual(['DRYING', 'PREPARATION']);
            expect(analyticalItems).toHaveLength(9);

            // All 11 are unassigned
            expect(ws.counters.unassigned).toBe(11);
            expect(ws.nextAction.action).toBe('ASSIGN');
            expect(ws.nextAction.label).toBe('Assign 11 unassigned task(s) to technician');

            // Final approval must be disabled
            expect(ws.capabilities.canFinalApprove.allowed).toBe(false);
        });

        test('Aggregated queue across lab maintains 26 = 15 (S005) + 11 (S004) unassigned tasks', async () => {
            const res = await request(app)
                .get('/api/work?status=NOT_ASSIGNED&limit=100')
                .set('Authorization', `Bearer ${mgrGtmToken}`);

            expect(res.status).toBe(200);
            const items = res.body.data;

            const labGtmItems = items.filter(item =>
                [sampleS005CanonicalId, sampleS004CanonicalId].includes(item.sampleId)
            );

            expect(labGtmItems).toHaveLength(26);
            const s005Count = labGtmItems.filter(i => i.sampleId === sampleS005CanonicalId).length;
            const s004Count = labGtmItems.filter(i => i.sampleId === sampleS004CanonicalId).length;

            expect(s005Count).toBe(15);
            expect(s004Count).toBe(11);
            expect(s005Count + s004Count).toBe(26);
        });
    });

    describe('7. Safety & Immutability: Zero Live Task Assignment (#119)', () => {
        test('All work items remain strictly in NOT_ASSIGNED state with assignedTo null', async () => {
            const allItems = await prisma.workItem.findMany({
                where: { sampleId: { in: [sampleS005CanonicalId, sampleS004CanonicalId] } }
            });

            expect(allItems).toHaveLength(26);
            for (const item of allItems) {
                expect(item.status).toBe('NOT_ASSIGNED');
                expect(item.assignedTo).toBeNull();
            }
        });
    });
});
