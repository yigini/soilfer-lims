const axios = require('axios');

async function verify() {
    try {
        console.log('Testing /api/public/i18n/bootstrap...');
        const res = await axios.get('http://localhost:3000/api/public/i18n/bootstrap');

        const data = res.data;
        if (!data) throw new Error('No data returned');

        console.log('Main structure keys:', Object.keys(data));

        // 1. Check Languages
        const codes = data.languages.map(l => l.code);
        console.log('Available languages:', codes);

        if (!codes.includes('es-419')) {
            throw new Error('Missing es-419 in languages list');
        }

        // 2. Check Translations
        const transKeys = Object.keys(data.translations);
        console.log('Translation keys:', transKeys);

        if (!transKeys.includes('es-419')) {
            throw new Error('Missing es-419 translations');
        }

        console.log('✅ Verification Passed!');
    } catch (e) {
        console.error('❌ Verification Failed:', e.message);
        if (e.response) {
            console.error('Response status:', e.response.status);
            console.error('Response data:', e.response.data);
        }
        process.exit(1);
    }
}

verify();
