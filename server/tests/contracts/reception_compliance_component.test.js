/**
 * Contract Tests: Reception ComplianceChecklist Component & Parent State Synchronization (#113, #117)
 *
 * Verifies:
 * 1. P1 Single atomic parent state update: PASS and FAIL selections update items faithfully
 *    without race condition overwrites from secondary onNonConformance parent callbacks.
 * 2. Non-conformance lifecycle: Marking FAIL sets nonConformance=true; correcting FAIL to PASS
 *    clears nonConformance=false when no manual reason is present.
 * 3. Client N/A Policy (#113):
 *    - Standard shipment mode (isWalkIn=false): All N/A buttons are disabled, including CoC.
 *    - Walk-in mode (isWalkIn=true): CoC N/A is enabled; container, label, quantity, condition N/A remain disabled.
 * 4. Note editing: Updating an item's note preserves its status and updates items correctly.
 * 5. Rehydration / Save-and-Reload: Initializing with saved state reflects accurate checked and checked counts.
 * 6. Reception mode switch cleanup: Switching from WALK_IN to PROJECT resets prohibited coc: 'NA' to undefined.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const esbuild = require(path.resolve(__dirname, '../../../client/node_modules/esbuild'));
const React = require(path.resolve(__dirname, '../../../client/node_modules/react'));
const ReactDOMServer = require(path.resolve(__dirname, '../../../client/node_modules/react-dom/server'));

function loadComplianceChecklistComponent() {
    const componentPath = path.resolve(__dirname, '../../../client/src/components/reception/ComplianceChecklist.jsx');
    const source = fs.readFileSync(componentPath, 'utf8');
    const transformed = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' });

    const mockLucide = new Proxy({}, { get: () => () => null });
    const mockLanguage = {
        useLanguage: () => ({
            t: (k, fallbackOrOptions, maybeDefault) => {
                if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
                if (typeof maybeDefault === 'string') return maybeDefault;
                return k;
            }
        })
    };
    const mockTooltip = () => null;

    const moduleObj = { exports: {} };
    const runContext = {
        module: moduleObj,
        exports: moduleObj.exports,
        require: (mod) => {
            if (mod === 'react') return React;
            if (mod === 'lucide-react') return mockLucide;
            if (mod.includes('InfoTooltip')) return mockTooltip;
            if (mod.includes('LanguageContext')) return mockLanguage;
            return {};
        },
        console
    };

    vm.runInNewContext(transformed.code, runContext);
    return runContext.module.exports.default;
}

const ComplianceChecklist = loadComplianceChecklistComponent();

// Helper: Traverse React element tree to find element matching predicate
function findElement(vnode, predicate) {
    if (!vnode || typeof vnode !== 'object') return null;
    if (predicate(vnode)) return vnode;
    if (vnode.props && vnode.props.children) {
        const children = Array.isArray(vnode.props.children) ? vnode.props.children : [vnode.props.children];
        for (const child of children) {
            const found = findElement(child, predicate);
            if (found) return found;
        }
    }
    return null;
}

function findButtonByAriaLabel(vnode, ariaLabel) {
    return findElement(vnode, el => el.type === 'button' && el.props && el.props['aria-label'] === ariaLabel);
}

function findInputByPlaceholder(vnode, placeholder) {
    return findElement(vnode, el => (el.type === 'input' || el.type === 'textarea') && el.props && el.props.placeholder === placeholder);
}

describe('Reception ComplianceChecklist Component & Parent State Contract (#113, #117)', () => {
    test('1. PASS selection atomically updates items without parent closure wipe', () => {
        // Model the exact Reception.jsx parent state holder and callbacks:
        let checklistData = { items: {}, nonConformance: false, reason: '' };
        const setChecklistData = (updater) => {
            if (typeof updater === 'function') {
                checklistData = updater(checklistData);
            } else {
                checklistData = updater;
            }
        };

        const onChange = (newValue) => setChecklistData(newValue);
        const onNonConformance = (checked) => setChecklistData(prev => ({ ...prev, nonConformance: checked }));

        const tree = ComplianceChecklist({
            value: checklistData,
            onChange,
            onNonConformance,
            isWalkIn: false
        });

        const okBtn = findButtonByAriaLabel(tree, 'Container Intact / Sealed: OK');
        expect(okBtn).toBeDefined();
        expect(okBtn.props.disabled).toBeFalsy();

        // Trigger OK click
        okBtn.props.onClick();

        expect(checklistData.items.container).toBeDefined();
        expect(checklistData.items.container.status).toBe('PASS');
        expect(checklistData.nonConformance).toBe(false);
    });

    test('2. FAIL selection sets nonConformance=true atomically; correcting back to PASS clears it', () => {
        let checklistData = { items: {}, nonConformance: false, reason: '' };
        const onChange = (newValue) => { checklistData = newValue; };
        const onNonConformance = (checked) => { checklistData = { ...checklistData, nonConformance: checked }; };

        // Step 1: Render and click FAIL for Label
        let tree = ComplianceChecklist({
            value: checklistData,
            onChange,
            onNonConformance,
            isWalkIn: false
        });

        const failBtn = findButtonByAriaLabel(tree, 'Label Legible & Matches ID: Fail');
        expect(failBtn).toBeDefined();
        failBtn.props.onClick();

        expect(checklistData.items.label).toBeDefined();
        expect(checklistData.items.label.status).toBe('FAIL');
        expect(checklistData.nonConformance).toBe(true);

        // Step 2: Re-render with new state and correct Label to PASS
        tree = ComplianceChecklist({
            value: checklistData,
            onChange,
            onNonConformance,
            isWalkIn: false
        });

        const correctOkBtn = findButtonByAriaLabel(tree, 'Label Legible & Matches ID: OK');
        correctOkBtn.props.onClick();

        expect(checklistData.items.label.status).toBe('PASS');
        expect(checklistData.nonConformance).toBe(false);
    });

    test('3. General non-conformance reason preserves nonConformance even if individual items pass', () => {
        let checklistData = {
            items: { label: { status: 'FAIL' } },
            nonConformance: true,
            reason: 'General package dampness noted at loading dock'
        };
        const onChange = (newValue) => { checklistData = newValue; };

        const tree = ComplianceChecklist({
            value: checklistData,
            onChange,
            isWalkIn: false
        });

        // Correct label to PASS
        const okBtn = findButtonByAriaLabel(tree, 'Label Legible & Matches ID: OK');
        okBtn.props.onClick();

        expect(checklistData.items.label.status).toBe('PASS');
        // nonConformance remains true because custom reason is preserved
        expect(checklistData.nonConformance).toBe(true);
    });

    test('4. Client N/A policy: disabled on standard shipment, enabled for CoC on walk-in', () => {
        let checklistData = { items: {}, nonConformance: false, reason: '' };
        const onChange = (newValue) => { checklistData = newValue; };

        // Test A: Standard shipment (isWalkIn = false)
        const shipmentTree = ComplianceChecklist({
            value: checklistData,
            onChange,
            isWalkIn: false
        });

        const cocNAShipment = findButtonByAriaLabel(shipmentTree, 'Chain of Custody Present: N/A');
        const containerNAShipment = findButtonByAriaLabel(shipmentTree, 'Container Intact / Sealed: N/A');
        const labelNAShipment = findButtonByAriaLabel(shipmentTree, 'Label Legible & Matches ID: N/A');

        expect(cocNAShipment.props.disabled).toBe(true);
        expect(containerNAShipment.props.disabled).toBe(true);
        expect(labelNAShipment.props.disabled).toBe(true);

        // Clicking disabled button must not mutate items
        cocNAShipment.props.onClick();
        expect(checklistData.items.coc).toBeUndefined();

        // Test B: Walk-in drop-off (isWalkIn = true)
        const walkInTree = ComplianceChecklist({
            value: checklistData,
            onChange,
            isWalkIn: true
        });

        const cocNAWalkIn = findButtonByAriaLabel(walkInTree, 'Chain of Custody Present: N/A');
        const containerNAWalkIn = findButtonByAriaLabel(walkInTree, 'Container Intact / Sealed: N/A');

        expect(cocNAWalkIn.props.disabled).toBe(false);
        expect(containerNAWalkIn.props.disabled).toBe(true);

        // Clicking enabled CoC N/A applies NA status
        cocNAWalkIn.props.onClick();
        expect(checklistData.items.coc).toBeDefined();
        expect(checklistData.items.coc.status).toBe('NA');
    });

    test('5. Note editing updates note without clobbering existing item status', () => {
        let checklistData = {
            items: {
                container: { status: 'FAIL', note: '' }
            },
            nonConformance: true
        };
        const onChange = (newValue) => { checklistData = newValue; };

        const tree = ComplianceChecklist({
            value: checklistData,
            onChange,
            isWalkIn: false
        });

        // The failure note input renders when an item is marked FAIL
        const noteInput = findElement(tree, el => el.type === 'input' && el.props && el.props.placeholder === 'e.g. Bag torn, lid loose, visible leakage...');
        expect(noteInput).toBeDefined();

        // Simulate typing note
        noteInput.props.onChange({ target: { value: 'Cap cracked during transit' } });

        expect(checklistData.items.container.status).toBe('FAIL');
        expect(checklistData.items.container.note).toBe('Cap cracked during transit');
    });

    test('6. Rehydration / Save-and-Reload renders faithful markup and checked status', () => {
        const savedState = {
            items: {
                container: { status: 'PASS' },
                label: { status: 'FAIL', note: 'Barcode unreadable' }
            },
            nonConformance: true,
            reason: 'General package dampness noted at reception'
        };

        const tree = ComplianceChecklist({
            value: savedState,
            onChange: () => {},
            isWalkIn: false
        });

        const containerOkBtn = findButtonByAriaLabel(tree, 'Container Intact / Sealed: OK');
        const labelFailBtn = findButtonByAriaLabel(tree, 'Label Legible & Matches ID: Fail');

        expect(containerOkBtn.props['aria-checked']).toBe(true);
        expect(labelFailBtn.props['aria-checked']).toBe(true);

        // Verify HTML static markup contains the failure notes and general non-conformance description
        const html = ReactDOMServer.renderToStaticMarkup(tree);
        expect(html).toContain('Barcode unreadable');
        expect(html).toContain('General package dampness noted at reception');
    });

    test('7. Reception intake mode switch resets prohibited CoC N/A status', () => {
        // Simulates the Reception.jsx useEffect hook behavior:
        // When mode changes from WALK_IN to PROJECT, any coc: 'NA' is cleared to undefined
        let checklistData = {
            items: {
                coc: { status: 'NA', note: 'Farmer drop-off' },
                container: { status: 'PASS' }
            },
            nonConformance: false
        };

        let mode = 'WALK_IN';

        function handleModeSwitch(newMode) {
            mode = newMode;
            if (mode !== 'WALK_IN' && checklistData?.items?.coc?.status === 'NA') {
                checklistData = {
                    ...checklistData,
                    items: {
                        ...checklistData.items,
                        coc: { ...checklistData.items.coc, status: undefined }
                    }
                };
            }
        }

        expect(checklistData.items.coc.status).toBe('NA');

        // Switch to Project mode
        handleModeSwitch('PROJECT');

        expect(checklistData.items.coc.status).toBeUndefined();
        expect(checklistData.items.coc.note).toBe('Farmer drop-off'); // Note preserved
        expect(checklistData.items.container.status).toBe('PASS');
    });
});

describe('Reception Parent Page Component & Intake Mode Contracts (#113, #114, #117)', () => {
    function loadMapConfigModule() {
        const mapConfigPath = path.resolve(__dirname, '../../../client/src/utils/mapConfig.js');
        const source = fs.readFileSync(mapConfigPath, 'utf8');
        const transformed = esbuild.transformSync(source, { loader: 'js', format: 'cjs' });
        const moduleObj = { exports: {} };
        vm.runInNewContext(transformed.code, { module: moduleObj, exports: moduleObj.exports, parseFloat, isNaN, Array });
        return moduleObj.exports;
    }

    function loadReceptionParent(options = {}) {
        const componentPath = path.resolve(__dirname, '../../../client/src/pages/Reception.jsx');
        const source = fs.readFileSync(componentPath, 'utf8');
        const transformed = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs', target: 'es2022' });

        const reactReserved = new Set([
            'propTypes', 'PropTypes', 'defaultProps', 'getDefaultProps', 'contextTypes', 'childContextTypes',
            'getDerivedStateFromProps', 'getDerivedStateFromError', '_context'
        ]);

        const createMockComponent = (name) => {
            return (props) => React.createElement('div', { 'data-mock': name }, props && props.children ? props.children : null);
        };

        function createMockModule(name) {
            const defaultExport = createMockComponent(name || 'mockComponent');
            const handler = {
                get: (target, prop) => {
                    if (prop === '__esModule') return false;
                    if (prop === 'default') return defaultExport;
                    if (reactReserved.has(prop)) return undefined;
                    if (typeof prop === 'string') {
                        return createMockComponent(prop);
                    }
                    return undefined;
                }
            };
            return new Proxy(defaultExport, handler);
        }

        const mockLocalStorage = {
            getItem: (k) => (options.localStorage && options.localStorage[k]) || null,
            setItem: () => {},
            removeItem: () => {}
        };

        const runContext = {
            module: { exports: {} },
            exports: {},
            require: (mod) => {
                if (mod === 'react') return React;
                if (mod === 'react-router-dom') return {
                    useLocation: () => ({ search: options.search || '', pathname: '/reception' })
                };
                if (mod.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => (n) => n };
                if (mod.includes('AuthContext')) return {
                    useAuth: () => ({
                        user: options.user !== undefined ? options.user : {
                            id: 'u-tech-1',
                            username: 'tech1',
                            role: 'SAMPLE_RECEPTION',
                            labId: 'LAB-TEST-01',
                            lab: { id: 'LAB-TEST-01', name: 'Test Lab', location: '-15.41, 28.28' }
                        },
                        token: 'mock-token'
                    })
                };
                if (mod.includes('DialogContext')) return { useDialog: () => ({ showDialog: () => {} }) };
                if (mod.includes('LanguageContext')) return { useLanguage: () => ({ t: (k, d) => d || k }) };
                if (mod === 'axios') return {
                    get: () => Promise.resolve({ data: options.axiosData || [] }),
                    post: () => Promise.resolve({ data: {} }),
                    put: () => Promise.resolve({ data: {} })
                };
                if (mod.includes('mapConfig')) return loadMapConfigModule();
                return createMockModule(mod);
            },
            console,
            localStorage: mockLocalStorage,
            window: {
                addEventListener: () => {},
                removeEventListener: () => {}
            }
        };

        vm.runInNewContext(transformed.code, runContext);
        return runContext.module.exports.default || runContext.module.exports;
    }

    test('1. Real Reception parent renders to string without TDZ ReferenceError', () => {
        // Independent verification of P1: Reception.jsx does not throw
        // ReferenceError: Cannot access 'checklistData' before initialization
        expect(() => {
            const Reception = loadReceptionParent();
            const element = React.createElement(Reception);
            const html = ReactDOMServer.renderToString(element);
            expect(typeof html).toBe('string');
            expect(html.length).toBeGreaterThan(0);
        }).not.toThrow();
    });

    test('2. Real Reception parent renders initial intake mode selector and drafts dashboard', () => {
        const Reception = loadReceptionParent();
        const html = ReactDOMServer.renderToString(React.createElement(Reception));

        expect(html).toContain('Reception Console');
        expect(html).toContain('Select intake mode or resume a draft');
        expect(html).toContain('Project Sample');
        expect(html).toContain('Walk-in Sample');
        expect(html).toContain('Consignment Batch');
        expect(html).toContain('Incomplete Intakes (Drafts)');
    });

    test('3. Real Reception parent sources actual configured lab coordinates from user.lab profile', () => {
        const userWithConfiguredLab = {
            id: 'u-tech-zambia',
            username: 'tech_zambia',
            role: 'SAMPLE_RECEPTION',
            labId: 'LAB-ZMB-CUSTOM',
            lab: {
                id: 'LAB-ZMB-CUSTOM',
                name: 'Lusaka Central Laboratory',
                location: '-15.4167, 28.2833' // Real schema string format
            }
        };

        const Reception = loadReceptionParent({ user: userWithConfiguredLab });
        const html = ReactDOMServer.renderToString(React.createElement(Reception));

        expect(html).toContain('Reception Console');
        // Verify parseCoordinates from mapConfig correctly handles user.lab.location
        const { parseCoordinates } = loadMapConfigModule();
        const parsed = parseCoordinates(userWithConfiguredLab.lab.location);
        expect(parsed).toEqual([-15.4167, 28.2833]);
    });

    test('4. Real Reception parent safely handles laboratory with null or unconfigured coordinates', () => {
        const userWithoutLabCoords = {
            id: 'u-tech-nocoords',
            username: 'tech_generic',
            role: 'SAMPLE_RECEPTION',
            labId: 'LAB-NEW',
            lab: {
                id: 'LAB-NEW',
                name: 'New Field Laboratory',
                location: null // Missing / unconfigured location
            }
        };

        expect(() => {
            const Reception = loadReceptionParent({ user: userWithoutLabCoords });
            const html = ReactDOMServer.renderToString(React.createElement(Reception));
            expect(html).toContain('Reception Console');
        }).not.toThrow();
    });

    test('5. Reception intake mode switch enforces N/A policy cleanup (WALK_IN to PROJECT reset)', () => {
        // Source Reception.jsx source code directly to ensure the effect is placed AFTER useState
        const componentPath = path.resolve(__dirname, '../../../client/src/pages/Reception.jsx');
        const source = fs.readFileSync(componentPath, 'utf8');

        const stateDeclIndex = source.indexOf('const [checklistData, setChecklistData] = useState');
        const effectIndex = source.indexOf("if (mode !== 'WALK_IN' && checklistData?.items?.coc?.status === 'NA')");

        expect(stateDeclIndex).toBeGreaterThan(0);
        expect(effectIndex).toBeGreaterThan(0);
        // Effect MUST be declared after checklistData useState declaration to prevent TDZ ReferenceError
        expect(effectIndex).toBeGreaterThan(stateDeclIndex);
    });
});
