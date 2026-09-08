const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const base = __dirname;
const read = n => fs.readFileSync(path.join(base, n), 'utf8');
const json = n => JSON.parse(read(n));
const checks = [];
function check(name, pass, detail) {
  checks.push({ name, pass: Boolean(pass), ...(detail ? { detail } : {}) });
}
const locales = ['en', 'es', 'es-419', 'fr', 'pt'];
const sameLocales = values => [...values].sort().join('|') === [...locales].sort().join('|');
const files = fs.readdirSync(base).filter(n => fs.statSync(path.join(base, n)).isFile());
const dataFiles = files.filter(n => n.endsWith('.json') && !['package-validation.json', 'HANDOFF_MANIFEST.json'].includes(n));
for (const n of dataFiles) {
  try { json(n); check(`JSON parses: ${n}`, true); }
  catch (error) { check(`JSON parses: ${n}`, false, error.message); }
}
const summary = json('audit-summary.json');
const source = json('source-text-inventory.json');
const matrix = json('catalogue-translation-review-matrix.json');
const glossary = json('scientific-glossary-draft.json');
const packs = json('locale-pack-audit.json');
const live = json('live-bootstrap-audit.json');
check('Source inventory counts match audit summary',
  source.occurrences.length === summary.candidates &&
  source.sourceFiles.length === summary.sourceFiles &&
  source.byFile.length === summary.candidateFiles &&
  source.routes.length === summary.routes && source.parseErrors.length === 0);
check('Local and live inventories contain exactly the five configured locales',
  sameLocales(packs.stats.map(x => x.locale)) && sameLocales(live.languages.map(x => x.code)));
check('Catalogue matrix contains all counted fields',
  matrix.rows.length === 1296 && matrix.rows.length === matrix.counts.translatableFields &&
  matrix.counts.analyses === summary.catalogue.analyses &&
  matrix.counts.methodologies === summary.catalogue.methods &&
  matrix.counts.categories === summary.catalogue.categories);
check('Catalogue translations are explicitly unreviewed; no fabricated target translations',
  matrix.rows.every(r => sameLocales(Object.keys(r.translations)) &&
    r.reviewStatus === 'not_reviewed' && ['es', 'es-419', 'fr', 'pt'].every(l => r.translations[l] === null)));
const identities = matrix.rows.map(r => `${r.entityKind}|${r.entityId}|${r.field}`);
check('Catalogue row identities are unique within the seed review matrix', new Set(identities).size === identities.length);
check('Glossary has 30 unique concepts and five nonempty locale proposals per concept',
  glossary.entries.length === 30 && new Set(glossary.entries.map(r => r.concept)).size === 30 &&
  glossary.entries.every(r => sameLocales(Object.keys(r.translations)) && Object.values(r.translations).every(v => typeof v === 'string' && v.trim())));
check('Glossary never claims scientific approval', glossary.entries.every(r =>
  r.status === 'draft_requires_scientific_and_locale_review' && r.reviewer === null && r.sources.length > 0));
check('Route register contains every audited route, all pending runtime verification',
  source.routes.every(r => read('ROUTE_COVERAGE_REGISTER.md').includes(`| \`${r}\` | Pending | Pending | Pending | Pending | Pending |`)));
const required = ['README.md', 'IMPLEMENTATION_PLAN.md', 'AUDIT_FINDINGS.md', 'SCIENTIFIC_TERMINOLOGY.md',
  'COVERAGE_AND_ACCEPTANCE.md', 'ANTIGRAVITY_PROMPT.md', 'API_CONTRACTS.md', 'live-ui-spot-check.json'];
check('Required handoff documents exist and are nonempty', required.every(n => files.includes(n) && read(n).trim().length > 100));
const badLinks = [];
for (const n of files.filter(n => n.endsWith('.md'))) {
  for (const m of read(n).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = m[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(https?:|mailto:)/i.test(target)) continue;
    if (!fs.existsSync(path.resolve(base, target))) badLinks.push({ file: n, target });
  }
}
check('Local Markdown links resolve', badLinks.length === 0, badLinks.length ? badLinks : undefined);
const result = {
  verifiedAt: new Date().toISOString(),
  scope: 'Package structure, evidence consistency and explicit draft status only. This does not certify translations or execute application workflow, RBAC, report, or deployment tests.',
  baselineRevision: summary.revision,
  passed: checks.every(c => c.pass), checks
};
fs.writeFileSync(path.join(base, 'package-validation.json'), JSON.stringify(result, null, 2) + '\n');
const manifestFiles = fs.readdirSync(base).filter(n => n !== 'HANDOFF_MANIFEST.json' && fs.statSync(path.join(base, n)).isFile()).sort();
const manifest = {
  generatedAt: new Date().toISOString(),
  note: 'Integrity manifest of this planning package, excluding this manifest itself. Re-run validate-package.cjs after editing package files. No application implementation or deployment is implied.',
  baselineRevision: summary.revision,
  files: manifestFiles.map(n => {
    const bytes = fs.readFileSync(path.join(base, n));
    return { file: n, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  })
};
fs.writeFileSync(path.join(base, 'HANDOFF_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, checks: checks.length, files: manifestFiles.length, failures: checks.filter(c => !c.pass) }));
if (!result.passed) process.exitCode = 1;
