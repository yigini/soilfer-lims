const { formatMessage, parseLaboratoryNumber } = require('../../utils/messageFormatter');

describe('ICU MessageFormat & Strict Laboratory Numeric Parser (Finding L12, L16)', () => {
    describe('1. ICU Message Formatting', () => {
        test('formats legacy {{param}} correctly', () => {
            const msg = 'Welcome, {{name}}! You have {{count}} samples.';
            expect(formatMessage(msg, { name: 'Carlos', count: 5 })).toBe('Welcome, Carlos! You have 5 samples.');
        });

        test('formats ICU plurals across English, Spanish, French, Portuguese', () => {
            const pattern = '{count, plural, =0 {No samples} one {1 sample} other {# samples}}';
            expect(formatMessage(pattern, { count: 0 }, 'en')).toBe('No samples');
            expect(formatMessage(pattern, { count: 1 }, 'en')).toBe('1 sample');
            expect(formatMessage(pattern, { count: 12 }, 'en')).toBe('12 samples');

            const patternEs = '{count, plural, =0 {Sin muestras} one {1 muestra} other {# muestras}}';
            expect(formatMessage(patternEs, { count: 1 }, 'es')).toBe('1 muestra');
            expect(formatMessage(patternEs, { count: 5 }, 'es')).toBe('5 muestras');

            const patternFr = '{count, plural, =0 {Aucun échantillon} one {1 échantillon} other {# échantillons}}';
            expect(formatMessage(patternFr, { count: 1 }, 'fr')).toBe('1 échantillon');
            expect(formatMessage(patternFr, { count: 8 }, 'fr')).toBe('8 échantillons');

            const patternPt = '{count, plural, =0 {Nenhuma amostra} one {1 amostra} other {# amostras}}';
            expect(formatMessage(patternPt, { count: 1 }, 'pt')).toBe('1 amostra');
            expect(formatMessage(patternPt, { count: 4 }, 'pt')).toBe('4 amostras');
        });

        test('gracefully recovers without crashing on malformed ICU patterns', () => {
            const badPattern = 'This has broken {count, plural, unclosed';
            expect(formatMessage(badPattern, { count: 1 }, 'en')).toBeDefined();
        });
    });

    describe('2. Strict Laboratory Numeric Parser (Contract L16)', () => {
        test('distinguishes null/empty from 0', () => {
            expect(parseLaboratoryNumber(null).value).toBeNull();
            expect(parseLaboratoryNumber('').value).toBeNull();
            expect(parseLaboratoryNumber('   ').value).toBeNull();
            expect(parseLaboratoryNumber('0').value).toBe(0);
            expect(parseLaboratoryNumber(0).value).toBe(0);
        });

        test('accepts dot or comma as decimal separators and produces canonical numbers', () => {
            const dotResult = parseLaboratoryNumber('6.42');
            const commaResult = parseLaboratoryNumber('6,42');
            expect(dotResult.valid).toBe(true);
            expect(commaResult.valid).toBe(true);
            expect(dotResult.value).toBe(6.42);
            expect(commaResult.value).toBe(6.42);
            expect(dotResult.canonical).toBe('6.42');
            expect(commaResult.canonical).toBe('6.42');
        });

        test('preserves qualifiers correctly (<0.005 and <0,005)', () => {
            const r1 = parseLaboratoryNumber('<0.005');
            const r2 = parseLaboratoryNumber('<0,005');
            expect(r1.valid).toBe(true);
            expect(r2.valid).toBe(true);
            expect(r1.qualifier).toBe('<');
            expect(r2.qualifier).toBe('<');
            expect(r1.canonical).toBe('<0.005');
            expect(r2.canonical).toBe('<0.005');
        });

        test('handles standard grouped numbers (1,234.56 and 1.234,56)', () => {
            const r1 = parseLaboratoryNumber('1,234.56');
            const r2 = parseLaboratoryNumber('1.234,56');
            expect(r1.value).toBe(1234.56);
            expect(r2.value).toBe(1234.56);
        });

        test('rejects invalid inputs with multiple decimal dots', () => {
            const r = parseLaboratoryNumber('12.34.56');
            expect(r.valid).toBe(false);
            expect(r.error).toBe('MULTIPLE_DECIMAL_POINTS');
        });
    });
});
