const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const { samplesDb } = require('../../db');
const prisma = require('../../prisma');
const {
    normalizeUnit,
    interpretParameter,
    evaluateSoilProfile
} = require('../../services/interpretationService');
const { assembleReport } = require('../../services/reportAssembly');

describe('BLK-1: Controlled Unit Vocabulary & Agronomic Interpretation Engine', () => {
    let mgrToken, sampleId;

    beforeAll(async () => {
        mgrToken = await getAuthToken('LAB_MANAGER', 'LAB-INTERP', ['GTM'], ['INTERP-PROJ']);

        // Create sample
        const s = samplesDb.create({
            id: `SMP-INTERP-${Date.now()}`,
            labId: 'LAB-INT-001',
            originalId: `FLD-INT-${Date.now()}`,
            assignedLab: 'LAB-INTERP',
            status: 'APPROVED',
            requiredAnalyses: ['PH_H2O', 'SOC', 'TN', 'P_OLSEN', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC', 'SAND', 'SILT', 'CLAY']
        });
        sampleId = s.id;

        const now = new Date();
        await prisma.result.createMany({
            data: [
                { id: `RES-I1-${Date.now()}`, sampleId: s.id, param: 'PH_H2O', value: '5.2', unit: 'pH', isValid: true, createdAt: now, updatedAt: now },
                { id: `RES-I2-${Date.now()}`, sampleId: s.id, param: 'SOC', value: '1.5', unit: '%', isValid: true, createdAt: now, updatedAt: now }, // Should convert to 15.0 g/kg
                { id: `RES-I3-${Date.now()}`, sampleId: s.id, param: 'TN', value: '0.12', unit: '%', isValid: true, createdAt: now, updatedAt: now }, // Should convert to 1.2 g/kg
                { id: `RES-I4-${Date.now()}`, sampleId: s.id, param: 'P_OLSEN', value: '6.5', unit: 'ppm', isValid: true, createdAt: now, updatedAt: now }, // Should normalize to 6.5 mg/kg
                { id: `RES-I5-${Date.now()}`, sampleId: s.id, param: 'EXCH_CA', value: '4.5', unit: 'meq/100g', isValid: true, createdAt: now, updatedAt: now },
                { id: `RES-I6-${Date.now()}`, sampleId: s.id, param: 'EXCH_MG', value: '2.8', unit: 'cmol(+)/kg', isValid: true, createdAt: now, updatedAt: now },
                { id: `RES-I7-${Date.now()}`, sampleId: s.id, param: 'EXCH_K', value: '0.45', unit: 'cmol/kg', isValid: true, createdAt: now, updatedAt: now },
                { id: `RES-I8-${Date.now()}`, sampleId: s.id, param: 'CEC', value: '12.0', unit: 'cmol(+)/kg', isValid: true, createdAt: now, updatedAt: now },
                { id: `RES-I9-${Date.now()}`, sampleId: s.id, param: 'SAND', value: '620', unit: 'g/kg', isValid: true, createdAt: now, updatedAt: now }, // Should convert to 62.0%
                { id: `RES-I10-${Date.now()}`, sampleId: s.id, param: 'SILT', value: '230', unit: 'g/kg', isValid: true, createdAt: now, updatedAt: now }, // Should convert to 23.0%
                { id: `RES-I11-${Date.now()}`, sampleId: s.id, param: 'CLAY', value: '150', unit: 'g/kg', isValid: true, createdAt: now, updatedAt: now }  // Should convert to 15.0%
            ]
        });
    });

    test('1. Normalizes synonym units and applies scientific conversion factors', () => {
        // SOC: % to g/kg (factor 10)
        const socNorm = normalizeUnit('SOC', 1.8, '%');
        expect(socNorm.standardUnit).toBe('g/kg');
        expect(socNorm.normalizedValue).toBe(18.0);
        expect(socNorm.wasConverted).toBe(true);

        // P_OLSEN: ppm to mg/kg (factor 1)
        const pNorm = normalizeUnit('P_OLSEN', 14.5, 'ppm');
        expect(pNorm.standardUnit).toBe('mg/kg');
        expect(pNorm.normalizedValue).toBe(14.5);

        // CEC: meq/100g to cmol(+)/kg
        const cecNorm = normalizeUnit('CEC', 18.2, 'meq/100g');
        expect(cecNorm.standardUnit).toBe('cmol(+)/kg');
        expect(cecNorm.normalizedValue).toBe(18.2);

        // EC: dS/m to µS/cm (factor 1000)
        const ecNorm = normalizeUnit('EC', 0.45, 'dS/m');
        expect(ecNorm.standardUnit).toBe('µS/cm');
        expect(ecNorm.normalizedValue).toBe(450);
        expect(ecNorm.wasConverted).toBe(true);

        // SAND: g/kg to % (factor 0.1)
        const sandNorm = normalizeUnit('SAND', 550, 'g/kg');
        expect(sandNorm.standardUnit).toBe('%');
        expect(sandNorm.normalizedValue).toBe(55.0);
        expect(sandNorm.wasConverted).toBe(true);
    });

    test('2. Evaluates individual parameter agronomic classifications (FAO 5-tier)', () => {
        // Acidic pH
        const phAcid = interpretParameter('PH_H2O', 5.0);
        expect(phAcid.rating).toBe('LOW');
        expect(phAcid.label).toMatch(/Strongly Acidic/);

        // Optimal pH
        const phOpt = interpretParameter('PH_H2O', 6.8);
        expect(phOpt.rating).toBe('OPTIMAL');
        expect(phOpt.label).toMatch(/Neutral/);

        // Deficient Phosphorus
        const pDef = interpretParameter('P_OLSEN', 4.5);
        expect(pDef.rating).toBe('VERY_LOW');
        expect(pDef.label).toMatch(/Deficient/);

        // Deficient Potassium
        const kDef = interpretParameter('EXCH_K', 0.12);
        expect(kDef.rating).toBe('LOW');
        expect(kDef.label).toMatch(/Deficient Potassium/);
    });

    test('3. Computes multi-parameter soil diagnostics (USDA texture, C:N stoichiometry, Base Saturation, Ca:Mg)', () => {
        const results = [
            { param: 'SAND', value: 65, unit: '%' },
            { param: 'SILT', value: 20, unit: '%' },
            { param: 'CLAY', value: 15, unit: '%' },
            { param: 'SOC', value: 15.0, unit: 'g/kg' },
            { param: 'TN', value: 1.25, unit: 'g/kg' },
            { param: 'CEC', value: 16.0, unit: 'cmol(+)/kg' },
            { param: 'EXCH_CA', value: 7.5, unit: 'cmol(+)/kg' },
            { param: 'EXCH_MG', value: 2.5, unit: 'cmol(+)/kg' },
            { param: 'EXCH_K', value: 0.6, unit: 'cmol(+)/kg' },
            { param: 'EXCH_NA', value: 0.2, unit: 'cmol(+)/kg' }
        ];

        const diag = evaluateSoilProfile(results);

        // USDA Texture check
        expect(diag.texture).not.toBeNull();
        expect(diag.texture.className).toBe('Sandy Loam');
        expect(diag.texture.code).toBe('SL');
        expect(diag.texture.isValid).toBe(true);

        // C:N ratio check (15 / 1.25 = 12.0)
        expect(diag.stoichiometry).not.toBeNull();
        expect(diag.stoichiometry.cnRatio).toBe(12.0);
        expect(diag.stoichiometry.status).toBe('OPTIMAL');

        // Cation Exchange & Base Saturation check
        // Sum of bases = 7.5 + 2.5 + 0.6 + 0.2 = 10.8 cmol/kg
        // Base Saturation = (10.8 / 16.0) * 100 = 67.5%
        expect(diag.cationExchange).not.toBeNull();
        expect(diag.cationExchange.sumOfBases).toBe(10.8);
        expect(diag.cationExchange.baseSaturation).toBe(67.5);
        expect(diag.cationExchange.caMgRatio).toBe(3.0); // 7.5 / 2.5 = 3.0
    });

    test('4. End-to-end report assembly embeds controlled units and rich diagnostic interpretations', async () => {
        const { content } = await assembleReport(sampleId, { username: 'manager_interp' });

        expect(content.resultGroups.length).toBeGreaterThan(0);

        // Verify that result item has standardized unit and interpretation payload
        const allItems = content.resultGroups.flatMap(g => g.items);
        const socItem = allItems.find(i => i.param === 'SOC');
        expect(socItem).toBeDefined();
        expect(socItem.unit).toBe('g/kg');
        expect(socItem.interpretation).toBeDefined();
        expect(socItem.interpretation.label).toMatch(/SOC/);

        // Verify holistic diagnostics attached
        expect(content.diagnostics).toBeDefined();
        expect(content.diagnostics.texture).toBeDefined();
        expect(content.diagnostics.texture.className).toBe('Sandy Loam');
        expect(content.diagnostics.stoichiometry).toBeDefined();
        expect(content.diagnostics.stoichiometry.cnRatio).toBeCloseTo(12.5, 1);
    });

    test('5. WP-04: Fail closed on unrecognised unit', () => {
        const socInvalid = normalizeUnit('SOC', 10, 'g/100g');
        expect(socInvalid.normalizedValue).toBeNull();
        expect(socInvalid.unrecognizedUnit).toBe('g/100g');

        const interp = interpretParameter('SOC', 10, 'g/100g');
        expect(interp.normalizedValue).toBeNull();
        expect(interp.advisory).toMatch(/Unrecognized unit/);
    });

    test('6. WP-05: Cation mg/kg to cmol(+)/kg conversions', () => {
        // 200 mg/kg K: 200 / 391 = 0.51 cmol/kg -> rates Adequate / Optimal (0.2 - 0.6)
        const kNorm = normalizeUnit('EXCH_K', 200, 'mg/kg');
        expect(kNorm.normalizedValue).toBeCloseTo(0.51, 2);
        const kInterp = interpretParameter('EXCH_K', 200, 'mg/kg');
        expect(kInterp.rating).toBe('OPTIMAL');
        expect(kInterp.label).toMatch(/Adequate Potassium/);

        // 1600 mg/kg Ca: 1600 / 200.4 = 7.98 cmol/kg -> rates Optimal (2 - 10)
        const caNorm = normalizeUnit('EXCH_CA', 1600, 'mg/kg');
        expect(caNorm.normalizedValue).toBeCloseTo(7.98, 2);
        const caInterp = interpretParameter('EXCH_CA', 1600, 'mg/kg');
        expect(caInterp.rating).toBe('OPTIMAL');
        expect(caInterp.label).toMatch(/Optimal/);
    });

    test('7. WP-18: Total N of 30 g/kg rates High in SOIL and Adequate in PLANT', () => {
        // In Soil: 30 g/kg (3.0%) is high (> 2.5 g/kg)
        const soilInterp = interpretParameter('TN', 30, 'g/kg', { matrix: 'SOIL' });
        expect(soilInterp.rating).toBe('HIGH');
        expect(soilInterp.label).toMatch(/High Nitrogen/);

        // In Plant: 30 g/kg (3.0%) is within target foliar sufficiency (20 - 40 g/kg)
        const plantInterp = interpretParameter('TN', 30, 'g/kg', { matrix: 'PLANT' });
        expect(plantInterp.rating).toBe('OPTIMAL');
        expect(plantInterp.label).toMatch(/Adequate Plant Tissue N/);
    });

    test('8. WP-23: Extended interpretation coverage with calibration methods', () => {
        // PH_CACL2
        const phCaCl2 = interpretParameter('PH_CACL2', 5.5);
        expect(phCaCl2.rating).toBe('MODERATE');
        expect(phCaCl2.method).toMatch(/0.01 M CaCl2/);

        // EC_E
        const ece = interpretParameter('EC_E', 3.2, 'dS/m');
        expect(ece.rating).toBe('MODERATE');
        expect(ece.label).toMatch(/Slightly Saline/);
        expect(ece.method).toMatch(/Saturated Paste Extract/);

        // P_BRAY2
        const pBray2 = interpretParameter('P_BRAY2', 25, 'mg/kg');
        expect(pBray2.rating).toBe('OPTIMAL');
        expect(pBray2.label).toMatch(/Adequate/);
        expect(pBray2.method).toMatch(/Bray.*2/);

        // P_MEHLICH1
        const pMehlich1 = interpretParameter('P_MEHLICH1', 18, 'mg/kg');
        expect(pMehlich1.rating).toBe('OPTIMAL');
        expect(pMehlich1.label).toMatch(/Optimum/);
        expect(pMehlich1.method).toMatch(/Mehlich-1/);
    });
});
