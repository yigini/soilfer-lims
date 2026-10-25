'use strict';

const dns = require('node:dns').promises;
const https = require('node:https');
const net = require('node:net');
const axios = require('axios');

// Match the existing media fetcher's public-address boundary without changing
// that audited path. This applies to the unsaved connection-test target only.
const blocked = new net.BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
    ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
    ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]]) {
    blocked.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [['::', 128], ['::1', 128], ['64:ff9b::', 96], ['2002::', 16],
    ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) blocked.addSubnet(address, prefix, 'ipv6');

function publicAddress(address) {
    const family = net.isIP(address);
    return family !== 0 && !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

async function testKoboConnection(serverUrl, formId, apiToken) {
    let agent;
    let timer;
    try {
        const url = new URL(serverUrl);
        const hostname = url.hostname.replace(/^\[|\]$/g, '');
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
            (url.port && url.port !== '443') || hostname === 'localhost' || hostname.endsWith('.localhost') ||
            !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(url.pathname) ||
            typeof formId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(formId) ||
            (net.isIP(hostname) && !publicAddress(hostname))) {
            return { success: false, error: 'The Kobo connection target is not permitted.' };
        }
        const addresses = await Promise.race([
            dns.lookup(hostname, { all: true, verbatim: true }),
            new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('DNS timeout')), 5000); })
        ]);
        clearTimeout(timer);
        if (!addresses.length || addresses.length > 64 || addresses.some(item =>
            !publicAddress(item.address) || net.isIP(item.address) !== item.family)) {
            return { success: false, error: 'The Kobo connection target is not permitted.' };
        }
        agent = new https.Agent({ lookup: (name, options, callback) => {
            if (name !== hostname) return callback(new Error('Unexpected connection-test host'));
            if (options?.all) return callback(null, addresses);
            callback(null, addresses[0].address, addresses[0].family);
        } });
        url.pathname = url.pathname.replace(/\/$/, '') + '/api/v2/assets/' + encodeURIComponent(formId) + '/';
        const response = await axios.get(url.href, {
            headers: { Authorization: `Token ${apiToken}` }, httpsAgent: agent,
            maxRedirects: 0, proxy: false, timeout: 15000,
            maxContentLength: 1024 * 1024, maxBodyLength: 1024 * 1024, validateStatus: () => true
        });
        if (response.status !== 200) return { success: false, error: 'Could not connect to the Kobo form.' };
        return { success: true, formName: response.data.name,
            submissionCount: response.data.deployment__submission_count || 0, formUrl: response.data.url };
    } catch {
        // Axios errors contain request headers and may include the supplied token.
        return { success: false, error: 'Could not connect to the Kobo form.' };
    } finally {
        clearTimeout(timer);
        agent?.destroy();
    }
}

module.exports = { testKoboConnection };
