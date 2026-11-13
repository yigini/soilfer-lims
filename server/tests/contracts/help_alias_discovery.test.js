const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const prisma = require('../../prisma');
const help = require('../../services/helpContentService');
const metadata = require('../../data/help/legacy-aliases.json');
const source = require('../../data/help/content.en.json');
const categories = require('../../data/help/categories.json');
const aliases = new Set(metadata.aliases.map(a => a.id));
const user = { id: 'alias-reader', role: 'LAB_TECHNICIAN', labId: 'DEMO' };
const locales = ['en', 'fr', 'pt', 'es', 'es-419'];
let originalRows;

async function storedHelpRows() {
    return JSON.stringify(await prisma.helpArticle.findMany({ orderBy: { id: 'asc' }, include: {
        revisions: { orderBy: { id: 'asc' }, include: { locales: { orderBy: { id: 'asc' } } } },
        publications: { orderBy: { id: 'asc' } }, feedback: { orderBy: { id: 'asc' } }
    } }));
}

beforeAll(async () => { originalRows = await storedHelpRows(); });
afterAll(async () => {
    try { expect(await storedHelpRows()).toBe(originalRows); }
    finally { await prisma.$disconnect(); }
});

test('only the 17 retained compatibility aliases are in the discovery exclusion set', () => {
    expect(metadata.aliases).toHaveLength(17);
    expect(aliases.size).toBe(17);
    const marked = source.articles.filter(a => /\[Canonical successor: [a-z0-9-]+\]/.test(a.summary));
    expect(new Set(marked.map(a => a.id))).toEqual(aliases);
    for (const { id, successorId } of metadata.aliases) {
        const article = source.articles.find(a => a.id === id);
        expect(article.summary).toContain(`[Canonical successor: ${successorId}]`);
        expect(source.articles.some(a => a.id === successorId)).toBe(true);
        expect(aliases.has(successorId)).toBe(false);
    }
});

test.each(locales)('%s discovery contains the 97 canonical guides with matching topic counts', async locale => {
    const articles = await help.getArticles({ user, locale });
    expect(articles).toHaveLength(97);
    expect(articles.every(a => !aliases.has(a.id))).toBe(true);
    const topics = await help.getTopics(user, locale);
    expect(topics.reduce((n, t) => n + t.articleCount, 0)).toBe(97);
    for (const topic of topics) expect(topic.articleCount).toBe(articles.filter(a => a.category === topic.id).length);
    const preview = await help.getArticles({ user: { role: 'SUPER_ADMIN' }, locale, preview: true });
    expect(preview).toHaveLength(97);
    const search = await help.searchHelp({ user, locale, query: 'start-first-login', limit: 200 });
    expect(search.results.some(a => a.id === 'start-first-login')).toBe(true);
    expect(search.results.every(a => !aliases.has(a.id))).toBe(true);
    const oldIdSearch = await help.searchHelp({ user, locale, query: 'start-shift', limit: 200 });
    expect(oldIdSearch.results.some(a => aliases.has(a.id))).toBe(false);
});

test.each(locales)('%s legacy direct reads and the full offline pack retain every alias', async locale => {
    const pack = await help.getOfflinePack({ user, locale });
    expect(pack.articles).toHaveLength(114);
    for (const { id } of metadata.aliases) {
        expect(pack.articles.some(a => a.id === id)).toBe(true);
        const article = await help.getArticleById(id, user, locale);
        expect(article).not.toBeNull();
        expect(article.id).toBe(id);
        expect(article.steps.length).toBeGreaterThan(0);
    }
});

test('anonymous discovery stays within the existing public visibility boundary', async () => {
    const published = await prisma.helpArticle.findMany({ where: {
        archivedAt: null, visibility: 'PUBLIC', publications: { some: { isCurrent: true } }
    } });
    const expected = published.filter(a => !aliases.has(a.id)).map(a => a.id).sort();
    const actual = await help.getArticles({ user: null, locale: 'en' });
    expect(actual.map(a => a.id).sort()).toEqual(expected);
    expect(await help.getArticleById('bench-drying', null, 'en')).toBeNull();
});

test.each(locales)('%s FAQ discovery excludes aliases without losing canonical problem entries', async locale => {
    const content = require(`../../data/help/content.${locale}.json`);
    const expectedCount = content.articles.filter(a => !aliases.has(a.id)).reduce((n, a) => n + (a.problems?.length || 0), 0);
    const faqs = await help.getFaqs({ locale });
    expect(faqs).toHaveLength(expectedCount);
    expect(faqs.every(f => !aliases.has(f.articleId))).toBe(true);
});

function offlineClient(locale, online = false) {
    const file = path.resolve(__dirname, '../../../client/src/services/helpClientService.js');
    const code = esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'js', format: 'cjs' }).code;
    const pack = require(`../../data/help/content.${locale}.json`);
    const cacheReads = jest.fn(async ({ category } = {}) => pack.articles.filter(a => !category || category === 'all' || a.category === category));
    const purge = jest.fn();
    const storage = {
        getOfflineHelpMeta: async () => ({ categories, lastSync: 'synthetic-prior-release-cache' }),
        getOfflineHelpArticles: cacheReads,
        getOfflineHelpArticle: async id => pack.articles.find(a => a.id === id),
        purgeOfflineHelpArticle: purge
    };
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module, exports: module.exports, navigator: { onLine: online }, console,
        require(name) {
            if (name === 'axios') return { get: async () => { throw { response: { status: 403, data: { error: 'Refused' } } }; } };
            if (name === '../../../server/data/help/legacy-aliases.json') return metadata;
            if (name === './offline/offlineDb') return storage;
            throw Error('Unexpected Help client dependency: ' + name);
        }
    }, { filename: file });
    return { client: module.exports.default, cacheReads, purge };
}

test.each(locales)('%s older offline packs hide aliases in discovery but keep direct access', async locale => {
    const { client, purge } = offlineClient(locale);
    const articles = await client.getArticles({ user, locale });
    expect(articles.articles).toHaveLength(97);
    expect(articles.articles.every(a => !aliases.has(a.id))).toBe(true);
    const topics = await client.getTopics({ user, locale });
    expect(topics.topics.reduce((n, a) => n + a.articleCount, 0)).toBe(97);
    const result = await client.searchHelp({ user, locale, query: 'start-shift' });
    expect(result.results.some(a => aliases.has(a.id))).toBe(false);
    expect(result.total).toBe(0);
    const canonical = await client.searchHelp({ user, locale, query: 'start-first-login' });
    expect(canonical.results.some(a => a.id === 'start-first-login')).toBe(true);
    for (const { id } of metadata.aliases) {
        const direct = await client.getArticleById(id, { user, locale });
        expect(direct.article.id).toBe(id);
    }
    expect(purge).not.toHaveBeenCalled();
});

test('server access refusals remain authoritative for cached alias access and discovery', async () => {
    const { client, cacheReads } = offlineClient('en', true);
    expect((await client.getArticles({ user })).articles).toEqual([]);
    expect((await client.getTopics({ user })).topics).toEqual([]);
    expect((await client.searchHelp({ user, query: 'start-shift' })).results).toEqual([]);
    const article = await client.getArticleById('start-shift', { user });
    expect(article.article).toBeNull();
    expect(article.forbidden).toBe(true);
    expect(cacheReads).not.toHaveBeenCalled();
});
