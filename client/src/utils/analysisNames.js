/**
 * Comprehensive SoilFER Laboratory Analysis & Parameter Display Names
 * Covers all 10 analytical domains across Soil, Fertilizer, Plant Tissue, and Water matrices.
 */

export const ANALYSIS_DISPLAY_NAMES = {
    // ── 1. Physical & Hydraulic Properties ──
    'SAND': 'Sand Fraction (0.05 – 2.0 mm)',
    'SILT': 'Silt Fraction (0.002 – 0.05 mm)',
    'CLAY': 'Clay Fraction (< 0.002 mm)',
    'TEXTURE': 'Soil Texture Class (USDA)',
    'pSA': 'Particle Size Analysis (PSA)',
    'COARSE_FRAG': 'Coarse Fragments (> 2 mm)',
    'BD_FINE': 'Bulk Density (Fine Earth)',
    'bulkDensityFineEarth': 'Bulk Density (Fine Earth)',
    'BD_WHOLE': 'Bulk Density (Whole Soil)',
    'bulkDensityWholeSoil': 'Bulk Density (Whole Soil)',
    'PARTICLE_DENSITY': 'Soil Particle Density (ρs)',
    'POROSITY': 'Total Soil Porosity (Φ)',
    'SOIL_MOISTURE': 'Gravimetric Moisture Content (θm)',
    'VOL_MOISTURE': 'Volumetric Water Content (θv)',
    'WATER_RET_FC': 'Water Retention at Field Capacity (pF 2.5)',
    'WATER_RET_PWP': 'Water Retention at Wilting Point (pF 4.2)',
    'AWC': 'Available Water Capacity (AWC)',
    'K_SAT': 'Saturated Hydraulic Conductivity (Ksat)',
    'AGG_STABILITY': 'Aggregate Stability (Mean Weight Diameter)',
    'MUNSELL_COLOR': 'Soil Munsell Color (Dry & Moist)',
    'LIQUID_LIMIT': 'Atterberg Liquid Limit (LL)',
    'PLASTIC_LIMIT': 'Atterberg Plastic Limit (PL)',

    // ── 2. Routine Chemical Properties & Acidity ──
    'PH_H2O': 'Soil pH (1:2.5 Water)',
    'PH_CACL2': 'Soil pH (0.01M CaCl₂)',
    'PH_KCL': 'Soil pH (1M KCl Reserve Acidity)',
    'pH': 'Soil pH (1:2.5 Water)',
    'SOC': 'Soil Organic Carbon (SOC)',
    'carbonOrganic': 'Soil Organic Carbon (SOC)',
    'SOM': 'Soil Organic Matter (SOM)',
    'organicMatter': 'Soil Organic Matter (SOM)',
    'POXC': 'Permanganate-Oxidizable Carbon (Active Carbon)',
    'CEC': 'Cation Exchange Capacity (CEC)',
    'cationExchangeCapacitySoil': 'Cation Exchange Capacity (CEC)',
    'ECEC': 'Effective CEC (ECEC)',
    'effectiveCec': 'Effective CEC (ECEC)',
    'EXCH_ACID': 'Exchangeable Acidity (Al³⁺ + H⁺)',
    'acidityExchangeable': 'Exchangeable Acidity (Al³⁺ + H⁺)',
    'EXCH_AL': 'Exchangeable Aluminum (Al³⁺)',
    'baseSaturation': 'Base Saturation Percentage (%)',
    'LIME_REQ': 'Lime Requirement (Buffer Method)',

    // ── 3. Plant Nutrients & Micronutrients ──
    'TN': 'Total Nitrogen (TN)',
    'nitrogenTotal': 'Total Nitrogen (TN)',
    'N_NO3': 'Nitrate Nitrogen (NO₃⁻-N)',
    'N_NH4': 'Ammonium Nitrogen (NH₄⁺-N)',
    'N_MIN': 'Total Mineral Available Nitrogen (N-min)',
    'P_OLSEN': 'Available Phosphorus (Olsen P)',
    'P_BRAY1': 'Available Phosphorus (Bray-1 P)',
    'P_BRAY2': 'Available Phosphorus (Bray-2 P)',
    'P_MEHLICH3': 'Available Phosphorus (Mehlich-3 P)',
    'P_MEHLICH1': 'Available Phosphorus (Mehlich-1 Double Acid P)',
    'P_RESIN': 'Resin-Extractable Phosphorus',
    'P_TOTAL': 'Total Soil Phosphorus',
    'P_RETENTION': 'Phosphorus Retention / P-Sorption Capacity',
    'EXCH_CA': 'Exchangeable Calcium (Ca²⁺)',
    'EXCH_MG': 'Exchangeable Magnesium (Mg²⁺)',
    'EXCH_K': 'Exchangeable Potassium (K⁺)',
    'EXCH_NA': 'Exchangeable Sodium (Na⁺)',
    'EXT_S': 'Available Sulfate Sulfur (SO₄²⁻-S)',
    'EXT_ZN': 'Extractable Zinc (Zn, DTPA)',
    'EXT_FE': 'Extractable Iron (Fe, DTPA)',
    'EXT_CU': 'Extractable Copper (Cu, DTPA)',
    'EXT_MN': 'Extractable Manganese (Mn, DTPA)',
    'EXT_B': 'Extractable Boron (Hot Water B)',
    'EXT_MO': 'Extractable Molybdenum (Mo)',
    'EXT_CO': 'Extractable Cobalt (Co)',
    'EXT_SI': 'Available Silicon (Si)',

    // ── 4. Salinity, Sodicity & Carbonates ──
    'EC': 'Electrical Conductivity (1:5)',
    'electricalConductivity': 'Electrical Conductivity (1:5)',
    'EC_E': 'EC of Saturated Paste Extract (ECe)',
    'SAR': 'Sodium Adsorption Ratio (SAR)',
    'ESP': 'Exchangeable Sodium Percentage (ESP)',
    'CACO3': 'Total Carbonate Equivalent (CaCO₃)',
    'totalCarbonateEquivalent': 'Total Carbonate Equivalent (CaCO₃)',
    'ACTIVE_CACO3': 'Active Carbonate (Drouineau Method)',
    'GYPSUM': 'Gypsum Content (CaSO₄·2H₂O)',
    'WATER_SOLUBLE_CL': 'Water-Soluble Chloride (Cl⁻)',

    // ── 5. Trace Elements & Heavy Metals ──
    'HM_CD': 'Total Cadmium (Cd, Aqua Regia)',
    'HM_PB': 'Total Lead (Pb, Aqua Regia)',
    'HM_AS': 'Total Arsenic (As, Aqua Regia)',
    'HM_CR': 'Total Chromium (Cr, Aqua Regia)',
    'HM_NI': 'Total Nickel (Ni, Aqua Regia)',
    'HM_HG': 'Total Mercury (Hg, Cold Vapor)',
    'HM_CU': 'Total Copper (Cu, Aqua Regia)',
    'HM_ZN': 'Total Zinc (Zn, Aqua Regia)',
    'HM_CO': 'Total Cobalt (Co, Aqua Regia)',
    'HM_SE': 'Total Selenium (Se, Hydride)',
    'HM_BA': 'Total Barium (Ba, Aqua Regia)',
    'HM_V': 'Total Vanadium (V, Aqua Regia)',

    // ── 6. Soil Health, Biology & Enzymes ──
    'SOIL_RESPIRATION': 'Soil Basal Respiration (CO₂-C)',
    'MBC': 'Microbial Biomass Carbon (MBC)',
    'MBN': 'Microbial Biomass Nitrogen (MBN)',
    'Q_CO2': 'Metabolic Quotient (qCO₂)',
    'ENZ_BGLU': 'β-Glucosidase Enzyme Activity',
    'ENZ_ACID_PHOS': 'Acid Phosphatase Enzyme Activity',
    'ENZ_ALK_PHOS': 'Alkaline Phosphatase Enzyme Activity',
    'ENZ_UREASE': 'Urease Enzyme Activity',
    'ENZ_DHA': 'Dehydrogenase Enzyme Activity (DHA)',
    'ENZ_FDA': 'Fluorescein Diacetate Hydrolysis (FDA)',
    'GLOMALIN': 'Glomalin-Related Soil Protein (GRSP)',

    // ── 7. Spectroscopy & Radiometrics ──
    'SPEC_MIR': 'Mid-Infrared Spectroscopy (MIR DRIFTS)',
    'SPEC_VIS_NIR': 'Visible & Near-Infrared Spectroscopy (Vis-NIR)',
    'SPEC_GRS': 'Gamma-Ray Spectrometry Scan (GRS)',
    'GRS_K40': 'Radiometric Potassium-40 (⁴⁰K)',
    'GRS_U238': 'Uranium-238 Equivalent (eU)',
    'GRS_TH232': 'Thorium-232 Equivalent (eTh)',
    'GRS_TC': 'Gamma Total Count / Dose Rate',
    'SPEC_XRF': 'X-Ray Fluorescence Spectrometry (pXRF)',

    // ── 8. Fertilizer Quality & Inputs ──
    'FERT_N_TOT': 'Total Nitrogen in Fertilizer',
    'FERT_N_NH4': 'Ammoniacal Nitrogen in Fertilizer (NH₄-N)',
    'FERT_N_NO3': 'Nitrate Nitrogen in Fertilizer (NO₃-N)',
    'FERT_N_UREA': 'Urea Nitrogen in Fertilizer (Ureic N)',
    'FERT_P_TOT': 'Total Phosphorus in Fertilizer (P₂O₅)',
    'FERT_P_WATER': 'Water-Soluble Phosphorus in Fertilizer (P₂O₅)',
    'FERT_P_CITRATE': 'Citrate-Soluble Phosphorus in Fertilizer (P₂O₅)',
    'FERT_K_WATER': 'Water-Soluble Potassium in Fertilizer (K₂O)',
    'FERT_S': 'Total Sulfur in Fertilizer (S)',
    'FERT_CA': 'Calcium Content in Fertilizer (CaO)',
    'FERT_MG': 'Magnesium Content in Fertilizer (MgO)',
    'FERT_MOIST': 'Free Moisture in Fertilizer',
    'FERT_GRAN': 'Fertilizer Granulometry / Particle Size',
    'FERT_CD': 'Cadmium in Fertilizer (Contaminant)',
    'FERT_PB': 'Lead in Fertilizer (Contaminant)',
    'FERT_AS': 'Arsenic in Fertilizer (Contaminant)',
    'FERT_HG': 'Mercury in Fertilizer (Contaminant)',

    // ── 9. Plant Tissue Analysis ──
    'PLANT_N': 'Total Nitrogen in Foliar Tissue (N)',
    'PLANT_P': 'Total Phosphorus in Foliar Tissue (P)',
    'PLANT_K': 'Total Potassium in Foliar Tissue (K)',
    'PLANT_CA': 'Total Calcium in Foliar Tissue (Ca)',
    'PLANT_MG': 'Total Magnesium in Foliar Tissue (Mg)',
    'PLANT_S': 'Total Sulfur in Foliar Tissue (S)',
    'PLANT_FE': 'Iron in Foliar Tissue (Fe)',
    'PLANT_ZN': 'Zinc in Foliar Tissue (Zn)',
    'PLANT_MN': 'Manganese in Foliar Tissue (Mn)',
    'PLANT_CU': 'Copper in Foliar Tissue (Cu)',
    'PLANT_B': 'Boron in Foliar Tissue (B)',
    'PLANT_MO': 'Molybdenum in Foliar Tissue (Mo)',

    // ── 10. Agricultural & Irrigation Water Quality ──
    'WATER_PH': 'Irrigation Water pH',
    'WATER_EC': 'Irrigation Water EC (ECw)',
    'WATER_TDS': 'Total Dissolved Solids in Water (TDS)',
    'WATER_SAR': 'Water Sodium Adsorption Ratio (SAR)',
    'WATER_HARDNESS': 'Total Water Hardness (CaCO₃ eq)',
    'WATER_CA': 'Dissolved Calcium in Water (Ca²⁺)',
    'WATER_MG': 'Dissolved Magnesium in Water (Mg²⁺)',
    'WATER_NA': 'Dissolved Sodium in Water (Na⁺)',
    'WATER_K': 'Dissolved Potassium in Water (K⁺)',
    'WATER_HCO3': 'Bicarbonate in Water (HCO₃⁻)',
    'WATER_CO3': 'Carbonate in Water (CO₃²⁻)',
    'WATER_CL': 'Chloride in Water (Cl⁻)',
    'WATER_SO4': 'Sulfate in Water (SO₄²⁻)',
    'WATER_NO3_N': 'Nitrate-Nitrogen in Water (NO₃⁻-N)',
    'WATER_B': 'Boron in Irrigation Water (B)',
    'WATER_RSC': 'Residual Sodium Carbonate in Water (RSC)',

    // ── Operational Gates ──
    'DRYING': 'Sample Drying (Station 01)',
    'PREPARATION': 'Sample Milling & Sieving (Station 02)',
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
