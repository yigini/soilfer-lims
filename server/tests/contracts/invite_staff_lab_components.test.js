const fs = require('fs');
const path = require('path');
const vm = require('vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');

const InviteStub = () => null;
const icons = new Proxy({}, { get: () => () => null });
const t = key => key;

function component(relativePath, axios, user) {
    const states = [];
    let index = 0;
    const hooks = {
        ...React,
        useState(initial) {
            const position = index++;
            if (!(position in states)) states[position] = initial;
            return [states[position], next => {
                states[position] = typeof next === 'function' ? next(states[position]) : next;
            }];
        },
        useEffect() {},
        useCallback: callback => callback
    };
    const deps = {
        react: hooks,
        axios,
        'lucide-react': icons,
        '../context/AuthContext': { useAuth: () => ({ user }) },
        '../context/LanguageContext': { useLanguage: () => ({ t }) },
        '../../context/LanguageContext': { useLanguage: () => ({ t }) },
        '../context/DialogContext': { useDialog: () => ({ showDialog: jest.fn() }) },
        '../../hooks/useFocusTrap': { useFocusTrap: () => ({ current: null }) },
        '../components/staff/InviteStaffModal': InviteStub
    };
    const filename = path.resolve(__dirname, '../../../client/src', relativePath);
    const module = { exports: {} };
    const code = esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
    vm.runInNewContext(code, { module, exports: module.exports, require: name => deps[name] || (() => null) });
    return props => {
        index = 0;
        return module.exports.default(props);
    };
}

function elements(node, matches) {
    if (Array.isArray(node)) return node.flatMap(child => elements(child, matches));
    if (!node || typeof node !== 'object') return [];
    return [...(matches(node) ? [node] : []), ...elements(node.props?.children, matches)];
}

const lab = { id: 'active', name: 'Active lab', code: 'A', isActive: true };
const submit = tree => elements(tree, node => node.props?.type === 'submit')[0];
const select = tree => elements(tree, node => node.props?.id === 'invite-lab')[0];
const form = tree => elements(tree, node => node.type === 'form')[0];

test('a lab-less global admin chooses the only active lab before creating an invitation', async () => {
    const axios = {
        get: jest.fn(async url => url === '/api/labs/directory'
            ? { data: [lab, { id: 'paused', name: 'Paused lab', code: 'P', isActive: false }] }
            : { data: { assignableRoles: [{ role: 'LAB_TECHNICIAN' }] } }),
        post: jest.fn().mockRejectedValue({
            message: 'Request failed with status code 409',
            response: { data: { code: 'ACCOUNT_ALREADY_EXISTS', message: 'Account with this email already exists.' } }
        })
    };
    const renderUsers = component('pages/Users.jsx', axios, { role: 'SUPER_ADMIN', labId: null });
    const open = elements(renderUsers(), node => node.type === 'button' && node.props.children?.includes?.('users.inviteStaff'))[0];
    await open.props.onClick();
    expect(axios.get).toHaveBeenCalledWith('/api/labs/directory');
    const { props } = elements(renderUsers(), node => node.type === InviteStub)[0];
    expect(props.availableLabs).toEqual([lab]);
    const renderInvite = component('components/staff/InviteStaffModal.jsx', axios);
    let tree = renderInvite(props);
    for (const [type, value] of [['text', 'Sample User'], ['email', 'USER@example.org']]) {
        elements(tree, node => node.type === 'input' && node.props.type === type)[0].props.onChange({ target: { value } });
    }

    tree = renderInvite(props);
    expect(select(tree).props.value).toBe('');
    expect(submit(tree).props.disabled).toBe(true);
    await form(tree).props.onSubmit({ preventDefault() {} });
    expect(axios.post).not.toHaveBeenCalled();

    select(tree).props.onChange({ target: { value: lab.id } });
    await Promise.resolve();
    tree = renderInvite(props);
    expect(submit(tree).props.disabled).toBe(false);
    await form(tree).props.onSubmit({ preventDefault() {} });
    expect(axios.post).toHaveBeenCalledWith('/api/staff/invitations', {
        name: 'Sample User', email: 'user@example.org', role: 'LAB_TECHNICIAN', labId: lab.id
    });
    const feedback = renderInvite(props);
    expect(elements(feedback, node => node.props?.children === 'Account with this email already exists.')).toHaveLength(1);
});

test('the laboratory selector has a disabled prompt and no global invitation option', () => {
    const renderInvite = component('components/staff/InviteStaffModal.jsx', {});
    const labs = [lab, { id: 'other', name: 'Other lab', code: 'O', isActive: true }];
    const picker = select(renderInvite({ isOpen: true, defaultLabId: lab.id, availableLabs: labs }));
    const options = elements(picker, node => node.type === 'option');
    expect(options.map(node => node.props.value)).toEqual(['', 'active', 'other']);
    expect(options[0].props.disabled).toBe(true);
    expect(options[0].props.children).toBe('staffManagement.invite.selectLab');
    expect(picker.props.value).toBe(lab.id);
});

test('a lab manager opens the invitation with the assigned lab and no directory request', async () => {
    const axios = { get: jest.fn() };
    const renderUsers = component('pages/Users.jsx', axios, { role: 'LAB_MANAGER', labId: lab.id });
    const open = elements(renderUsers(), node => node.type === 'button' && node.props.children?.includes?.('users.inviteStaff'))[0];
    await open.props.onClick();
    expect(axios.get).not.toHaveBeenCalled();
    const { props } = elements(renderUsers(), node => node.type === InviteStub)[0];
    expect(props.defaultLabId).toBe(lab.id);
    expect(props.availableLabs).toEqual([]);
});
