const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');
const { renderToStaticMarkup } = require('../../../client/node_modules/react-dom/server');
const { JSDOM } = require('jsdom');

function renderMap(cesiumToken) {
    const filename = path.resolve(__dirname, '../../../client/src/components/sample/FieldMap.jsx');
    const code = esbuild.transformSync(fs.readFileSync(filename, 'utf8'), {
        loader: 'jsx', format: 'cjs'
    }).code;
    const module = { exports: {} };
    const mapPart = ({ children }) => React.createElement('div', null, children);
    const LayersControl = Object.assign(mapPart, { BaseLayer: mapPart });
    vm.runInNewContext(code, {
        module, exports: module.exports,
        require(name) {
            if (name === 'react') return React;
            if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (name === 'react-leaflet') return {
                MapContainer: mapPart, TileLayer: () => null, Marker: mapPart,
                Popup: mapPart, LayersControl
            };
            if (name === 'leaflet') return { DivIcon: class {} };
            if (name === 'leaflet/dist/leaflet.css') return {};
            if (name === '../../utils/mapConfig') return { OSM_TILE_CONFIG: {} };
            if (name === '../../context/LanguageContext') return {
                useLanguage: () => ({ t: (key, fallback) => fallback || key })
            };
            if (name === '../../context/ThemeContext') return {
                useTheme: () => ({ theme: { cesiumToken } })
            };
            if (name === '../../hooks/useKoboMediaUrls') return () => () => '';
            throw Error('Unexpected FieldMap dependency: ' + name);
        }
    }, { filename });
    const html = renderToStaticMarkup(React.createElement(module.exports.default, {
        sample: { id: 'map-fixture', coordinates: { lat: 1, lng: 2 }, metadata: {} }
    }));
    return new JSDOM(html).window.document;
}

test.each([undefined, null, '', '   ', 123])('3D is unavailable without a configured value (%s)', value => {
    const document = renderMap(value);
    const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === '3D');
    expect(button.disabled).toBe(true);
    expect(document.body.textContent).not.toContain('Loading 3D View');
    expect(document.body.textContent).toContain('2D');
});

test('the configured Branding value enables the 3D view', () => {
    const document = renderMap('configured-map-fixture');
    const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === '3D');
    expect(button.disabled).toBe(false);
    expect(document.body.textContent).toContain('Loading 3D View');
});
