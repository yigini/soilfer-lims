const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const { samplesDb } = require('../../db');
const prisma = require('../../prisma');
const {
    CONTROLLED_UNITS,
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
});
