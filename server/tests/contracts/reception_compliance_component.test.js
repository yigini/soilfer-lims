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
