const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');
const XLSX = require('../../../client/node_modules/xlsx');

function elements(node, predicate) {
    if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate));
    if (!node || typeof node !== 'object') return [];
    return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)];
}

function text(node) {
    if (Array.isArray(node)) return node.map(text).join(' ');
    return node && typeof node === 'object' ? text(node.props?.children) : String(node ?? '');
}

function makeCsvFile(name, csvText, type = 'text/csv') {
    const bytes = Buffer.from(csvText, 'utf8');
    return {
        name,
        type,
        size: bytes.byteLength,
        bytes
    };
}

function createHarness() {
    const states = [];
    const effects = [];
    const cleanups = [];
    const storage = {};
    let stateIndex = 0;
    let effectIndex = 0;

    const hooks = {
        ...React,
        useState(initial) {
            const index = stateIndex++;
            if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
            return [states[index], value => {
                states[index] = typeof value === 'function' ? value(states[index]) : value;
            }];
        },
        useEffect(fn, deps) {
            const index = effectIndex++;
            if (JSON.stringify(effects[index]) !== JSON.stringify(deps)) {
                cleanups[index]?.();
                effects[index] = deps;
                cleanups[index] = fn();
            }
        }
    };

    const alert = jest.fn();
    const module = { exports: {} };
    const filePath = path.resolve(__dirname, '../../../client/src/components/reception/ManifestImportModal.jsx');
    const source = fs.readFileSync(filePath, 'utf8');
    const code = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' }).code;

    class MockFileReader {
        readAsArrayBuffer(file) {
            const buf = file.bytes || Buffer.from('');
            const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            this.onload({ target: { result: ab } });
        }
    }

    vm.runInNewContext(code, {
        module,
        exports: module.exports,
        console,
        alert,
        Uint8Array,
        FileReader: MockFileReader,
        localStorage: {
            getItem: key => (key in storage ? storage[key] : null),
            setItem: (key, value) => { storage[key] = String(value); }
        },
        window: { addEventListener() {}, removeEventListener() {} },
        require: dependency => {
            if (dependency === 'react') return hooks;
            if (dependency === 'xlsx') return XLSX;
            if (dependency === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (dependency.includes('LanguageContext')) {
                return {
                    useLanguage: () => ({
                        t: (key, params) => (params?.name ? `${key}:${params.name}` : key)
                    })
                };
            }
            if (dependency.includes('coordParser')) return { parseCoordinates: () => null };
            if (dependency.includes('spreadsheetImport')) return { MAX_FILE_SIZE: 5 * 1024 * 1024 };
            return () => null;
        }
    });

    return {
        exports: module.exports,
        states,
        storage,
        alert,
        render(props = { isOpen: true, onClose() {}, onImport() {} }) {
            stateIndex = 0;
            effectIndex = 0;
            return module.exports.default(props);
        }
    };
}

describe('ManifestImportModal drag-and-drop (#473) and header auto-mapping (#474)', () => {
    test('dropping a small CSV prevents default, parses the sheet, and lands on the mapping step', () => {
        const h = createHarness();
        let tree = h.render();
        const dropZone = elements(tree, node => node.props?.['data-testid'] === 'manifest-drop-zone')[0];
        expect(dropZone).toBeDefined();

        const dragOverEvent = { preventDefault: jest.fn() };
        dropZone.props.onDragOver(dragOverEvent);
        expect(dragOverEvent.preventDefault).toHaveBeenCalledTimes(1);

        const csvFile = makeCsvFile('manifest.csv', 'sample_id,lat,long,top,bottom\nS-001,14.5,-89.4,0,20\n');
        const dropEvent = {
            preventDefault: jest.fn(),
            dataTransfer: { files: [csvFile] }
        };
        dropZone.props.onDrop(dropEvent);
        expect(dropEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(h.alert).not.toHaveBeenCalled();

        tree = h.render();
        // Landed on step 2 (mapping grid has selects for LIMS_FIELDS + 1 template select)
        expect(h.states[0]).toBe(2);
        const mapping = h.states[6];
        expect(mapping.sampleId).toBe('sample_id');
        expect(mapping.latitude).toBe('lat');
        expect(mapping.longitude).toBe('long');
        expect(mapping.depthTop).toBe('top');
        expect(mapping.depthBottom).toBe('bottom');
        expect(elements(tree, node => node.type === 'button' && text(node).includes('Preview & Validate'))).toHaveLength(1);
    });

    test('dropping a .pdf shows the exact same invalid-format message as Choose File', () => {
        const dropHarness = createHarness();
        const dropTree = dropHarness.render();
        const dropZone = elements(dropTree, node => node.props?.['data-testid'] === 'manifest-drop-zone')[0];
        const pdfFile = makeCsvFile('manifest.pdf', '%PDF-1.4', 'application/pdf');

        dropZone.props.onDrop({
            preventDefault: jest.fn(),
            dataTransfer: { files: [pdfFile] }
        });

        const inputHarness = createHarness();
        const inputTree = inputHarness.render();
        const fileInput = elements(inputTree, node => node.type === 'input' && node.props.type === 'file')[0];
        const target = { files: [pdfFile], value: 'C:\\fakepath\\manifest.pdf' };
        fileInput.props.onChange({ target });

        expect(dropHarness.alert).toHaveBeenCalledTimes(1);
        expect(inputHarness.alert).toHaveBeenCalledTimes(1);
        expect(dropHarness.alert.mock.calls[0][0]).toBe(inputHarness.alert.mock.calls[0][0]);
        expect(dropHarness.states[0]).toBe(1);
        expect(target.value).toBe('');
    });

    test('dropping multiple files uses the first file and displays a short notice', () => {
        const h = createHarness();
        let tree = h.render();
        const dropZone = elements(tree, node => node.props?.['data-testid'] === 'manifest-drop-zone')[0];

        const first = makeCsvFile('first.csv', 'sample_id,top,bottom\nS-1,0,15\n');
        const second = makeCsvFile('second.csv', 'sample_id,top,bottom\nS-2,15,30\n');
        dropZone.props.onDrop({
            preventDefault: jest.fn(),
            dataTransfer: { files: [first, second] }
        });

        tree = h.render();
        expect(h.states[0]).toBe(2);
        expect(h.states[1]).toBe('first.csv');
        const statusNotice = elements(tree, node => node.props?.role === 'status')[0];
        expect(statusNotice).toBeDefined();
        expect(text(statusNotice)).toContain('batchIntake.manifestMultipleFilesNotice:first.csv');
    });

    test('autoMapManifestHeaders maps lat,long,top,bottom accurately and never maps total_mass or bare x/y to depth or coordinates', () => {
        const { autoMapManifestHeaders, normalizeHeader } = createHarness().exports;

        expect(normalizeHeader('  Depth Top (cm)  ')).toBe('depth_top_cm');
        expect(normalizeHeader('--Bottom/Depth--')).toBe('bottom_depth');

        const mapped = autoMapManifestHeaders(['lat', 'long', 'top', 'bottom', 'total_mass', 'lateral', 'x', 'y', 'notes']);
        expect(mapped).toEqual({
            latitude: 'lat',
            longitude: 'long',
            depthTop: 'top',
            depthBottom: 'bottom'
        });
        expect(mapped.depthTop).toBe('top');
        expect(mapped.depthBottom).toBe('bottom');
        expect(Object.values(mapped)).not.toContain('total_mass');
        expect(Object.values(mapped)).not.toContain('lateral');
        expect(Object.values(mapped)).not.toContain('x');
        expect(Object.values(mapped)).not.toContain('y');
    });

    test('autoMapManifestHeaders never assigns the same header to two fields', () => {
        const { autoMapManifestHeaders } = createHarness().exports;
        const fields = [
            { key: 'firstField', aliases: ['shared_col'] },
            { key: 'secondField', aliases: ['shared_col'] }
        ];
        const mapped = autoMapManifestHeaders(['Shared Col'], fields);
        expect(mapped).toEqual({ firstField: 'Shared Col' });
        expect(mapped.secondField).toBeUndefined();
    });

    test('saved mapping templates continue to save and load', () => {
        const h = createHarness();
        let tree = h.render();
        const dropZone = elements(tree, node => node.props?.['data-testid'] === 'manifest-drop-zone')[0];
        dropZone.props.onDrop({
            preventDefault: jest.fn(),
            dataTransfer: { files: [makeCsvFile('m.csv', 'sample_id,custom_top\nS-1,5\n')] }
        });

        tree = h.render();
        // Manually map depthTop -> custom_top and save profile
        h.states[6] = { sampleId: 'sample_id', depthTop: 'custom_top' };
        h.states[10] = 'FAO-KE';
        tree = h.render();
        const saveBtn = elements(tree, node => node.type === 'button' && text(node).includes('Save'))[0];
        saveBtn.props.onClick();

        // Clear mapping and reload saved profile
        h.states[6] = {};
        tree = h.render();
        const profileSelect = elements(tree, node => node.type === 'select')[0];
        profileSelect.props.onChange({ target: { value: 'FAO-KE' } });
        expect(h.states[6]).toEqual({ sampleId: 'sample_id', depthTop: 'custom_top' });
    });

    test('multi-file drop notice is localized in all five locales', () => {
        for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const messages = require(`../../../client/src/translations/${locale}.json`).batchIntake;
            expect(typeof messages.manifestMultipleFilesNotice).toBe('string');
            expect(messages.manifestMultipleFilesNotice.trim()).not.toBe('');
            expect(messages.manifestMultipleFilesNotice).toContain('{name}');
        }
    });
});
