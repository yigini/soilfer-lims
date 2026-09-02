/**
 * Standard SoilFER Analysis & Parameter Display Names
 * Converts technical laboratory codes (e.g. PH_H2O, SOC, TN, P_OLSEN, SAND)
 * into real, human-readable analytical names.
 */

export const ANALYSIS_DISPLAY_NAMES = {
    // Chemical Properties
    'PH_H2O': 'Soil pH (1:2.5 Water)',
    'PH_CACL2': 'Soil pH (0.01M CaCl₂)',
    'PH_KCL': 'Soil pH (1M KCl)',
    'pH': 'Soil pH (1:2.5 Water)',
    'EC': 'Electrical Conductivity (1:5)',
    'electricalConductivity': 'Electrical Conductivity (1:5)',
    'SOC': 'Soil Organic Carbon (SOC)',
    'carbonOrganic': 'Soil Organic Carbon (SOC)',
    'SOM': 'Soil Organic Matter (SOM)',
    'organicMatter': 'Soil Organic Matter (SOM)',
    'CACO3': 'Total Carbonate Equivalent (CaCO₃)',
    'totalCarbonateEquivalent': 'Total Carbonate Equivalent (CaCO₃)',
    'GYPSUM': 'Gypsum Content (CaSO₄·2H₂O)',

    // Plant Nutrients & Micronutrients
    'TN': 'Total Nitrogen (TN)',
    'nitrogenTotal': 'Total Nitrogen (TN)',
    'P_OLSEN': 'Available Phosphorus (Olsen P)',
    'P_BRAY1': 'Available Phosphorus (Bray-1 P)',
    'P_MEHLICH3': 'Available Phosphorus (Mehlich-3 P)',
    'EXT_ZN': 'Extractable Zinc (Zn)',
    'EXT_FE': 'Extractable Iron (Fe)',
    'EXT_CU': 'Extractable Copper (Cu)',
    'EXT_MN': 'Extractable Manganese (Mn)',
    'EXT_B': 'Extractable Boron (B)',

    // Cation Exchange & Bases
    'CEC': 'Cation Exchange Capacity (CEC)',
    'cationExchangeCapacitySoil': 'Cation Exchange Capacity (CEC)',
    'ECEC': 'Effective CEC (ECEC)',
    'effectiveCec': 'Effective CEC (ECEC)',
    'EXCH_CA': 'Exchangeable Calcium (Ca²⁺)',
    'EXCH_MG': 'Exchangeable Magnesium (Mg²⁺)',
    'EXCH_K': 'Exchangeable Potassium (K⁺)',
    'EXCH_NA': 'Exchangeable Sodium (Na⁺)',
    'EXCH_ACID': 'Exchangeable Acidity (Al³⁺ + H⁺)',
    'acidityExchangeable': 'Exchangeable Acidity (Al³⁺ + H⁺)',
    'baseSaturation': 'Base Saturation (%)',

    // Physical Properties & Texture
    'SAND': 'Sand Fraction (0.05 – 2.0 mm)',
    'SILT': 'Silt Fraction (0.002 – 0.05 mm)',
    'CLAY': 'Clay Fraction (< 0.002 mm)',
    'TEXTURE': 'Soil Texture Class (USDA)',
    'pSA': 'Particle Size Analysis (PSA)',
    'BD_FINE': 'Bulk Density (Fine Earth)',
    'bulkDensityFineEarth': 'Bulk Density (Fine Earth)',
    'BD_WHOLE': 'Bulk Density (Whole Soil)',
    'bulkDensityWholeSoil': 'Bulk Density (Whole Soil)',

    // Operational Gates & Spectroscopy
    'DRYING': 'Sample Drying (Station 01)',
    'PREPARATION': 'Sample Milling & Sieving (Station 02)',
    'SPEC_VIS_NIR': 'Vis-NIR Soil Spectroscopy',
    'SPEC_MIR': 'MIR Soil Spectroscopy',
    'ARCHIVING': 'Sample Archiving & Storage',
    'DISPOSAL': 'Sample Disposal'
};

/**
 * Returns the human-readable display name for any analysis parameter code.
 * If fallbackName is already a descriptive name, it is preferred.
 */
export const getAnalysisDisplayName = (code, fallbackName) => {
    if (!code) return fallbackName || '—';
    if (fallbackName && fallbackName !== code && !fallbackName.startsWith('http') && fallbackName.length > 2) {
        return fallbackName;
    }
    return ANALYSIS_DISPLAY_NAMES[code] || fallbackName || code;
};

export default getAnalysisDisplayName;
