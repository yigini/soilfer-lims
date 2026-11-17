const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const book = path.join(root, 'docs/book/src');
const target = path.join(book, 'start/screen-tour.md');
const locales = ['en', 'es', 'es-419', 'fr', 'pt'];
const translations = Object.fromEntries(locales.map(locale => [locale,
    JSON.parse(fs.readFileSync(path.join(root, 'client/src/translations', locale + '.json'), 'utf8'))]));
const value = (locale, key) => key.split('.').reduce((object, part) => object?.[part], translations[locale]);
const begin = '<!-- BEGIN GENERATED MENU NAMES -->';
const end = '<!-- END GENERATED MENU NAMES -->';
const navigation = fs.readFileSync(path.join(root, 'client/src/navigationConfig.js'), 'utf8');
const navigationKeys = [...new Set([...navigation.matchAll(/\bt\(\s*['"]((?:nav|policies)\.[^'"]+)['"]/g)].map(match => match[1]))];
const menuKeys = [...navigationKeys, 'nav.expandSidebar', 'nav.collapseSidebar'];
const queueKeys = Object.keys(translations.en.queue).filter(key => key.startsWith('tab')).map(key => 'queue.' + key);
const cell = text => String(text).replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
function table(keys) {
    return ['| English | Español | Español (América Latina) | Français | Português |',
        '| :--- | :--- | :--- | :--- | :--- |',
        ...keys.map(key => '| ' + locales.map(locale => {
            const text = value(locale, key);
            if (typeof text !== 'string' || !text.trim()) throw Error(`Missing menu translation: ${locale}/${key}`);
            return cell(text);
        }).join(' | ') + ' |')].join('\n');
}
function generatedBlock() {
    return `${begin}\n### Left menu and sidebar controls\n\n${table(menuKeys)}\n\n### Manager Task List tabs\n\n${table(queueKeys)}\n${end}`;
}
// Policies is a real sidebar item sourced from policies.title rather than nav.*.
const validLabels = new Set([...Object.values(translations.en.nav), translations.en.policies.title]);
function checkSidebarNames(document, filename) {
    const errors = [];
    document.split(/\r?\n/).forEach((line, index) => {
        for (const match of line.matchAll(/\b(?:in|from|on)\s+(?:the\s+)?left (?:menu|sidebar|navigation(?: menu| bar)?)\b/gi)) {
            let clause = line.slice(0, match.index).split(/(?:[.!?]\s+|→)/).at(-1);
            const verb = [...clause.matchAll(/\b(?:click|open|see|select|choose)\b/gi)].at(-1);
            if (verb) clause = clause.slice(verb.index);
            for (const bold of clause.matchAll(/\*\*([^*]+)\*\*/g)) {
                if (!validLabels.has(bold[1])) errors.push(`${filename}:${index + 1}: "${bold[1]}" is not a current English sidebar label.`);
            }
        }
    });
    return errors;
}
function checkTable(document) {
    const start = document.indexOf(begin), finish = document.indexOf(end);
    if (start < 0 || finish < start || document.slice(start, finish + end.length) !== generatedBlock()) {
        return ['Menu translation table is stale. Run node tools/docs/generate_menu_names.cjs.'];
    }
    return [];
}
function documents(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
        ? documents(path.join(directory, entry.name)) : entry.isFile() && entry.name.endsWith('.md') ? [path.join(directory, entry.name)] : []);
}
if (require.main === module) {
    try {
        let document = fs.readFileSync(target, 'utf8');
        if (!process.argv.includes('--check')) {
            const start = document.indexOf(begin), finish = document.indexOf(end);
            if (start < 0 || finish < start) throw Error('The menu table markers are missing.');
            document = document.slice(0, start) + generatedBlock() + document.slice(finish + end.length);
            fs.writeFileSync(target, document, 'utf8');
        }
        const errors = [...checkTable(document), ...documents(book).flatMap(file => checkSidebarNames(fs.readFileSync(file, 'utf8'), path.relative(root, file)))];
        if (errors.length) throw Error(errors.join('\n'));
        console.log('Manual menu labels and five-language table are current.');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { checkSidebarNames, checkTable, generatedBlock };
