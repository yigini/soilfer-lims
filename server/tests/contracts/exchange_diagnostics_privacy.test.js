const { EventEmitter } = require('events');
const policy = require('../../services/exchangePolicyService');
const correlation = require('../../middleware/exchangeCorrelationMiddleware');

const sensitiveDetail = 'SQLITE_BUSY /srv/private/lab.db token=fixture-secret bag=BAG-PRIVATE';
const publicMessage = 'Exchange publication eligibility evaluation is temporarily unavailable.';

function response() {
    const res = new EventEmitter();
    const headers = {};
    res.setHeader = (key, value) => { headers[key] = value; };
    res.getHeader = key => headers[key];
    res.status = status => { res.statusCode = status; return res; };
    res.json = body => { res.body = body; return res; };
    return res;
}

describe('Exchange diagnostics preserve confidentiality', () => {
    afterEach(() => jest.restoreAllMocks());

    test('typed and code-only eligibility errors never expose internal messages or details', () => {
        for (const error of [
            new policy.ExchangeEligibilityUnavailableError(sensitiveDetail, { sql: sensitiveDetail }),
            Object.assign(new Error(sensitiveDetail), { code: 'EXCHANGE_ELIGIBILITY_UNAVAILABLE' })
        ]) {
            const res = response();
            policy.handleExchangeError(error, { exchangeRequestId: 'xchg_0123456789abcdef' }, res);
            expect(res.statusCode).toBe(503);
            expect(res.body).toEqual({
                error: 'Service Unavailable', code: 'EXCHANGE_ELIGIBILITY_UNAVAILABLE',
                message: publicMessage, retryAfter: 5, requestId: 'xchg_0123456789abcdef'
            });
            expect(res.getHeader('Retry-After')).toBe('5');
            expect(JSON.stringify(res.body)).not.toContain(sensitiveDetail);
        }
    });

    test('hold lookup keeps its cause internal and reports a stable retryable public error', () => {
        const cause = new Error(sensitiveDetail);
        jest.spyOn(policy, 'getHeldSampleIds').mockImplementation(() => { throw cause; });
        let error;
        try { policy.buildSampleWhere({ type: 'API_KEY', labs: ['FIXTURE-LAB'] }); }
        catch (caught) { error = caught; }
        expect(error).toBeInstanceOf(policy.ExchangeEligibilityUnavailableError);
        expect(error.message).toBe(publicMessage);
        expect(error.details).toBe(cause);
    });

    test('unrelated errors keep generic handling without reflecting caller correlation or query data', () => {
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});
        const res = response();
        const error = Object.assign(new Error(sensitiveDetail), { status: 503 });
        policy.handleExchangeError(error, {
            method: 'GET', route: { path: '/samples/:id' },
            originalUrl: `/samples/BAG-PRIVATE?token=fixture-secret`,
            headers: { 'x-request-id': sensitiveDetail }
        }, res);
        expect(res.statusCode).toBe(500);
        expect(res.body.code).toBeUndefined();
        expect(res.body.requestId).toBeNull();
        expect(res.getHeader('X-Request-Id')).toBeUndefined();
        const diagnostics = JSON.stringify(log.mock.calls);
        expect(diagnostics).toContain('/samples/:id');
        expect(diagnostics).not.toMatch(/BAG-PRIVATE|fixture-secret|private\/lab|SQLITE/);
    });

    test('phase timing logs route templates rather than bag IDs or query values', () => {
        const previousEnv = process.env.NODE_ENV;
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const res = response();
        const req = {
            method: 'GET', path: '/samples/BAG-PRIVATE', route: { path: '/samples/:id' },
            originalUrl: '/samples/BAG-PRIVATE?bbox=14.5,-90.5&token=fixture-secret'
        };
        try {
            process.env.NODE_ENV = 'development';
            correlation(req, res, () => {});
            req.startPhase('eligibility');
            req.endPhase('eligibility');
            res.statusCode = 200;
            res.emit('finish');
            expect(req.exchangeRequestId).toMatch(/^xchg_[0-9a-f]{16}$/);
            expect(req.exchangeTiming.totalDurationMs).toBeGreaterThanOrEqual(0);
            const diagnostics = JSON.stringify(log.mock.calls);
            expect(diagnostics).toContain('route=/samples/:id');
            expect(diagnostics).toContain('eligibility=');
            expect(diagnostics).not.toMatch(/BAG-PRIVATE|bbox|14\.5|fixture-secret/);
        } finally {
            process.env.NODE_ENV = previousEnv;
        }
    });
});
