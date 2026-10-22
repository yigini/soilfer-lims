'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const prisma = require('../prisma');
const scopeGuard = require('../utils/scopeGuard');
const { validateUserPrincipal } = require('./sessionValidationService');
const { JWT_SECRET } = require('../config/auth');
const files = require('../utils/uploadFiles');

const TTL_SECONDS = 600;
const PURPOSE = 'soilfer-upload-media-v1\0';
function failure(statusCode, code, message) {
    return Object.assign(new Error(message), { statusCode, code, uploadMediaError: true });
}
function invalid() { return failure(401, 'UPLOAD_ACCESS_INVALID', 'Image access is missing or expired.'); }
function unavailable() { return failure(404, 'UPLOAD_NOT_FOUND', 'The recorded image is unavailable.'); }
function outside() { return failure(403, 'UPLOAD_OUTSIDE_SCOPE', 'The image is outside your authorized scope.'); }
function object(value) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return {}; } }
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function array(value) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return []; } }
    return Array.isArray(value) ? value : [];
}
function photoPaths(sample) {
    const reception = object(sample.receptionData), metadata = object(sample.metadata);
    return [array(sample.intakePhotos), array(reception.photos), array(reception.intakePhotos),
        array(object(metadata.nonConformance).photos)].flat().map(files.canonicalIntakePath).filter(Boolean);
}
function principalFor(user, actor) {
    if (!user?.id) throw invalid();
    const principal = { id: String(user.id), tokenVersion: user.tokenVersion || 0 };
    if (actor?.id) principal.act = { id: String(actor.id), tokenVersion: actor.tokenVersion || 0 };
    return principal;
}
async function currentPrincipal(principal) {
    const decision = await validateUserPrincipal(principal, { currentPath: '/api/uploads/access' });
    if (!decision.valid) throw invalid();
    return decision.user;
}
function metadataFor(canonical) {
    const name = path.basename(canonical);
    const root = path.join(files.uploadsRoot(), '.intake-ownership');
    // Only an absent receipt is legacy. Refuse symlinked directories and
    // dangling/non-regular entries instead of downgrading their ownership.
    try {
        const directory = fs.lstatSync(root);
        if (directory.isSymbolicLink() || !directory.isDirectory()) throw unavailable();
        fs.lstatSync(path.join(root, name + '.json'));
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw unavailable();
    }
    const record = files.regularFile(root, name + '.json');
    if (!record) throw unavailable();
    if (record.stat.size > 4096) throw unavailable();
    let metadata;
    try { metadata = JSON.parse(fs.readFileSync(record.full, 'utf8')); } catch { throw unavailable(); }
    if (metadata.v !== 1 || metadata.path !== canonical || typeof metadata.labId !== 'string' ||
        !metadata.labId || typeof metadata.uploadedBy !== 'string') throw unavailable();
    return metadata;
}
async function references(canonical) {
    const name = path.basename(canonical);
    const candidates = await prisma.sample.findMany({ where: { OR: [
        { intakePhotos: { contains: name } }, { receptionData: { contains: name } },
        { metadata: { contains: name } }
    ] }, select: { id: true, assignedLab: true, labId: true, country: true, countryName: true,
        projectId: true, projectCode: true, intakePhotos: true, receptionData: true, metadata: true } });
    return candidates.filter(sample => photoPaths(sample).includes(canonical));
}
async function authorize(user, canonical) {
    const metadata = metadataFor(canonical), samples = await references(canonical);
    if (metadata) {
        const lab = await prisma.lab.findUnique({ where: { id: metadata.labId }, select: { id: true, isActive: true } });
        if (!lab?.isActive) throw unavailable();
        // New files keep their server-recorded facility ownership. A caller
        // cannot acquire another lab's file by inserting its URL on a sample.
        if (samples.some(sample => (sample.assignedLab || sample.labId) !== metadata.labId)) throw unavailable();
        if (samples.length ? !samples.some(sample => scopeGuard.canAccessEntity(user, sample)) :
            !scopeGuard.canAccessEntity(user, { labId: metadata.labId })) throw outside();
    } else {
        // Legacy paths have no upload receipt: require exact persisted sample
        // references, and refuse ambiguous cross-scope ownership.
        if (!samples.length) throw unavailable();
        if (!samples.every(sample => scopeGuard.canAccessEntity(user, sample))) throw outside();
    }
    const file = files.regularFile(path.join(files.uploadsRoot(), 'intake'), path.basename(canonical));
    if (!file) throw unavailable();
    if (file.stat.size > files.MAX_IMAGE_BYTES) throw failure(413, 'UPLOAD_TOO_LARGE', 'The image exceeds the display size limit.');
    const type = files.fileType(file);
    if (!type) throw failure(415, 'UPLOAD_TYPE_UNSUPPORTED', 'Only JPEG, PNG or WebP images can be displayed.');
    return { ...file, contentType: type.contentType };
}
function seal(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return body + '.' + crypto.createHmac('sha256', JWT_SECRET).update(PURPOSE + body).digest('base64url');
}
function unseal(token) {
    if (typeof token !== 'string' || token.length > 4096) throw invalid();
    const parts = token.split('.');
    if (parts.length !== 2 || !parts.every(value => /^[A-Za-z0-9_-]+$/.test(value))) throw invalid();
    const signature = Buffer.from(parts[1], 'base64url');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(PURPOSE + parts[0]).digest();
    if (signature.length !== expected.length || signature.toString('base64url') !== parts[1] ||
        !crypto.timingSafeEqual(signature, expected)) throw invalid();
    let payload;
    try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { throw invalid(); }
    const now = Math.floor(Date.now() / 1000);
    if (payload?.v !== 1 || !Number.isSafeInteger(payload.e) || payload.e <= now || payload.e > now + TTL_SECONDS ||
        !files.canonicalIntakePath(payload.r) || typeof payload.p?.id !== 'string' ||
        !Number.isSafeInteger(payload.p.tokenVersion) || payload.p.tokenVersion < 0) throw invalid();
    return payload;
}
async function issueUrls({ user, actor, paths, sessionExpiresAt }) {
    if (!Array.isArray(paths) || paths.length > 100 || paths.some(value => !files.canonicalIntakePath(value))) {
        throw failure(400, 'UPLOAD_REQUEST_INVALID', 'A list of recorded intake image paths is required.');
    }
    const principal = principalFor(user, actor), current = await currentPrincipal(principal);
    const expiresAt = Math.min(Math.floor(Date.now() / 1000) + TTL_SECONDS,
        Number.isSafeInteger(sessionExpiresAt) ? sessionExpiresAt : Infinity);
    if (expiresAt <= Math.floor(Date.now() / 1000)) throw invalid();
    const urls = [], refusals = [];
    for (const canonical of [...new Set(paths)]) {
        try { await authorize(current, canonical); }
        catch (error) {
            if (!error.uploadMediaError || ![403, 404, 413, 415].includes(error.statusCode)) throw error;
            refusals.push(error);
            continue;
        }
        const token = seal({ v: 1, p: principal, r: canonical, e: expiresAt });
        urls.push({ sourceUrl: canonical, url: canonical + '?token=' + encodeURIComponent(token) });
    }
    // A missing/unsupported legacy file must not hide the other authorized
    // photos in the same view. Never issue a capability for a refused entry.
    if (!urls.length && refusals.length) throw refusals[0];
    return { expiresAt, urls };
}
async function readImage({ user, actor, canonical, token }) {
    if (!files.canonicalIntakePath(canonical)) throw unavailable();
    let current;
    if (user) current = await currentPrincipal(principalFor(user, actor));
    else {
        const payload = unseal(token);
        if (payload.r !== canonical) throw invalid();
        current = await currentPrincipal(payload.p);
    }
    return authorize(current, canonical);
}
async function storePhotos({ user, actor, uploads, requestedLab }) {
    const current = await currentPrincipal(principalFor(user, actor));
    const labId = requestedLab || current.labId;
    if (typeof labId !== 'string' || !labId || !scopeGuard.canManageLab(current, labId)) throw outside();
    const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { id: true, isActive: true } });
    if (!lab?.isActive) throw outside();
    if (!Array.isArray(uploads) || !uploads.length || uploads.length > 5) {
        throw failure(400, 'UPLOAD_REQUEST_INVALID', 'Select up to five image files.');
    }
    const prepared = uploads.map(upload => {
        if (!Buffer.isBuffer(upload.buffer) || upload.buffer.length > files.MAX_IMAGE_BYTES) {
            throw failure(413, 'UPLOAD_TOO_LARGE', 'The image exceeds the upload size limit.');
        }
        const type = files.imageType(upload.buffer);
        if (!type) throw failure(415, 'UPLOAD_TYPE_UNSUPPORTED', 'Only JPEG, PNG or WebP image files are accepted.');
        const name = crypto.randomUUID() + type.extension;
        return { upload, name, canonical: '/uploads/intake/' + name, type };
    });
    const root = files.uploadsRoot(), intake = path.join(root, 'intake'), ownership = path.join(root, '.intake-ownership');
    for (const directory of [intake, ownership]) {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        if (fs.lstatSync(directory).isSymbolicLink() || !fs.statSync(directory).isDirectory() ||
            !files.contained(fs.realpathSync(root), fs.realpathSync(directory))) throw unavailable();
    }
    for (const item of prepared) {
        fs.writeFileSync(path.join(intake, item.name), item.upload.buffer, { flag: 'wx', mode: 0o600 });
        fs.writeFileSync(path.join(ownership, item.name + '.json'), JSON.stringify({ v: 1,
            path: item.canonical, labId, uploadedBy: current.id, createdAt: new Date().toISOString() }),
        { flag: 'wx', mode: 0o600 });
    }
    return prepared.map(item => item.canonical);
}

module.exports = { issueUrls, readImage, storePhotos, TTL_SECONDS };
