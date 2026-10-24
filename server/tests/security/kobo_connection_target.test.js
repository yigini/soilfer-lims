jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('node:dns', () => ({ promises: { lookup: jest.fn() } }));

const axios = require('axios');
const dns = require('node:dns').promises;
const koboService = require('../../services/koboService');

describe('R3 unsaved Kobo connection-test target', () => {
    const token = 'public-synthetic-connection-test-token';
    beforeEach(() => {
        jest.clearAllMocks();
        dns.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
        axios.get.mockResolvedValue({ status: 200, data: { name: 'Synthetic form', deployment__submission_count: 2 } });
    });

    test.each(['http://kobo.example.invalid', 'https://localhost', 'https://127.0.0.1',
        'https://[::1]', 'https://169.254.169.254', 'https://10.0.0.1', 'https://[::ffff:127.0.0.1]',
        'https://user:synthetic@kobo.example.invalid', 'https://kobo.example.invalid:8443',
        'https://kobo.example.invalid?token=synthetic', 'https://kobo.example.invalid/#fragment'])(
        'refuses unsafe target %s before DNS or credential delivery', async target => {
            const result = await koboService.testConnection(target, 'synthetic_form', token);
            expect(result.success).toBe(false);
            expect(dns.lookup).not.toHaveBeenCalled();
            expect(axios.get).not.toHaveBeenCalled();
        });
    test.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '::1', 'fd00::1', '::ffff:127.0.0.1'])(
        'refuses a hostname resolving to %s without sending credentials', async address => {
            dns.lookup.mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }]);
            expect((await koboService.testConnection('https://kobo.example.invalid', 'synthetic_form', token)).success).toBe(false);
            expect(axios.get).not.toHaveBeenCalled();
        });
    test('mixed public/private DNS answers are refused as a whole', async () => {
        dns.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]);
        expect((await koboService.testConnection('https://kobo.example.invalid', 'synthetic_form', token)).success).toBe(false);
        expect(axios.get).not.toHaveBeenCalled();
    });
    test.each(['../other', 'form?token=synthetic', 'form/other', 'form#fragment'])(
        'refuses asset path injection %s', async formId => {
            expect((await koboService.testConnection('https://kobo.example.invalid', formId, token)).success).toBe(false);
            expect(axios.get).not.toHaveBeenCalled();
        });
    test('public HTTPS request pins verified DNS and disables redirects and proxies', async () => {
        const result = await koboService.testConnection('https://kobo.example.invalid/base', 'synthetic_form', token);
        expect(result).toMatchObject({ success: true, formName: 'Synthetic form', submissionCount: 2 });
        expect(axios.get).toHaveBeenCalledTimes(1);
        const [url, options] = axios.get.mock.calls[0];
        expect(url).toBe('https://kobo.example.invalid/base/api/v2/assets/synthetic_form/');
        expect(options).toMatchObject({ maxRedirects: 0, proxy: false, timeout: 15000,
            headers: { Authorization: `Token ${token}` } });
        const pinned = await new Promise((resolve, reject) => options.httpsAgent.options.lookup(
            'kobo.example.invalid', {}, (error, address, family) => error ? reject(error) : resolve({ address, family })));
        expect(pinned).toEqual({ address: '8.8.8.8', family: 4 });
        expect(dns.lookup).toHaveBeenCalledTimes(1);
    });
    test('redirect and Axios failures return constant errors without logging request headers', async () => {
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            axios.get.mockResolvedValueOnce({ status: 302, headers: { location: 'http://127.0.0.1' } });
            const redirect = await koboService.testConnection('https://kobo.example.invalid', 'synthetic_form', token);
            expect(redirect.success).toBe(false);
            axios.get.mockRejectedValueOnce(Object.assign(new Error(token), { config: { headers: { Authorization: token } } }));
            const failed = await koboService.testConnection('https://kobo.example.invalid', 'synthetic_form', token);
            expect(failed.success).toBe(false);
            expect(JSON.stringify(failed).includes(token)).toBe(false);
            expect(log).not.toHaveBeenCalled();
        } finally { log.mockRestore(); }
    });
});
