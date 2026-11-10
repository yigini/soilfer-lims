const fs = require('node:fs');
const path = require('node:path');
const React = require('../../../client/node_modules/react');
const { renderToStaticMarkup } = require('../../../client/node_modules/react-dom/server');
const { transformSync } = require('../../../client/node_modules/esbuild');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { ALL_ROLES, PERMISSIONS, getPermissionsForRole } = require('../../config/roles');
const { getAuthToken } = require('../setup');

const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/pages/admin/LabManagement.jsx'), 'utf8');
const { code } = transformSync(source, { loader: 'jsx', format: 'cjs' });

function renderLabDirectory(role) {
    const component = { exports: {} };
    const permissions = getPermissionsForRole(role);
    const renderChild = ({ children }) => children ?? null;
    const mocks = {
        react: React,
        'react-router-dom': {
            Link: renderChild,
            useNavigate: () => jest.fn(),
            useSearchParams: () => [new URLSearchParams(), jest.fn()]
        },
        axios: {},
        'lucide-react': new Proxy({}, { get: () => () => null }),
        '../../context/AuthContext': {
            useAuth: () => ({ user: { role }, hasPermission: key => permissions.includes(key) })
        },
        '../../context/LanguageContext': { useLanguage: () => ({ t: (key, fallback) => fallback ?? key }) },
        '../../context/DialogContext': { useDialog: () => ({ showDialog: jest.fn() }) }
    };
    new Function('module', 'exports', 'require', code)(component, component.exports, name => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name.startsWith('../../components/')) return { default: renderChild, ThemeGallery: renderChild, __esModule: true };
        throw new Error('Unexpected LabManagement dependency: ' + name);
    });
    return renderToStaticMarkup(React.createElement(component.exports.default));
}

test('CREATE_LAB is assigned only to Super Admin', () => {
    expect(PERMISSIONS.CREATE_LAB).toEqual(['SUPER_ADMIN']);
});

test.each(ALL_ROLES)('%s sees onboarding exactly when the API allows creation', async role => {
    const canCreate = role === 'SUPER_ADMIN';
    const markup = renderLabDirectory(role);
    expect(markup.includes('labDirectory.onboard')).toBe(canCreate);

    const id = 'owned-create-lab-' + role.toLowerCase();
    const token = await getAuthToken(role);
    const response = await request(app)
        .post('/api/labs')
        .set('Authorization', 'Bearer ' + token)
        .send({ id, code: id, name: 'Owned creation test', country: 'GTM' });
    expect(response.status).toBe(canCreate ? 200 : 403);
    const lab = await prisma.lab.findUnique({ where: { id } });
    if (canCreate) {
        expect(lab).toMatchObject({ id, isActive: false });
        const [state] = await prisma.$queryRawUnsafe('SELECT operationalStatus FROM LabLifecycleState WHERE labId = ?', id);
        expect(state.operationalStatus).toBe('SETUP');
    } else {
        expect(response.body.error).toContain('CREATE_LAB');
        expect(lab).toBeNull();
    }
});
