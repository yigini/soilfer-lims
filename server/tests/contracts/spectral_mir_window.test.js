const { validateSpectra } = require('../../services/spectralValidation');

describe('WP-33: Widened MIR Spectral Window (400-4000 cm-1)', () => {
    test('1. A full-range KBr MIR scan (400-4000 cm-1) validates without being flagged', () => {
        // Generate wavenumbers from 4000 down to 400 cm-1 with step 2 cm-1 (decreasing order)
        const wavenumbers = [];
        const absorbances = [];
        for (let wn = 4000; wn >= 400; wn -= 20) {
            wavenumbers.push(wn);
            // Simulate typical soil spectrum with clay lattice peak around 460 cm-1 and 530 cm-1
            let abs = 0.2 + 0.1 * Math.sin(wn / 100);
            if (wn >= 420 && wn <= 500) abs += 0.4; // Si-O lattice vibration
            absorbances.push(Number(abs.toFixed(4)));
        }

        expect(Math.min(...wavenumbers)).toBe(400);
        expect(Math.max(...wavenumbers)).toBe(4000);

        const result = validateSpectra(wavenumbers, absorbances, 'MIR');
        expect(result.isValid).toBe(true);
        expect(result.qcStatus).toBe('PASS');
        expect(result.flags).not.toContain('WAVENUMBER_OUT_OF_RANGE');
    });

    test('2. A scan extending below 400 cm-1 produces WAVENUMBER_OUT_OF_RANGE warning', () => {
        const wavenumbers = [];
        const absorbances = [];
        for (let wn = 4000; wn >= 350; wn -= 25) {
            wavenumbers.push(wn);
            absorbances.push(0.3 + 0.05 * Math.sin(wn / 50));
        }

        const result = validateSpectra(wavenumbers, absorbances, 'MIR');
        expect(result.flags).toContain('WAVENUMBER_OUT_OF_RANGE');
        expect(result.qcStatus).toBe('WARN');
    });

    test('3. Custom instrument range option allows extended Far-IR scanning', () => {
        const wavenumbers = [];
        const absorbances = [];
        for (let wn = 4000; wn >= 300; wn -= 25) {
            wavenumbers.push(wn);
            absorbances.push(0.3 + 0.05 * Math.sin(wn / 50));
        }

        // Pass custom instrument range minWavenumber: 250
        const result = validateSpectra(wavenumbers, absorbances, 'MIR', {
            instrumentRange: { minWavenumber: 250, maxWavenumber: 4000 }
        });
        expect(result.flags).not.toContain('WAVENUMBER_OUT_OF_RANGE');
    });
});
