const prisma = require('./prisma');

async function seedLanguages() {
    console.log('🌱 Seeding Languages...');

    const languages = [
        { code: 'en', name: 'English', isDefault: true, translations: '{}' },
        { code: 'es', name: 'Español', isDefault: false, translations: '{}' },
        { code: 'es-419', name: 'Español (Latinoamérica)', isDefault: false, translations: '{}' },
        { code: 'fr', name: 'Français', isDefault: false, translations: '{}' },
        { code: 'pt', name: 'Português', isDefault: false, translations: '{}' }
    ];

    for (const lang of languages) {
        await prisma.language.upsert({
            where: { code: lang.code },
            update: {
                name: lang.name,
                isDefault: lang.isDefault
            },
            create: {
                code: lang.code,
                name: lang.name,
                isDefault: lang.isDefault,
                translations: lang.translations
            }
        });
        console.log(`  ✓ Processed language: ${lang.name} (${lang.code})`);
    }

    console.log('✅ Language seeding complete.\n');
}

seedLanguages()
    .catch(e => {
        console.error('❌ Language seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
