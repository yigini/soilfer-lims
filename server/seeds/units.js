/**
 * WP-16: Controlled Unit Vocabulary Seed Data
 * 
 * 28 Controlled Units covering SI and standard international agricultural laboratory quantities:
 * Mass fractions, cation exchange capacity, salinity / electrical conductivity, pH,
 * bulk density, application rates, and physical soil fractions.
 */

const UNITS = [
    {
        code: 'pH_units',
        display: 'pH units',
        quantityKind: 'DIMENSIONLESS',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['pH', 'pH units', 'units', 'dimensionless', '', '-'])
    },
    {
        code: 'g/kg',
        display: 'g/kg',
        quantityKind: 'MASS_FRACTION',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['g/kg', 'g kg-1', 'g C/kg', 'g N/kg', 'g/1000g'])
    },
    {
        code: 'mg/kg',
        display: 'mg/kg',
        quantityKind: 'MASS_FRACTION',
        factorToBase: 0.001,
        synonyms: JSON.stringify(['mg/kg', 'ppm', 'mg P/kg', 'mg N/kg', 'mg S/kg', 'mg Zn/kg', 'mg Fe/kg', 'mg Cu/kg', 'mg Mn/kg', 'mg B/kg'])
    },
    {
        code: '%',
        display: '%',
        quantityKind: 'RATIO',
        factorToBase: 10.0,
        synonyms: JSON.stringify(['%', 'percent', 'percentage', 'g/100g', 'wt%', 'mass%'])
    },
    {
        code: 'cmol(+)/kg',
        display: 'cmol(+)/kg',
        quantityKind: 'CEC',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g', 'meq/100 g', 'cmoL/kg'])
    },
    {
        code: 'µS/cm',
        display: 'µS/cm',
        quantityKind: 'ELECTRICAL_CONDUCTIVITY',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['µS/cm', 'uS/cm', 'microS/cm', 'us/cm', 'µs/cm'])
    },
    {
        code: 'dS/m',
        display: 'dS/m',
        quantityKind: 'ELECTRICAL_CONDUCTIVITY',
        factorToBase: 1000.0,
        synonyms: JSON.stringify(['dS/m', 'mS/cm', 'mmhos/cm', 'ds/m'])
    },
    {
        code: 'mS/cm',
        display: 'mS/cm',
        quantityKind: 'ELECTRICAL_CONDUCTIVITY',
        factorToBase: 1000.0,
        synonyms: JSON.stringify(['mS/cm'])
    },
    {
        code: 'mS/m',
        display: 'mS/m',
        quantityKind: 'ELECTRICAL_CONDUCTIVITY',
        factorToBase: 10.0,
        synonyms: JSON.stringify(['mS/m'])
    },
    {
        code: 'g/cm³',
        display: 'g/cm³',
        quantityKind: 'BULK_DENSITY',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['g/cm3', 'g/cm^3', 'g/ml', 'kg/dm3', 'Mg/m3', 'g/cm³', 't/m3'])
    },
    {
        code: 'mg/g',
        display: 'mg/g',
        quantityKind: 'MASS_FRACTION',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['mg/g'])
    },
    {
        code: 'mg/100g',
        display: 'mg/100g',
        quantityKind: 'MASS_FRACTION',
        factorToBase: 0.01,
        synonyms: JSON.stringify(['mg/100g', 'mg/100 g'])
    },
    {
        code: 't/ha',
        display: 't/ha',
        quantityKind: 'APPLICATION_RATE',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['t/ha', 'ton/ha', 'tonne/ha', 't ha-1'])
    },
    {
        code: 'kg/ha',
        display: 'kg/ha',
        quantityKind: 'APPLICATION_RATE',
        factorToBase: 0.001,
        synonyms: JSON.stringify(['kg/ha', 'kg ha-1'])
    },
    {
        code: 'mg/L',
        display: 'mg/L',
        quantityKind: 'AQUEOUS_CONCENTRATION',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['mg/L', 'mg/l', 'ppm (aq)'])
    },
    {
        code: 'µg/L',
        display: 'µg/L',
        quantityKind: 'AQUEOUS_CONCENTRATION',
        factorToBase: 0.001,
        synonyms: JSON.stringify(['µg/L', 'ug/L', 'ug/l', 'ppb'])
    },
    {
        code: 'meq/L',
        display: 'meq/L',
        quantityKind: 'IONIC_CONCENTRATION',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['meq/L', 'meq/l', 'mmol(+)/L'])
    },
    {
        code: 'mmol/kg',
        display: 'mmol/kg',
        quantityKind: 'MOLAL_CONCENTRATION',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['mmol/kg', 'mmol(+)/kg'])
    },
    {
        code: 'mV',
        display: 'mV',
        quantityKind: 'VOLTAGE',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['mV', 'millivolt', 'millivolts'])
    },
    {
        code: '°C',
        display: '°C',
        quantityKind: 'TEMPERATURE',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['°C', 'C', 'degC', 'degrees C'])
    },
    {
        code: 'mm',
        display: 'mm',
        quantityKind: 'LENGTH',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['mm', 'millimeter', 'millimeters'])
    },
    {
        code: 'cm',
        display: 'cm',
        quantityKind: 'LENGTH',
        factorToBase: 10.0,
        synonyms: JSON.stringify(['cm', 'centimeter', 'centimeters'])
    },
    {
        code: 'm',
        display: 'm',
        quantityKind: 'LENGTH',
        factorToBase: 1000.0,
        synonyms: JSON.stringify(['m', 'meter', 'meters'])
    },
    {
        code: 'fraction',
        display: 'fraction',
        quantityKind: 'RATIO',
        factorToBase: 1000.0,
        synonyms: JSON.stringify(['fraction', 'ratio', '0-1'])
    },
    {
        code: 'g/plant',
        display: 'g/plant',
        quantityKind: 'PLANT_BIOMASS',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['g/plant'])
    },
    {
        code: 'g/m²',
        display: 'g/m²',
        quantityKind: 'AREA_DENSITY',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['g/m2', 'g/m^2'])
    },
    {
        code: 'cm/hr',
        display: 'cm/hr',
        quantityKind: 'PERMEABILITY',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['cm/hr', 'cm/h', 'mm/hr', 'mm/h'])
    },
    {
        code: 'dimensionless',
        display: 'dimensionless',
        quantityKind: 'DIMENSIONLESS',
        factorToBase: 1.0,
        synonyms: JSON.stringify(['index', 'ratio', 'dimensionless', '-'])
    }
];

async function seedUnits(prismaClient) {
    const prisma = prismaClient || require('../prisma');
    console.log(`[SEED] Seeding ${UNITS.length} controlled units...`);
    let count = 0;
    for (const u of UNITS) {
        await prisma.unit.upsert({
            where: { code: u.code },
            update: {
                display: u.display,
                quantityKind: u.quantityKind,
                factorToBase: u.factorToBase,
                synonyms: u.synonyms
            },
            create: u
        });
        count++;
    }
    console.log(`[SEED] Successfully seeded ${count} units.`);
    return count;
}

if (require.main === module) {
    const prisma = require('../prisma');
    seedUnits(prisma)
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Failed to seed units:', err);
            process.exit(1);
        });
}

module.exports = { UNITS, seedUnits };
