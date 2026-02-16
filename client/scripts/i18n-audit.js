#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES = ['en', 'es', 'es-419', 'fr', 'pt'];
const baseDir = path.join(__dirname, '..', 'src', 'translations');

const flatten = (obj, prefix = '', out = {}) => {
    Object.entries(obj || {}).forEach(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            flatten(v, key, out);
        } else {
            out[key] = v;
        }
    });
    return out;
};

const load = (code) => {
    // Audit script should work even if file doesn't exist (fail gracefully or throw)
    // But here we want to audit existing files.
    const file = path.join(baseDir, `${code}.json`);
    if (!fs.existsSync(file)) {
        throw new Error(`Missing translation file: ${file}`);
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const ref = flatten(load('en'));
let hasError = false;

for (const code of LOCALES) {
    const flat = flatten(load(code));
    const missing = Object.keys(ref).filter(k => !(k in flat));
    const empty = Object.keys(ref).filter(k => (flat[k] ?? '').toString().trim() === '');

    if (missing.length || empty.length) {
        hasError = true;
        console.error(`\nLocale ${code}:`);
        if (missing.length) console.error(`  Missing keys (${missing.length}):`, missing.slice(0, 20).join(', '), missing.length > 20 ? '…' : '');
        if (empty.length) console.error(`  Empty keys (${empty.length}):`, empty.slice(0, 20).join(', '), empty.length > 20 ? '…' : '');
    }

    const extra = Object.keys(flat).filter(k => !(k in ref));
    if (extra.length) {
        console.warn(`\nLocale ${code}: Extra keys (${extra.length}) not in en:`, extra.slice(0, 20).join(', '), extra.length > 20 ? '…' : '');
    }
}

if (hasError) {
    process.exit(1);
} else {
    console.log('i18n audit passed: all locales aligned with en.');
}
