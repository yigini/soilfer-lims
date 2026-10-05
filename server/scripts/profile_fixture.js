'use strict';

// Deliberately unavailable to production or the ordinary developer database.
const fs = require('fs');
const path = require('path');
const os = require('os');
const identity = require('../services/profileIdentityService');
const { createSample } = require('../services/sampleStateService');
const MARKER = 'issue140-two-layer-v1';
const ROOT = 'PROFILE-FIXTURE-140';

function assertFixtureEnvironment(env = process.env) {
    if (!['test', 'staging'].includes(env.NODE_ENV) || env.LIMS_PROFILE_FIXTURE_ENV !== MARKER) {
        throw new Error('Fixture requires an explicitly named isolated test/staging environment.');
    }
    if (!env.DATABASE_PATH || !fs.existsSync(env.DATABASE_PATH)) throw new Error('Fixture database must exist.');
    const file = fs.realpathSync(env.DATABASE_PATH);
    const testRoot = path.resolve(__dirname, '../tests/.tmp');
    const stagingRoot = path.join(os.tmpdir(), MARKER);
    const inside = root => {
        const relative = path.relative(root, file);
        return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    };
    if (!(env.NODE_ENV === 'test' && inside(testRoot)) && !inside(stagingRoot)) {
        throw new Error('Fixture refuses this database path; use a disposable fixture database.');
    }
    return file;
}

async function loadFixture(db, env = process.env) {
    const databasePath = assertFixtureEnvironment(env);
    if (await db.sample.count() > 1000) throw new Error('Fixture refuses a populated laboratory database.');
    const manifest = {marker: MARKER, databasePath, labId: ROOT + '-LAB', projectId: ROOT + '-PROJECT', configId: ROOT + '-CONFIG', sampleIds: ['A', 'B', 'DECIMAL', 'OTHER', 'UNKNOWN'].map(suffix => ROOT + '-' + suffix)};
    const previous = await db.sample.findMany({where: {id: {in: manifest.sampleIds}}});
    if (previous.length) {
        if (previous.length !== manifest.sampleIds.length || previous.some(row => JSON.parse(row.metadata || '{}').fixtureMarker !== MARKER)) throw new Error('Fixture ID collision or partial fixture; no records changed.');
        return {...manifest, reused: true};
    }
    for (const [model, id] of [['lab', manifest.labId], ['project', manifest.projectId], ['koboConfig', manifest.configId]]) {
        if (await db[model].findUnique({where: {id}})) throw new Error('Fixture setup ID collision; no records changed.');
    }
    const records = [{suffix: 'A', top: 0, bottom: 20}, {suffix: 'B', top: 20, bottom: 50}, {suffix: 'DECIMAL', top: 0, bottom: 20.5}, {suffix: 'OTHER', top: 0, bottom: 20, namespace: 'DEMO-SURVEY-OTHER'}, {suffix: 'UNKNOWN', top: null, bottom: null}];
    await db.$transaction(async tx => {
        await tx.lab.create({data: {id: manifest.labId, code: 'DEMO140', name: 'Isolated profile demonstration', country: 'GTM'}});
        await tx.project.create({data: {id: manifest.projectId, code: manifest.projectId, name: 'Synthetic soil profile demonstration', labId: manifest.labId, status: 'ACTIVE'}});
        await tx.koboConfig.create({data: {id: manifest.configId, labId: manifest.labId, projectCode: manifest.projectId, formId: 'synthetic-not-a-kobo-asset', apiToken: 'unused-fixture-token', fieldMapping: JSON.stringify({profileReference: {namespace: 'DEMO-SURVEY-2026', relation: 'CONFIRMED_PROFILE'}})}});
        for (const row of records) {
            const reference = identity.captureReference({profileReference: {code: row.suffix === 'UNKNOWN' ? null : 'PIT-DEMO-01', relation: row.suffix === 'UNKNOWN' ? 'UNSPECIFIED' : 'CONFIRMED_PROFILE'}}, {sample: {}, authorizedNamespace: row.namespace || 'DEMO-SURVEY-2026', actor: 'fixture-loader', source: 'SYNTHETIC_FIXTURE', sourceRecordId: row.suffix});
            await createSample({id: ROOT + '-' + row.suffix, originalId: 'DEMO-BAG-' + row.suffix, assignedLab: manifest.labId, projectId: manifest.projectId, projectCode: manifest.projectId, country: 'GTM', matrix: 'SOIL', status: 'EXPECTED', depthTopCm: row.top, depthBottomCm: row.bottom, latitude: null, longitude: null, fieldMetadata: JSON.stringify({profileReference: reference, site_id: 'DEMO-SITE-INDEPENDENT', collectionDate: '2026-10-01'}), metadata: JSON.stringify({fixtureMarker: MARKER})}, 'system:profile-fixture', { tx });
        }
    });
    return {...manifest, reused: false};
}

// This manifest is a cleanup boundary, never a request to remove all lab records.
module.exports = {assertFixtureEnvironment, loadFixture, MARKER};

if (require.main === module) {
    try {assertFixtureEnvironment();} catch (error) {process.stderr.write(error.message + '\n'); process.exit(1);}
    const db = require('../prisma');
    loadFixture(db).then(manifest => process.stdout.write(JSON.stringify(manifest, null, 2) + '\n')).catch(error => {process.stderr.write(error.message + '\n'); process.exitCode = 1;}).finally(() => db.$disconnect());
}
