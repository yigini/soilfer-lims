const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { createRootClient } = require('../../utils/prismaClientIdentity');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const catalogue = require('../../seeds/data/catalogue.json');
const packages = require('../../seeds/data/soil_packages.json');
const cataloguePolicy = require('../../services/cataloguePolicy');
const methodResolution = require('../../services/methodResolution');

const directory = path.resolve(__dirname, '../.tmp');
let file, client, seedCatalogue;
beforeAll(() => {
    fs.mkdirSync(directory, { recursive: true }); file = path.join(directory, 'issue424d_seed_' + randomUUID() + '.db');
    beforeGuards({ actor: 'system:fixture', file, qcBootstrap: 'CREATE_PRISMA' });
    const db = new Database(file);
    try {
        db.pragma('foreign_keys=ON');
        for (const code of new Set(catalogue.analyses.map(row => row.unitCode).filter(Boolean))) db.prepare('INSERT INTO Unit(code,display,quantityKind,updatedAt) VALUES(?,?,?,?)').run(code, code, 'FIXTURE', '2026-01-01');
        for (const id of new Set(catalogue.methodologies.map(row => row.referenceId).filter(Boolean))) db.prepare('INSERT INTO MethodReference(id,authority,citation,title,updatedAt) VALUES(?,?,?,?,?)').run(id, 'Fixture', id, id, '2026-01-01');
    } finally { db.close(); }
    client = createRootClient({ adapter: new PrismaBetterSqlite3({ url: 'file:' + file }) });
    jest.isolateModules(() => {
        jest.doMock('../../prisma', () => client);
        seedCatalogue = require('../../seeds/catalogue').seedCatalogue;
    });
    jest.dontMock('../../prisma');
}, 60000);
afterAll(async () => {
    await client?.$disconnect();
    if (!file || path.dirname(file) !== directory || !path.basename(file).startsWith('issue424d_seed_')) throw Error('Unexpected owned fixture path');
    for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(file + suffix, { force: true });
});
test('a genuinely empty catalogue seeds the pinned packages and selectable canonical methods', async () => {
    expect(await client.analysis.count()).toBe(0);
    expect(await seedCatalogue()).toMatchObject({ isCleanDb: true, changesApplied: true });
    const groups = await client.analysisGroup.findMany({ orderBy: { id: 'asc' } });
    expect(groups).toHaveLength(5);
    for (const expected of packages) {
        expect(groups.find(row => row.id === expected.id)).toMatchObject({ labId: null, analyses: JSON.stringify(expected.analyses) });
        expect((await cataloguePolicy.validateSelection(expected.analyses, { db: client })).valid).toBe(true);
        expect([...(await methodResolution.resolveDefaultSelections(expected.analyses, null, client)).values()].every(row => row.method && !row.error)).toBe(true);
        expect(new Set(expected.analyses).size).toBe(expected.analyses.length);
        expect(expected.analyses.some(code => ['extractableElements', 'porosity', 'gypsum', 'solubleSalts', 'WATER_TDS'].includes(code))).toBe(false);
    }
    expect(await client.analysis.findUnique({ where: { code: 'extractableElements' } })).toMatchObject({ status: 'inactive' });
    expect(await client.analysis.findUnique({ where: { code: 'GYPSUM' } })).toMatchObject({ units: '%', unitCode: '%' });
    expect(await client.methodology.findUnique({ where: { id: 'USDA_HB60_GYPSUM' } })).toMatchObject({ analysisCode: 'GYPSUM', name: 'Acetone precipitation + electrical conductivity' });
});
test('existing and lab-owned packages survive normal, confirmed and force-clean catalogue seeding', async () => {
    await client.analysisGroup.update({ where: { id: 'BASIC_FERTILITY' }, data: { name: 'Locally curated global package', analyses: '["P_OLSEN"]' } });
    await client.analysisGroup.create({ data: { id: 'lab-copy', name: 'Basic Fertility', labId: 'fixture-lab', analyses: '["PH_H2O"]' } });
    const before = await client.analysisGroup.findMany({ orderBy: { id: 'asc' } });
    for (const options of [{}, { confirmMatches: true }, { forceClean: true }]) {
        await seedCatalogue(options);
        expect(await client.analysisGroup.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    }
});
test('regenerating the catalogue keeps the Step D definitions aligned without changing identifiers or SAR', () => {
    const filename = path.resolve(__dirname, '../../seeds/generate_catalogue_data.js');
    const localRequire = createRequire(filename); let generated;
    const fakeFs = { ...fs, writeFileSync(target, bytes) {
        expect(path.resolve(target)).toBe(path.resolve(__dirname, '../../seeds/data/catalogue.json'));
        generated = JSON.parse(bytes);
    } };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        require: name => name === 'fs' ? fakeFs : localRequire(name), __dirname: path.dirname(filename),
        console: { log() {}, warn() {} }
    }, { filename });
    // Imported legacy rows are supplied only when the optional offline GloSIS
    // catalogue is available; the canonical definitions never depend on it.
    for (const code of ['GYPSUM', 'POROSITY', 'SAR', 'SOIL_MOISTURE', 'baseSaturation']) {
        expect(generated.analyses.find(row => row.code === code)).toEqual(catalogue.analyses.find(row => row.code === code));
    }
    for (const id of ['POROSITY_CALC', 'USDA_HB60_GYPSUM', 'SAR_CALC']) expect(generated.methodologies.find(row => row.id === id)).toEqual(catalogue.methodologies.find(row => row.id === id));
    const offlinePath = path.resolve(path.dirname(filename), '../config/glosis_catalog.json');
    const offlineFs = { ...fakeFs, existsSync: target => path.resolve(target) === offlinePath || fs.existsSync(target) };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        require: name => name === 'fs' ? offlineFs : name === offlinePath
            ? { procedures: [{ attribute: 'extractableElements', instance: 'fixture-extractable', label: 'Fixture extractable method' }] }
            : localRequire(name),
        __dirname: path.dirname(filename), console: { log() {}, warn() {} }
    }, { filename });
    expect(generated.analyses.find(row => row.code === 'extractableElements')).toMatchObject({ status: 'inactive', units: 'mg/kg' });
});
