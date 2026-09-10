const fs = require('fs');
const path = require('path');

const wpUiCopy = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../WP/help-knowledge-base-v1/ui-copy.json'), 'utf8'));
const locales = ['en', 'es', 'es-419', 'fr', 'pt'];
const transDir = path.resolve(__dirname, '../src/translations');

for (const loc of locales) {
    const filePath = path.join(transDir, `${loc}.json`);
    const trans = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Inject help namespace
    trans.help = wpUiCopy[loc];

    fs.writeFileSync(filePath, JSON.stringify(trans, null, 2) + '\n', 'utf8');
    console.log(`[I18N] Injected help translations into ${loc}.json`);
}
