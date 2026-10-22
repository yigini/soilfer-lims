'use strict';

const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const https = require('node:https');
const net = require('node:net');
const axios = require('axios');
const prisma = require('../prisma');
const scopeGuard = require('../utils/scopeGuard');
const { validateUserPrincipal } = require('./sessionValidationService');
const { JWT_SECRET } = require('../config/auth');

const TTL_SECONDS = 600;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const VARIANTS = ['original', 'small', 'medium', 'large'];
const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/avif', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif']);
const PURPOSE = 'soilfer-kobo-media-v1\0';
const blocked = new net.BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
    ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
    ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]]) {
    blocked.addSubnet(address, prefix, 'ipv4');
}
// BlockList applies the IPv4 rules to mapped IPv6 addresses too. Blocking the
// entire mapped range here would also deny ordinary public IPv4 connections.
for (const [address, prefix] of [['::', 128], ['::1', 128], ['64:ff9b::', 96], ['2002::', 16],
    ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) blocked.addSubnet(address, prefix, 'ipv6');

function fail(statusCode, code, message) {
    return Object.assign(new Error(message), { statusCode, code });
}
function invalid() { return fail(401, 'MEDIA_ACCESS_INVALID', 'Media access is missing or expired.'); }
function refused() { return fail(404, 'MEDIA_NOT_FOUND', 'The recorded image is unavailable.'); }
function isPublicAddress(address) {
    const family = net.isIP(address);
    return family !== 0 && !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}
function object(value) {
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { return {}; }
    }
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function variants(attachment) {
    return { original: attachment.download_url,
        small: attachment.download_small || attachment.download_small_url,
        medium: attachment.download_medium || attachment.download_medium_url,
        large: attachment.download_large || attachment.download_large_url };
}
function attachmentRef(attachment) {
    // Legacy sync rows did not retain Kobo's attachment id. Bind an opaque
    // reference to the exact stored row; no migration or caller URL is needed.
    return crypto.createHash('sha256').update(JSON.stringify({
        id: attachment.id ?? attachment._id ?? null, filename: attachment.filename ?? null,
        question: attachment.question ?? attachment.question_xpath ?? null, urls: variants(attachment)
    })).digest('hex');
}
function storedAttachments(sample) {
    const metadata = object(sample.metadata), field = object(sample.fieldMetadata);
    const fieldAttachments = Array.isArray(field.attachments) ? field.attachments : object(field.attachments).value;
    const rows = [fieldAttachments, metadata.attachments, metadata._attachments]
        .filter(Array.isArray).flat().filter(row => row && typeof row === 'object' && !Array.isArray(row));
    return [...new Map(rows.map(row => [attachmentRef(row), row])).entries()];
}
async function owningSample(user, id) {
    if (typeof id !== 'string' || !id || id.length > 200) throw refused();
    const sample = await prisma.sample.findUnique({ where: { id }, select: {
        id: true, assignedLab: true, labId: true, country: true, countryName: true,
        projectCode: true, projectId: true, metadata: true, fieldMetadata: true
    } });
    if (!sample) throw refused();
    if (!scopeGuard.canAccessEntity(user, sample)) {
        throw fail(403, 'MEDIA_OUTSIDE_SCOPE', 'The image is outside your authorized scope.');
    }
    return sample;
}
async function configurations(sample) {
    const labId = sample.assignedLab || sample.labId;
    const projects = [...new Set([sample.projectCode, sample.projectId].filter(Boolean))];
    if (!labId || projects.length === 0) return [];
    return prisma.koboConfig.findMany({ where: { labId, isActive: true, projectCode: { in: projects } },
        select: { id: true, koboServerUrl: true, formId: true, apiToken: true } });
}
function recordedSource(source, configs) {
    if (typeof source !== 'string' || source.length > 8192) throw refused();
    let url;
    try { url = new URL(source); } catch { throw refused(); }
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
        [...url.searchParams.keys()].some(key => /^(?:token|access_token|api_key|password|secret)$/i.test(key)) ||
        hostname === 'localhost' || hostname.endsWith('.localhost') ||
        (net.isIP(hostname) && !isPublicAddress(hostname))) throw refused();
    const matches = configs.filter(config => {
        try {
            const base = new URL(config.koboServerUrl);
            if (base.protocol !== 'https:' || base.username || base.password || base.origin !== url.origin ||
                typeof config.formId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(config.formId)) return false;
            const prefix = base.pathname.replace(/\/$/, '') + '/api/v2/assets/' + encodeURIComponent(config.formId) + '/data/';
            if (!url.pathname.startsWith(prefix)) return false;
            // Current numeric/UID attachment routes and recorded v2 thumbnail
            // routes are allowed; asset/data/config API paths are never media.
            const tail = url.pathname.slice(prefix.length);
            return /^(?:[A-Za-z0-9_-]+\/)?attachments\/[A-Za-z0-9_-]+\/?$/.test(tail) && Boolean(config.apiToken);
        } catch { return false; }
    });
    if (matches.length !== 1) throw refused();
    return { url, config: matches[0] };
}
function seal(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return body + '.' + crypto.createHmac('sha256', JWT_SECRET).update(PURPOSE + body).digest('base64url');
}
function unseal(token) {
    if (typeof token !== 'string' || token.length > 4096) throw invalid();
    const parts = token.split('.');
    if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) throw invalid();
    const signature = Buffer.from(parts[1], 'base64url');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(PURPOSE + parts[0]).digest();
    if (signature.length !== expected.length || signature.toString('base64url') !== parts[1] ||
        !crypto.timingSafeEqual(signature, expected)) throw invalid();
    let payload;
    try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { throw invalid(); }
    const now = Math.floor(Date.now() / 1000);
    if (payload?.v !== 1 || !Number.isSafeInteger(payload.e) || payload.e <= now || payload.e > now + TTL_SECONDS ||
        typeof payload.s !== 'string' || typeof payload.a !== 'string' || !/^[a-f0-9]{64}$/.test(payload.a) ||
        !VARIANTS.includes(payload.k) || typeof payload.p?.id !== 'string' ||
        !Number.isSafeInteger(payload.p.tokenVersion) || payload.p.tokenVersion < 0) throw invalid();
    return payload;
}
async function currentPrincipal(principal) {
    const decision = await validateUserPrincipal(principal, { currentPath: '/api/kobo/media' });
    if (!decision.valid) throw invalid();
    return decision.user;
}
async function issueUrls({ user, actor, sampleId, sessionExpiresAt }) {
    if (!user?.id) throw invalid();
    const principal = { id: String(user.id), tokenVersion: user.tokenVersion || 0 };
    if (actor?.id) principal.act = { id: String(actor.id), tokenVersion: actor.tokenVersion || 0 };
    const current = await currentPrincipal(principal);
    const sample = await owningSample(current, sampleId), configs = await configurations(sample);
    const expiresAt = Math.min(Math.floor(Date.now() / 1000) + TTL_SECONDS,
        Number.isSafeInteger(sessionExpiresAt) ? sessionExpiresAt : Infinity);
    if (expiresAt <= Math.floor(Date.now() / 1000)) throw invalid();
    const urls = [];
    for (const [ref, attachment] of storedAttachments(sample)) {
        for (const [variant, source] of Object.entries(variants(attachment))) {
            if (!source) continue;
            try { recordedSource(source, configs); } catch (error) {
                if (error.code === 'MEDIA_NOT_FOUND') continue;
                throw error;
            }
            const token = seal({ v: 1, p: principal, s: sample.id, a: ref, k: variant, e: expiresAt });
            urls.push({ sourceUrl: source, attachmentRef: ref, variant,
                url: '/api/kobo/media?token=' + encodeURIComponent(token) });
        }
    }
    return { sampleId: sample.id, expiresAt, urls };
}
async function readImage(token) {
    const payload = unseal(token), user = await currentPrincipal(payload.p);
    const sample = await owningSample(user, payload.s);
    const row = storedAttachments(sample).find(([ref]) => ref === payload.a);
    if (!row) throw refused();
    const { url, config } = recordedSource(variants(row[1])[payload.k], await configurations(sample));
    // Pin the verified public addresses for this request, closing the DNS
    // validation/connection race. Never send the upstream token through a proxy.
    let addresses;
    try { addresses = await dns.lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true, verbatim: true }); }
    catch { throw fail(502, 'MEDIA_FETCH_FAILED', 'The image could not be retrieved.'); }
    if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw refused();
    const agent = new https.Agent({ lookup: (hostname, options, callback) => {
        if (hostname !== url.hostname.replace(/^\[|\]$/g, '')) return callback(new Error('Unexpected media host'));
        if (options?.all) return callback(null, addresses);
        return callback(null, addresses[0].address, addresses[0].family);
    } });
    try {
        const response = await axios.get(url.href, { headers: { Authorization: `Token ${config.apiToken}` },
            responseType: 'arraybuffer', timeout: 15000, maxRedirects: 0, proxy: false,
            maxContentLength: MAX_IMAGE_BYTES, maxBodyLength: MAX_IMAGE_BYTES,
            httpsAgent: agent, validateStatus: () => true });
        if (response.status !== 200) throw fail(502, 'MEDIA_FETCH_FAILED', 'The image could not be retrieved.');
        const contentType = String(response.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
        if (!RASTER_TYPES.has(contentType)) {
            throw fail(415, 'MEDIA_TYPE_UNSUPPORTED', 'Only raster images can be displayed.');
        }
        const bytes = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
        if (bytes.length > MAX_IMAGE_BYTES || Number(response.headers['content-length']) > MAX_IMAGE_BYTES) {
            throw fail(413, 'MEDIA_TOO_LARGE', 'The image exceeds the display size limit.');
        }
        return { bytes, contentType };
    } catch (error) {
        if (error.statusCode && error.code) throw error;
        if (error.code === 'ERR_BAD_RESPONSE' && /maxContentLength/i.test(error.message || '')) {
            throw fail(413, 'MEDIA_TOO_LARGE', 'The image exceeds the display size limit.');
        }
        throw fail(502, 'MEDIA_FETCH_FAILED', 'The image could not be retrieved.');
    } finally { agent.destroy(); }
}

module.exports = { issueUrls, readImage, TTL_SECONDS, MAX_IMAGE_BYTES };
