const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const help = require('../../services/helpContentService');
const prisma = require('../../prisma');

const locales = ['en', 'fr', 'pt', 'es', 'es-419'];
const newIds = ['start-messages', 'quality-qc-failed', 'quality-pilot-help',
    'assets-technician-events', 'assets-prepared-lots', 'assets-inventory-import', 'assets-equipment-import'];
const user = { id: 'help-batch2-reader', role: 'LAB_TECHNICIAN', labId: 'DEMO' };
const dataDir = path.resolve(__dirname, '../../data/help');
const registry = locale => JSON.parse(fs.readFileSync(path.join(dataDir, `content.${locale}.json`), 'utf8'));
const inheritedKeywordHashes = {
    "en": "515ed32ca4573d608418b9e7ec02267cba407b8ad5ba574b73c366a52e2c91df",
    "fr": "515ed32ca4573d608418b9e7ec02267cba407b8ad5ba574b73c366a52e2c91df",
    "pt": "515ed32ca4573d608418b9e7ec02267cba407b8ad5ba574b73c366a52e2c91df",
    "es": "515ed32ca4573d608418b9e7ec02267cba407b8ad5ba574b73c366a52e2c91df",
    "es-419": "515ed32ca4573d608418b9e7ec02267cba407b8ad5ba574b73c366a52e2c91df"
};
const contextual = {
    '/profile': ['start-messages'],
    '/qa': ['quality-qc-failed'],
    '/workbench': ['quality-qc-failed', 'assets-technician-events', 'assets-prepared-lots'],
    '/my-work': ['quality-qc-failed'],
    '/manager-queue': ['quality-qc-failed'],
    '/help': ['quality-pilot-help'],
    '/inventory': ['assets-prepared-lots', 'assets-inventory-import'],
    '/equipment': ['assets-technician-events', 'assets-equipment-import']
};

afterAll(async () => { await prisma.$disconnect(); });

test.each(locales)('%s new guides are published, readable and searchable without English fallback', async locale => {
    const source = registry(locale);
    expect(source.articles).toHaveLength(121);
    expect(new Set(source.articles.map(a => a.id)).size).toBe(121);
    for (const id of newIds) {
        const authored = source.articles.find(a => a.id === id);
        expect(authored).toBeDefined();
        expect(authored.steps.length).toBeGreaterThanOrEqual(3);
        const served = await help.getArticleById(id, user, locale);
        expect(served).not.toBeNull();
        expect(served.isFallback).toBe(false);
        expect(served.localeNotice).toBeNull();
        expect(served.title).toBe(authored.title);
        expect(served.summary).toBe(authored.summary);
        expect(served.steps).toEqual(authored.steps);
        expect(JSON.stringify(served)).not.toMatch(/\{(?:compose|send|draft|messaging|preview|commit|template)\}/);
        const search = await help.searchHelp({ user, locale, query: id, limit: 200 });
        expect(search.results.some(a => a.id === id)).toBe(true);
    }
});

test.each(locales)('%s normal context recommendations include the new guides on actual screens', async locale => {
    for (const [route, ids] of Object.entries(contextual)) {
        const context = await help.getContextHelp({ route, user, locale });
        expect(context.availability).toBe('AVAILABLE');
        for (const id of ids) {
            const article = context.articles.find(a => a.id === id);
            expect(article).toBeDefined();
            expect(article.isFallback).toBe(false);
        }
    }
});

test('the new operational guides do not expand anonymous visibility', async () => {
    for (const id of newIds) {
        const stored = await prisma.helpArticle.findUnique({ where: { id } });
        expect(stored.visibility).toBe('AUTHENTICATED');
        expect(await help.getArticleById(id, null, 'en')).toBeNull();
    }
    const publicIds = (await help.getArticles({ user: null, locale: 'en' })).map(a => a.id);
    expect(newIds.every(id => !publicIds.includes(id))).toBe(true);
});

test.each(locales)('%s retains inherited IDs and original search keywords', locale => {
    const inherited = registry(locale).articles.filter(a => !newIds.includes(a.id))
        .map(({ id, keywords }) => ({ id, keywords })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    expect(inherited).toHaveLength(114);
    const hash = crypto.createHash('sha256').update(JSON.stringify(inherited)).digest('hex');
    expect(hash).toBe(inheritedKeywordHashes[locale]);
});

test.each(locales)('%s manager quick guidance stays short while the first-day detail remains', locale => {
    const manager = registry(locale).articles.find(a => a.id === 'start-manager');
    expect(manager.quick.length).toBeLessThan(320);
    expect(manager.before.length).toBeGreaterThan(0);
    expect(manager.sections.flatMap(s => s.steps).length).toBeGreaterThanOrEqual(3);
});

function strings(value) {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(strings);
    if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
    return [];
}

test('Portuguese prose uses Bancada de trabalho with feminine grammar and translated steps', () => {
    const fields = ['title', 'summary', 'quick', 'before', 'sections', 'fields', 'example',
        'success', 'nextActor', 'problems', 'steps', 'caution'];
    const prose = registry('pt').articles.flatMap(a => fields.flatMap(k => strings(a[k]))).join('\n');
    expect(prose).not.toMatch(/(?<![\/\w-])workbench(?![\w-])/i);
    expect(prose).not.toMatch(/\b(?:o|no|do|ao|pelo|seu) Bancada de trabalho/i);
    expect(prose).not.toMatch(/Bancada de trabalho est[áa] bloqueado/i);
    expect(prose).not.toContain('(Expected:');
    expect(prose).not.toContain('The technician');
    expect(prose).not.toContain('Select Confirm Complete');
    expect(prose).toContain('na Bancada de trabalho');
    expect(prose).toContain('da Bancada de trabalho');
});

test('the release manifest binds every new guide to all five source translations and route links', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'RELEASE_MANIFEST_v1.json'), 'utf8'));
    expect(manifest.releaseVersion).toBe('v1.5.0');
    expect(manifest.totalArticles).toBe(121);
    for (const id of newIds) {
        const entry = manifest.articles.find(a => a.id === id);
        expect(entry.approvedLocales.slice().sort()).toEqual(locales.slice().sort());
        for (const locale of locales) {
            const a = registry(locale).articles.find(a => a.id === id);
            const payload = { title: a.title, summary: a.summary, steps: a.steps,
                success: a.success, caution: a.caution };
            expect(entry.localeHashes[locale]).toBe(crypto.createHash('sha256')
                .update(JSON.stringify(payload)).digest('hex'));
        }
        expect(entry.mappedRoutes.slice().sort()).toEqual(Object.entries(contextual)
            .filter(([, ids]) => ids.includes(id)).map(([route]) => route).sort());
    }
});

// Inherited alias prose must be translated too; machine IDs and example measurements are retained.
test('Portuguese long-form prose does not silently reuse the English paragraphs', () => {
    const english = new Set(registry('en').articles.flatMap(a =>
        ['title', 'summary', 'quick', 'before', 'sections', 'fields', 'example', 'success',
            'nextActor', 'problems', 'caution'].flatMap(k => strings(a[k]))));
    const portuguese = registry('pt').articles.flatMap(a =>
        ['title', 'summary', 'quick', 'before', 'sections', 'fields', 'example', 'success',
            'nextActor', 'problems', 'caution'].flatMap(k => strings(a[k])));
    for (const text of portuguese.filter(t => t.length > 40 && !t.startsWith('DEMO-'))) {
        expect(english.has(text)).toBe(false);
    }
});
