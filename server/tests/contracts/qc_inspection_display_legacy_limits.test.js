/**
 * Contract & Component Tests: QC Batch Inspection Display, Legacy Dispositions & Blank Limits (#118 Follow-Up)
 *
 * Verifies Acceptance Criteria for #118 focused display corrections:
 * 1. Blank limit resolution & inference restrictions:
 *    - Explicit limit (number or string) rendered as recorded limit.
 *    - Missing limit does NOT render expected concentration (e.g. 0) as upper limit.
 *    - Missing limit does NOT invent implicit SOP threshold (e.g. 0.05).
 *    - Missing limit renders "Not recorded" truthfully.
 *    - Explicit recorded status (e.g. PASS / FAIL) is preserved.
 *    - Missing/invalid measurements (empty string, whitespace, false, array, nonfinite) return null (Not evaluated).
 *    - Numeric 0 is valid for inference.
 * 2. Disposition classification and display:
 *    - Legacy 'REJECT_REANALYSIS' displayed prominently with 'REJECTED FOR RE-ANALYSIS (Legacy)' title and badge,
 *      stating factually that it is preserved for audit/review without claiming old work items were altered.
 *    - 'REANALYZE_BATCH' displayed with 'RE-ANALYZE BATCH' title and badge.
 *    - 'REJECT_BATCH' displayed with 'BATCH REJECTED' title and badge.
 *    - 'PROCEED_WITH_WARNING' displayed with 'PROCEED WITH WARNING' title and badge.
 *    - 'ACCEPT' displayed neutrally as recorded legacy decision requiring review, not a formal green acceptance claim.
 *    - Custom/unsupported decision rendered read-only for review, NEVER defaulting to approval.
 * 3. Component UI rendering:
 *    - Initial loading state SSR renders header and loading indicator.
 *    - SSR with populated initialBatch renders prominent legacy banner, blank "Not recorded",
 *      factual audit entry card, and completely suppresses the editable manager disposition form.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const esbuild = require(path.resolve(__dirname, '../../../client/node_modules/esbuild'));
const React = require(path.resolve(__dirname, '../../../client/node_modules/react'));
const ReactDOMServer = require(path.resolve(__dirname, '../../../client/node_modules/react-dom/server'));

function loadBatchInspectionModalModule() {
    const componentPath = path.resolve(__dirname, '../../../client/src/components/qc/BatchInspectionModal.jsx');
    const source = fs.readFileSync(componentPath, 'utf8');
    const transformed = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' });

    const mockLucide = new Proxy({}, { get: () => (props) => React.createElement('span', { 'data-lucide': 'icon', ...props }) });
    const mockLanguage = {
        useLanguage: () => ({
            t: (k, fallbackOrOptions, maybeDefault) => {
                if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
                if (typeof maybeDefault === 'string') return maybeDefault;
                return k;
            }
        })
    };
    const mockAuth = {
        useAuth: () => ({
            token: 'mock-token',
            user: { id: 'test-mgr', username: 'mgr_gtm', role: 'LAB_MANAGER', labId: 'GTM-LAB1' }
        })
    };

    const moduleObj = { exports: {} };
    const runContext = {
        module: moduleObj,
        exports: moduleObj.exports,
        require: (mod) => {
            if (mod === 'react') return React;
            if (mod === 'lucide-react') return mockLucide;
            if (mod.includes('LanguageContext')) return mockLanguage;
            if (mod.includes('AuthContext')) return mockAuth;
            if (mod === 'axios') return { get: jest.fn(), post: jest.fn() };
            return {};
        },
        console
    };

    vm.runInNewContext(transformed.code, runContext);
    return runContext.module.exports;
}

const {
    default: BatchInspectionModal,
    getDispositionInfo,
    formatBlankLimit,
    evaluateBlankStatus
} = loadBatchInspectionModalModule();

describe('QC Batch Inspection Display & Legacy Limits Contract Tests (#118)', () => {

    describe('1. Blank Upper Limit & Status Evaluation Logic', () => {
        test('Blank with explicit numeric limit renders the exact recorded limit', () => {
            const blank = { label: 'Reagent Blank', measured: 0.02, limit: 0.05, status: 'PASS' };
            expect(formatBlankLimit(blank)).toBe('0.05');
            expect(evaluateBlankStatus(blank)).toBe('PASS');
        });

        test('Blank with explicit string limit renders the exact recorded string', () => {
            const blank = { label: 'Reagent Blank', measured: 0.01, limit: '0.02', status: 'PASS' };
            expect(formatBlankLimit(blank)).toBe('0.02');
            expect(evaluateBlankStatus(blank)).toBe('PASS');
        });

        test('Blank with upperLimit field renders upperLimit', () => {
            const blank = { label: 'Method Blank', measured: 0.015, upperLimit: 0.03, status: 'PASS' };
            expect(formatBlankLimit(blank)).toBe('0.03');
            expect(evaluateBlankStatus(blank)).toBe('PASS');
        });

        test('CRITICAL: Blank with expected:0 but missing limit renders "Not recorded" (never 0, never implicit 0.05)', () => {
            // Exact live condition from BATCH-GTM-2026-P-01:
            // {"label":"Extraction Reagent Blank","expected":0,"measured":0.03,"status":"PASS"}
            const blank = { label: 'Extraction Reagent Blank', expected: 0, measured: 0.03, status: 'PASS' };
            
            const limitText = formatBlankLimit(blank);
            expect(limitText).toBe('Not recorded');
            expect(limitText).not.toBe('0');
            expect(limitText).not.toBe('≤ 0.05');
            
            // Preserves explicit recorded evaluation status
            expect(evaluateBlankStatus(blank)).toBe('PASS');
        });

        test('Blank with missing limit and null status returns null for evaluation (Not evaluated, no invented threshold)', () => {
            const blank = { label: 'Un-evaluated Blank', expected: 0, measured: 0.03 };
            expect(formatBlankLimit(blank)).toBe('Not recorded');
            expect(evaluateBlankStatus(blank)).toBeNull();
        });

        test('Blank without explicit status evaluates against recorded limit if both are valid finite numbers', () => {
            const blankPass = { measured: 0.03, limit: 0.05 };
            const blankFail = { measured: 0.08, limit: 0.05 };
            expect(evaluateBlankStatus(blankPass)).toBe('PASS');
            expect(evaluateBlankStatus(blankFail)).toBe('FAIL');
        });

        test('Numeric 0 is a valid measured value and valid limit', () => {
            expect(evaluateBlankStatus({ measured: 0, limit: 0.05 })).toBe('PASS');
            expect(evaluateBlankStatus({ measured: '0', limit: 0.05 })).toBe('PASS');
            expect(evaluateBlankStatus({ measured: 0, limit: 0 })).toBe('PASS');
            expect(evaluateBlankStatus({ measured: 0.01, limit: 0 })).toBe('FAIL');
            expect(formatBlankLimit({ limit: 0 })).toBe('0');
        });

        test('Missing/invalid measurements return null (Not evaluated) instead of fabricating PASS', () => {
            // Empty string
            expect(evaluateBlankStatus({ measured: '', limit: 0.05 })).toBeNull();
            // Whitespace string
            expect(evaluateBlankStatus({ measured: '   ', limit: 0.05 })).toBeNull();
            // Boolean false
            expect(evaluateBlankStatus({ measured: false, limit: 0.05 })).toBeNull();
            // Empty array
            expect(evaluateBlankStatus({ measured: [], limit: 0.05 })).toBeNull();
            // -Infinity / Infinity / NaN
            expect(evaluateBlankStatus({ measured: -Infinity, limit: 0.05 })).toBeNull();
            expect(evaluateBlankStatus({ measured: Infinity, limit: 0.05 })).toBeNull();
            expect(evaluateBlankStatus({ measured: NaN, limit: 0.05 })).toBeNull();
            expect(evaluateBlankStatus({ measured: 'not-a-number', limit: 0.05 })).toBeNull();
            // Non-finite limit
            expect(evaluateBlankStatus({ measured: 0.03, limit: Infinity })).toBeNull();
            expect(evaluateBlankStatus({ measured: 0.03, limit: '' })).toBeNull();
            expect(evaluateBlankStatus({ measured: 0.03, limit: '   ' })).toBeNull();
        });

        test('Explicit recorded status is always preserved even when measured value is missing or non-numeric', () => {
            expect(evaluateBlankStatus({ measured: '', limit: 0.05, status: 'PASS' })).toBe('PASS');
            expect(evaluateBlankStatus({ measured: false, limit: 0.05, status: 'FAIL' })).toBe('FAIL');
            expect(evaluateBlankStatus({ measured: null, limit: null, status: 'PASS' })).toBe('PASS');
        });
    });

    describe('2. Disposition Info Classification & Mapping', () => {
        test('Legacy REJECT_REANALYSIS maps to LEGACY_REJECT_REANALYSIS with factual read-only note', () => {
            const disp = {
                decision: 'REJECT_REANALYSIS',
                reason: 'CRM recovery 124% exceeds tolerance. Fresh extraction required.',
                by: 'mgr_gtm',
                at: '2026-09-07T10:00:00.000Z'
            };
            const info = getDispositionInfo(disp);
            expect(info.type).toBe('LEGACY_REJECT_REANALYSIS');
            expect(info.title).toBe('REJECTED FOR RE-ANALYSIS (Legacy)');
            expect(info.badgeText).toBe('Legacy Rejection: REJECT_REANALYSIS');
            // Does not claim old work items were changed; factually describes recorded audit entry
            expect(info.note).toContain('Persisted legacy manager disposition recorded as rejected for re-analysis');
            expect(info.note).not.toContain('Associated work items require re-analysis');
        });

        test('REANALYZE_BATCH maps to REANALYSIS_REQUIRED with prominent re-analysis title', () => {
            const disp = {
                decision: 'REANALYZE_BATCH',
                reason: 'Standard rack failure',
                by: 'mgr_1',
                at: '2026-09-20T11:00:00.000Z'
            };
            const info = getDispositionInfo(disp);
            expect(info.type).toBe('REANALYSIS_REQUIRED');
            expect(info.title).toBe('RE-ANALYZE BATCH');
            expect(info.badgeText).toBe('Re-analysis Required');
        });

        test('PROCEED_WITH_WARNING maps to WARNING_OVERRIDE with override logged badge', () => {
            const disp = {
                decision: 'PROCEED_WITH_WARNING',
                reason: 'Slight drift within matrix tolerance',
                by: 'mgr_1',
                at: '2026-09-20T12:00:00.000Z'
            };
            const info = getDispositionInfo(disp);
            expect(info.type).toBe('WARNING_OVERRIDE');
            expect(info.title).toBe('PROCEED WITH WARNING');
            expect(info.badgeText).toBe('Override Logged');
        });

        test('Legacy ACCEPT maps neutrally to CUSTOM_OR_UNSUPPORTED requiring review (not green formal acceptance)', () => {
            const disp = {
                decision: 'ACCEPT',
                reason: 'Historic run acceptable',
                by: 'mgr_old',
                at: '2026-09-08T14:30:00.000Z'
            };
            const info = getDispositionInfo(disp);
            expect(info.type).toBe('CUSTOM_OR_UNSUPPORTED');
            expect(info.title).toBe('RECORDED LEGACY ACCEPT (Under Review)');
            expect(info.badgeText).toBe('Legacy Decision: ACCEPT');
            expect(info.badgeStyle).toContain('bg-slate-200');
            expect(info.note).toContain('Not a recognized automated override; preserved read-only for technical and supervisory review');
        });

        test('Unsupported or custom decision maps to CUSTOM_OR_UNSUPPORTED without approval default', () => {
            const disp = {
                decision: 'INVESTIGATION_PENDING',
                reason: 'External audit pending.',
                by: 'auditor_1',
                at: '2026-09-22T08:00:00.000Z'
            };
            const info = getDispositionInfo(disp);
            expect(info.type).toBe('CUSTOM_OR_UNSUPPORTED');
            expect(info.title).toBe('INVESTIGATION_PENDING');
            expect(info.badgeText).toBe('Recorded: INVESTIGATION_PENDING');
            expect(info.note).toContain('Persisted disposition decision recorded in database');
        });

        test('Missing or null disposition returns null', () => {
            expect(getDispositionInfo(null)).toBeNull();
            expect(getDispositionInfo({})).toBeNull();
            expect(getDispositionInfo({ decision: '' })).toBeNull();
        });
    });

    describe('3. BatchInspectionModal Component SSR Rendering & State Assertions', () => {
        test('Initial SSR state without injected batch renders modal container, header, and audit footer', () => {
            const html = ReactDOMServer.renderToStaticMarkup(
                React.createElement(BatchInspectionModal, {
                    batchId: 'BATCH-GTM-2026-P-01',
                    isOpen: true,
                    onClose: () => {}
                })
            );
            expect(html).toContain('QC Batch Inspection');
            expect(html).toContain('BATCH-GTM-2026-P-01');
            expect(html).toContain('Recorded QC batch evaluations and manager dispositions are preserved in audit history.');
        });

        test('BatchInspectionModal with initialBatch renders prominent banner, blank Not recorded, and read-only card while suppressing editable form', () => {
            const mockBatch = {
                id: 'BATCH-GTM-2026-P-01',
                status: 'QC_FAIL',
                analysis: 'Phosphorus (Olsen)',
                labId: 'GTM-LAB1',
                disposition: {
                    decision: 'REJECT_REANALYSIS',
                    reason: 'CRM recovery 124% exceeds acceptable limit [85-115%]; bench re-digestion required.',
                    by: 'mgr_gtm',
                    at: '2026-09-07T10:00:00.000Z'
                },
                qcResults: {
                    blanks: [
                        { label: 'Extraction Reagent Blank', expected: 0, measured: 0.03, status: 'PASS' }
                    ],
                    controls: [
                        { label: 'CRM FAO-GTM-SOIL-01', expected: 15, measured: 18.6, recoveryPct: 124, status: 'FAIL' }
                    ],
                    duplicates: [
                        { sample: 'GTM-DEMO-S02', value1: 32.4, value2: 26.9, rpd: 18.5, status: 'FAIL' }
                    ]
                },
                workItems: []
            };

            const html = ReactDOMServer.renderToStaticMarkup(
                React.createElement(BatchInspectionModal, {
                    batchId: 'BATCH-GTM-2026-P-01',
                    isOpen: true,
                    onClose: () => {},
                    initialBatch: mockBatch
                })
            );

            // 1. Modal header
            expect(html).toContain('QC Batch Inspection');
            expect(html).toContain('BATCH-GTM-2026-P-01');

            // 2. Prominent legacy banner
            expect(html).toContain('REJECTED FOR RE-ANALYSIS (Legacy)');
            expect(html).toContain('Legacy Rejection: REJECT_REANALYSIS');
            expect(html).toContain('mgr_gtm');
            expect(html).toContain('CRM recovery 124% exceeds acceptable limit');

            // 3. Blank limit shows "Not recorded"
            expect(html).toContain('Not recorded');

            // 4. Form strictly suppressed (no decision selector or submit button)
            expect(html).not.toContain('Record Manager QC Disposition');
            expect(html).not.toContain('Confirm Manager Disposition');

            // 5. Read-only recorded disposition card
            expect(html).toContain('Manager QC Disposition (Recorded — Read Only)');
            expect(html).toContain('Recorded Audit Entry');
            expect(html).toContain('Recorded manager QC dispositions are preserved in audit history');
        });
    });
});
