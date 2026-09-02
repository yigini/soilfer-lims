const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../prisma/dev.db'));

const defaultBranding = {
    title: 'SoilFER LIMS',
    tagline: 'Global & Local Laboratory Information Management System',
    organization: 'FAO Global Soil Partnership / SoilFER Programme',
    colors: {
        primary: '#047857',
        secondary: '#111827',
        accent: '#D97706'
    },
    logoUrl: '/assets/img/soilfer-logo.png',
    contactEmail: 'GLOSOLAN@fao.org',
    defaultLanguage: 'en',
    dateFormat: 'YYYY-MM-DD',
    footerText: 'SoilFER-LIMS · Aligned with FAO Global Soil Partnership & GLOSOLAN'
};

const stmt = db.prepare(`
    INSERT INTO SystemSetting (id, branding)
    VALUES ('global', ?)
    ON CONFLICT(id) DO UPDATE SET branding = excluded.branding
`);

stmt.run(JSON.stringify(defaultBranding));
console.log('Successfully updated global SystemSetting branding to official SoilFER logo and styling!');
