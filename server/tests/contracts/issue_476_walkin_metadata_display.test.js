const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');

const clientRoot = path.resolve(__dirname, '../../../client/src');

function loadModule(file, resolve = () => ({})) {
    const module = { exports: {} };
    const code = esbuild.transformSync(
        fs.readFileSync(path.join(clientRoot, file), 'utf8'),
        { loader: file.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' }
    ).code;
    vm.runInNewContext(code, {
        module,
        exports: module.exports,
        require: resolve,
        console,
        URLSearchParams,
        URL,
        localStorage: { getItem: () => null },
        window: {
            location: { origin: 'http://localhost', reload() {} },
            addEventListener() {},
            removeEventListener() {}
        },
        document: {
            addEventListener() {},
            removeEventListener() {}
        },
        requestAnimationFrame: fn => fn()
    });
    return module.exports;
}

function makeIcons() {
    return new Proxy({}, { get: (_, iconName) => Object.assign(() => null, { iconName }) });
}

function expandTree(node, hooks) {
    if (node === null || node === undefined || typeof node === 'boolean') return null;
    if (Array.isArray(node)) return node.map(child => expandTree(child, hooks));
    if (typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
        const rendered = node.type(node.props || {});
        return expandTree(rendered, hooks);
    }
    if (node.props && 'children' in node.props) {
        return { ...node, props: { ...node.props, children: expandTree(node.props.children, hooks) } };
    }
    return node;
}

function elements(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap(node => elements(node, predicate));
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}

function textOf(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (typeof node === 'object') return textOf(node.props?.children);
    return '';
}

function loadFieldMetadataCard() {
    const hooks = {
        ...React,
        useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
        useRef: initial => ({ current: initial }),
        useEffect: () => {},
        useMemo: fn => fn(),
        useCallback: fn => fn
    };
    const icons = makeIcons();
    const exported = loadModule('components/sample/FieldMetadataCard.jsx', name => {
        if (name === 'react') return hooks;
        if (name === 'lucide-react') return icons;
        if (name.includes('useKoboMediaUrls')) return () => (...urls) => urls.find(Boolean) || '';
        return () => null;
    });
    return { Component: exported.default, hooks };
}

function loadSampleDetail(search = '?tab=request') {
    const hooks = {
        ...React,
        useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
        useRef: initial => ({ current: initial }),
        useEffect: () => {},
        useMemo: fn => fn(),
        useCallback: fn => fn
    };
    const icons = makeIcons();
    const exported = loadModule('pages/SampleDetail.jsx', name => {
        if (name === 'react') return hooks;
        if (name === 'lucide-react') return icons;
        if (name === 'axios') return { get: jest.fn(), post: jest.fn() };
        if (name === 'react-router-dom') {
            return {
                useParams: () => ({ id: 'sample-476' }),
                useNavigate: () => () => {},
                useLocation: () => ({ search })
            };
        }
        if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
        if (name.includes('AuthContext')) return { useAuth: () => ({ token: 'tok', user: { role: 'LAB_MANAGER' }, hasPermission: () => true }) };
        if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: (k, d) => d || k }) };
        if (name.includes('DialogContext')) return { useDialog: () => ({ showDialog: jest.fn() }) };
        if (name.includes('NotificationContext')) return { useNotifications: () => ({ subscribeToEvent: () => () => {} }) };
        if (name.includes('i18nHelper')) return { getStatusLabel: s => s };
        if (name.includes('workItemEvidence')) return { workItemEvidenceText: () => '' };
        if (name.includes('ProfileReferenceFields')) return { ProfileReferenceSummary: () => null };
        return () => null;
    });
    return { Component: exported.default, hooks };
}

function hostStorageMovementModal(translate) {
    const states = [];
    let cursor = 0;
    const hooks = {
        ...React,
        useState(initial) {
            const index = cursor++;
            if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
            return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
        },
        useEffect: () => {}
    };
    const icons = makeIcons();
    const exported = loadModule('components/sample/StorageMovementModal.jsx', name => {
        if (name === 'react') return hooks;
        if (name === 'axios') return { get: jest.fn().mockResolvedValue({ data: [] }), post: jest.fn().mockResolvedValue({ data: {} }) };
        if (name === 'lucide-react') return icons;
        if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: translate }) };
        return () => null;
    });
    const Component = exported.default;
    return {
        states,
        render(props = {}) {
            cursor = 0;
            return expandTree(Component(props), hooks);
        }
    };
}

function extractManualRows(tree) {
    const rows = {};
    for (const div of elements(tree, node => node.type === 'div' && typeof node.props?.className === 'string' && node.props.className.includes('justify-between py-2.5'))) {
        const children = Array.isArray(div.props.children) ? div.props.children : [div.props.children];
        const label = textOf(children[0]);
        const valueWrap = children[1];
        const valueChildren = Array.isArray(valueWrap?.props?.children) ? valueWrap.props.children : [valueWrap?.props?.children];
        const value = textOf(valueChildren[0]);
        const badge = textOf(valueChildren[1]);
        rows[label] = { value, badge };
    }
    return rows;
}

function extractInfoCards(tree) {
    const cards = {};
    for (const div of elements(tree, node => node.type === 'div' && typeof node.props?.className === 'string' && node.props.className.includes('p-3 rounded-lg bg-gray-50/80'))) {
        const spans = elements(div, node => node.type === 'div' && typeof node.props?.className === 'string');
        const labelNode = spans.find(n => n.props.className.includes('uppercase tracking-wider'));
        const valueNode = spans.find(n => n.props.className.includes('font-semibold text-gray-900'));
        if (labelNode && valueNode) {
            cards[textOf(labelNode)] = textOf(valueNode);
        }
    }
    return cards;
}

describe('#476 Part A — walk-in metadata display, Client/Submitter fallback, and storage movement hint', () => {
    test('walk-in sample renders all intake metadata keys including depthTopCm=0, isComposite=false, and keeps Intake badges', () => {
        const { Component, hooks } = loadFieldMetadataCard();
        const sample = {
            id: 'walkin-1',
            projectCode: 'WALKIN-2026',
            fieldMetadata: {
                submitterName: { value: 'Ada Lovelace', source: 'WALK_IN_INTAKE' },
                submitterOrganization: { value: 'Analytical Soils Coop', source: 'WALK_IN_INTAKE' },
                submitterPhone: { value: '+502 5555-0101', source: 'WALK_IN_INTAKE' },
                date: { value: '2026-05-14', source: 'WALK_IN_INTAKE' },
                depthType: { value: '0-20', source: 'WALK_IN_INTAKE' },
                depthTopCm: { value: 0, source: 'WALK_IN_INTAKE' },
                depthBottomCm: { value: 20, source: 'WALK_IN_INTAKE' },
                isComposite: { value: false, source: 'WALK_IN_INTAKE' },
                purpose: { value: 'Fertility baseline', source: 'WALK_IN_INTAKE' },
                location: { value: 'North terrace beside irrigation canal', source: 'WALK_IN_INTAKE' },
                management: { value: 'No-till with cover crop', source: 'WALK_IN_INTAKE' },
                elevation: { value: 0, source: 'WALK_IN_INTAKE' },
                latitude: { value: 14.63491, source: 'WALK_IN_INTAKE' },
                longitude: { value: -90.50688, source: 'WALK_IN_INTAKE' }
            }
        };

        const tree = expandTree(Component({ sample, canEdit: false }), hooks);
        const rows = extractManualRows(tree);

        expect(rows['Organization']).toEqual({ value: 'Analytical Soils Coop', badge: 'Intake' });
        expect(rows['Submitter']).toEqual({ value: 'Ada Lovelace', badge: 'Intake' });
        expect(rows['Contact']).toEqual({ value: '+502 5555-0101', badge: 'Intake' });
        expect(rows['Collection Date']).toEqual({ value: '2026-05-14', badge: 'Intake' });
        expect(rows['Depth Range']).toEqual({ value: '0-20', badge: 'Intake' });
        expect(rows['Top Depth']).toEqual({ value: '0 cm', badge: 'Intake' });
        expect(rows['Bottom Depth']).toEqual({ value: '20 cm', badge: 'Intake' });
        expect(rows['Composite']).toEqual({ value: 'No', badge: 'Intake' });
        expect(rows['Purpose']).toEqual({ value: 'Fertility baseline', badge: 'Intake' });
        expect(rows['Description']).toEqual({ value: 'North terrace beside irrigation canal', badge: 'Intake' });
        expect(rows['Management']).toEqual({ value: 'No-till with cover crop', badge: 'Intake' });
        expect(rows['Elevation']).toEqual({ value: '0', badge: 'Intake' });
        expect(rows['Coordinates']).toEqual({ value: '14.63491, -90.50688', badge: 'Intake' });
        expect(rows['Fertilizer']).toEqual({ value: '—', badge: '' });
    });

    test('legacy keys fall back cleanly, keep their own source badge, and empty/null/undefined render em-dash', () => {
        const { Component, hooks } = loadFieldMetadataCard();
        const sample = {
            id: 'legacy-1',
            fieldMetadata: {
                submitterOrganization: { value: '', source: 'WALK_IN_INTAKE' },
                organization: { value: 'Legacy Soil Lab', source: 'MANUAL_EDIT' },
                collectionDate: { value: '2025-11-02', source: 'MANUAL_EDIT' },
                depthTop: { value: 0, source: 'MANUAL_EDIT' },
                depthBottom: { value: 30, source: 'MANUAL_EDIT' },
                isComposite: { value: true, source: 'MANUAL_EDIT' },
                samplingPurpose: { value: 'Carbon audit', source: 'MANUAL_EDIT' },
                locationDescription: { value: 'Plot B4', source: 'MANUAL_EDIT' },
                managementPractices: { value: 'Organic compost', source: 'MANUAL_EDIT' },
                crop: { value: null, source: 'MANUAL_EDIT' },
                previousCrop: { value: '', source: 'MANUAL_EDIT' }
            }
        };

        const tree = expandTree(Component({ sample, canEdit: false }), hooks);
        const rows = extractManualRows(tree);

        expect(rows['Organization']).toEqual({ value: 'Legacy Soil Lab', badge: 'Edited' });
        expect(rows['Collection Date']).toEqual({ value: '2025-11-02', badge: 'Edited' });
        expect(rows['Top Depth']).toEqual({ value: '0 cm', badge: 'Edited' });
        expect(rows['Bottom Depth']).toEqual({ value: '30 cm', badge: 'Edited' });
        expect(rows['Composite']).toEqual({ value: 'Yes', badge: 'Edited' });
        expect(rows['Purpose']).toEqual({ value: 'Carbon audit', badge: 'Edited' });
        expect(rows['Description']).toEqual({ value: 'Plot B4', badge: 'Edited' });
        expect(rows['Management']).toEqual({ value: 'Organic compost', badge: 'Edited' });
        expect(rows['Current Crop']).toEqual({ value: '—', badge: '' });
        expect(rows['Previous Crop']).toEqual({ value: '—', badge: '' });
    });

    test('Kobo info cards read date before collectionDate, format depth with cm, and show 0/false rather than em-dash', () => {
        const { Component, hooks } = loadFieldMetadataCard();
        const sample = {
            id: 'kobo-1',
            metadata: { kobo_id: 'K-101', accessibility: false, sampling_succeeded: '' },
            fieldMetadata: {
                date: { value: '2026-03-10T00:00:00Z', source: 'WALK_IN_INTAKE' },
                collectionDate: { value: '2020-01-01T00:00:00Z', source: 'KOBO' },
                depth: { value: 0, source: 'KOBO' },
                site_id: { value: 0, source: 'KOBO' }
            }
        };

        const tree = expandTree(Component({ sample, canEdit: false }), hooks);
        const cards = extractInfoCards(tree);

        expect(cards['Collection Date']).toContain('2026');
        expect(cards['Depth']).toBe('0 cm');
        expect(cards['Site ID']).toBe('0');
        expect(cards['Accessibility']).toBe('No');
        expect(cards['Sampling']).toBe('—');
    });

    test.each([
        {
            label: 'uses clientName when present',
            workspaceClient: 'Highland Farms',
            fieldMetadata: { submitterName: { value: 'Ada Lovelace', source: 'WALK_IN_INTAKE' } },
            receptionData: { submitterDetails: { name: 'Grace Hopper' } },
            expected: 'Highland Farms'
        },
        {
            label: 'falls back to fieldMetadata.submitterName when clientName is Not recorded',
            workspaceClient: 'Not recorded',
            fieldMetadata: { submitterName: { value: 'Ada Lovelace', source: 'WALK_IN_INTAKE' } },
            receptionData: { submitterDetails: { name: 'Grace Hopper' } },
            expected: 'Ada Lovelace'
        },
        {
            label: 'falls back to receptionData.submitterDetails.name when submitterName is empty',
            workspaceClient: '',
            fieldMetadata: {},
            receptionData: { submitterDetails: { name: 'Grace Hopper' } },
            expected: 'Grace Hopper'
        },
        {
            label: 'renders Not recorded when all client and submitter fields are empty',
            workspaceClient: '',
            fieldMetadata: {},
            receptionData: {},
            expected: 'Not recorded'
        }
    ])('SampleDetail Client / Submitter $label', ({ workspaceClient, fieldMetadata, receptionData, expected }) => {
        const { Component, hooks } = loadSampleDetail('?tab=request');
        const initialWorkspace = {
            identity: {
                id: 'sample-476',
                labSampleCode: 'LAB-476',
                fieldId: 'FLD-476',
                assignedLab: 'LAB-1',
                status: 'RECEIVED',
                clientName: workspaceClient,
                dates: { receivedDateDisplay: '2026-05-14' }
            },
            materialCustody: { events: [] },
            capabilities: {},
            counters: { ordered: 0, recorded: 0, submitted: 0, accepted: 0 },
            workItems: []
        };
        const initialSample = {
            id: 'sample-476',
            status: 'RECEIVED',
            fieldMetadata: JSON.stringify(fieldMetadata),
            receptionData: JSON.stringify(receptionData)
        };

        const tree = expandTree(Component({ initialWorkspace, initialSample }), hooks);
        const rows = elements(tree, node => node.type === 'div' && textOf(node).startsWith('Client / Submitter'));
        expect(rows.length).toBeGreaterThan(0);
        const valueSpan = elements(rows[0], node => node.type === 'span')[1];
        expect(textOf(valueSpan)).toBe(expected);
    });

    test('StorageMovementModal marks destination and reason required and explains why Save is disabled', () => {
        const en = require('../../../client/src/translations/en.json');
        const translate = key => key.split('.').reduce((acc, part) => acc?.[part], en) || key;
        const h = hostStorageMovementModal(translate);

        let tree = h.render({ sampleId: 's-1', currentLocation: 'Shelf A', isOpen: true, onClose: () => {}, onSuccess: () => {} });
        const labels = elements(tree, node => node.type === 'label').map(textOf);
        expect(labels.some(text => text.includes(en.custody.newLocation) && text.includes('*'))).toBe(true);
        expect(labels.some(text => text.includes(en.custody.reason) && text.includes('*'))).toBe(true);

        const locationSelect = elements(tree, node => node.type === 'select' && node.props.required)[0];
        const reasonArea = elements(tree, node => node.type === 'textarea' && node.props.required)[0];
        expect(locationSelect).toBeDefined();
        expect(reasonArea).toBeDefined();

        let saveBtn = elements(tree, node => node.type === 'button' && node.props.type === 'submit')[0];
        expect(saveBtn.props.disabled).toBe(true);
        expect(saveBtn.props['aria-describedby']).toBe('custody-save-hint');
        expect(textOf(tree)).toContain('Choose a destination and give a reason');

        locationSelect.props.onChange({ target: { value: 'loc-2' } });
        reasonArea.props.onChange({ target: { value: 'Moved to cold room' } });

        tree = h.render({ sampleId: 's-1', currentLocation: 'Shelf A', isOpen: true, onClose: () => {}, onSuccess: () => {} });
        saveBtn = elements(tree, node => node.type === 'button' && node.props.type === 'submit')[0];
        expect(saveBtn.props.disabled).toBe(false);
        expect(saveBtn.props['aria-describedby']).toBeUndefined();
        expect(textOf(tree)).not.toContain('Choose a destination and give a reason');
    });

    test('storage movement disabled hints are translated in all five locales', () => {
        for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const custody = require(`../../../client/src/translations/${locale}.json`).custody;
            expect(custody.movementRequiredHint).toEqual(expect.any(String));
            expect(custody.movementRequiredHint.trim()).not.toBe('');
            expect(custody.reasonRequiredHint).toEqual(expect.any(String));
            expect(custody.reasonRequiredHint.trim()).not.toBe('');
        }
    });
});
