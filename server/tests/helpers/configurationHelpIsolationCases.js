const cases = [];
function add(key, path, body, query, globalReason) { cases.push({ key, path, ...(body && { body }), ...(query && { query }), ...(globalReason && { globalReason }) }); }
for (const kind of ['analyses', 'groups', 'methodologies', 'categories']) add(`GET /api/config/${kind}`, `/api/config/${kind}`, null, { labId: '{labA}' });
for (const kind of ['gates', 'units', 'references']) add(`GET /api/config/${kind}`, `/api/config/${kind}`, null, null,
    'Global controlled catalogue metadata, shared across laboratories and containing no private facility records.');
add('GET /api/config/analyses/:code/usage', '/api/config/analyses/{analysisA}/usage');
add('POST /api/config/analyses', '/api/config/analyses', { code: 'R2_NEW_PARAMETER_336', name: 'Synthetic parameter', units: 'g', labId: '{labA}' });
add('PUT /api/config/analyses/:code', '/api/config/analyses/{analysisA}', { name: 'Synthetic changed parameter' });
add('DELETE /api/config/analyses/:code', '/api/config/analyses/{analysisA}', {});
add('POST /api/config/groups', '/api/config/groups', { id: 'R2-NEW-GROUP-336', name: 'Synthetic group', analyses: ['PH_H2O'], labId: '{labA}' });
add('PUT /api/config/groups/:id', '/api/config/groups/{groupA}', { name: 'Synthetic changed group', analyses: ['PH_H2O'] });
add('DELETE /api/config/groups/:id', '/api/config/groups/{groupA}', {});
add('POST /api/config/methodologies', '/api/config/methodologies', { name: 'Synthetic method', analysisCode: 'PH_H2O', labId: '{labA}' });
add('PUT /api/config/methodologies/:id', '/api/config/methodologies/{methodA}', { name: 'Synthetic changed method' });
add('DELETE /api/config/methodologies/:id', '/api/config/methodologies/{methodA}', {});
add('POST /api/config/categories', '/api/config/categories', { id: 'R2-NEW-CATEGORY-336', name: 'Synthetic category', labId: '{labA}' });
add('PUT /api/config/categories/:id', '/api/config/categories/{categoryA}', { name: 'Synthetic changed category' });
add('DELETE /api/config/categories/:id', '/api/config/categories/{categoryA}', {});
add('GET /api/config/lab-defaults/:labId', '/api/config/lab-defaults/{labA}');
add('PUT /api/config/lab-defaults/:labId', '/api/config/lab-defaults/{labA}', { defaults: [{ analysisCode: 'PH_H2O', methodologyId: '{methodA}' }] });

for (const key of ['GET /', 'GET /api/health', 'GET /api/version', 'GET /api/public/branding', 'GET /api/public/i18n/bootstrap',
    'GET /api/appearance/public', 'GET /api/appearance/catalog', 'GET /api/appearance/context']) {
    add(key, key.slice(4), null, null, 'Public application metadata or current-principal appearance context; no caller-selected private laboratory data.');
}
add('GET /api/admin/ping', '/api/admin/ping', null, null, 'Authenticated platform liveness response.');
add('GET /api/admin/system-logs', '/api/admin/system-logs', null, { labId: '{labA}' });
add('GET /api/admin/settings', '/api/admin/settings', null, null, 'Current laboratory branding with global fallback, selected from the authenticated principal.');
add('PUT /api/admin/settings/branding', '/api/admin/settings/branding', { title: 'Synthetic branding' });
add('GET /api/admin/languages', '/api/admin/languages', null, null, 'Global application locale names, not private laboratory records.');
add('POST /api/admin/languages', '/api/admin/languages', { code: 'zz', name: 'Synthetic locale', nativeName: 'Synthetic' });
add('PUT /api/admin/languages/:code', '/api/admin/languages/en', { name: 'Synthetic English' });
add('DELETE /api/admin/languages/:code', '/api/admin/languages/en', {});
add('PUT /api/admin/languages/:code/default', '/api/admin/languages/en/default', {});
add('GET /api/admin/languages/:code/catalog', '/api/admin/languages/en/catalog');
cases.push({ key: 'GET /api/admin/languages/:code/catalog', path: '/api/admin/languages/en/catalog',
    query: { labId: '{labA}' }, variant: 'foreign lab translation override', mustDeny: true });
add('GET /api/admin/appearance', '/api/admin/appearance');
add('PATCH /api/admin/appearance', '/api/admin/appearance', { themeId: 'soilfer', defaultMode: 'light', expectedRevision: 0 });

const help = 'Published help content is a shared catalogue; private lab-note fixtures must remain scoped to the current laboratory.';
for (const kind of ['topics', 'articles', 'faqs', 'context', 'pack', 'support-config']) add(`GET /api/help/${kind}`, `/api/help/${kind}`, null, { labId: '{labA}' }, help);
add('GET /api/help/articles/:articleId', '/api/help/articles/{helpArticle}', null, { labId: '{labA}' }, help);
add('GET /api/help/search', '/api/help/search', null, { q: 'sample', labId: '{labA}' }, help);
add('POST /api/help/feedback', '/api/help/feedback', { articleId: '{helpArticle}', locale: 'en', useful: true, comment: 'Synthetic feedback' }, null,
    'Feedback on a shared published guide belongs to the submitting principal; it changes no private labA note.');
add('GET /api/help/admin/articles', '/api/help/admin/articles', null, { labId: '{labA}' });
add('GET /api/help/admin/articles/:articleId/revisions/:revisionNumber', '/api/help/admin/articles/{helpArticle}/revisions/{helpRevision}');
add('POST /api/help/admin/articles/:articleId/revisions', '/api/help/admin/articles/{helpArticle}/revisions', { baseRevisionNumber: '{helpRevision}' });
add('PUT /api/help/admin/articles/:articleId/revisions/:revisionNumber/locales/:locale', '/api/help/admin/articles/{helpArticle}/revisions/{helpRevision}/locales/en', { title: 'Synthetic title', summary: 'Synthetic summary', steps: [] });
add('POST /api/help/admin/articles/:articleId/request-review', '/api/help/admin/articles/{helpArticle}/request-review', { revisionNumber: '{helpRevision}', locales: ['en'] });
add('POST /api/help/admin/articles/:articleId/approve', '/api/help/admin/articles/{helpArticle}/approve', { revisionNumber: '{helpRevision}', locale: 'en' });
add('POST /api/help/admin/articles/:articleId/publish', '/api/help/admin/articles/{helpArticle}/publish', { revisionNumber: '{helpRevision}', approvedLocales: ['en'] });
add('POST /api/help/admin/batch-publish', '/api/help/admin/batch-publish', { releases: [{ articleId: '{helpArticle}', revisionNumber: '{helpRevision}' }], dryRun: true });
add('GET /api/help/admin/release-preview', '/api/help/admin/release-preview');
add('PUT /api/help/admin/articles/:articleId/lab-note', '/api/help/admin/articles/{helpArticle}/lab-note', { labId: '{labA}', noteText: 'Synthetic current-lab note', action: 'save_draft' });
module.exports = cases;
