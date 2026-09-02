/**
 * WP-17: Method Reference Library Seed Data
 * 
 * Includes:
 * - 28 GLOSOLAN Standard Operating Procedures (SOP-01 to SOP-28, with 25-28 UNDER_PUBLICATION)
 * - 24 ISO Standards for soil chemical, physical and biological analysis
 * - Classical scientific literature reference methods
 */

const REFERENCES = [
    // --- GLOSOLAN SOPs ---
    {
        id: 'GLOSOLAN-SOP-01',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 01: Standard operating procedure for soil pH determination.',
        title: 'Soil pH Determination in Water and 0.01 M CaCl2',
        year: 2019,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-02',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 02: Standard operating procedure for soil electrical conductivity.',
        title: 'Soil Electrical Conductivity (1:5 Soil:Water extract)',
        year: 2019,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-03',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 03: Standard operating procedure for soil organic carbon by Walkley-Black titration.',
        title: 'Soil Organic Carbon — Walkley-Black Wet Oxidation Method',
        year: 2019,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-04',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 04: Standard operating procedure for available phosphorus by Olsen method.',
        title: 'Available Phosphorus — Olsen Sodium Bicarbonate Extraction',
        year: 2020,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-05',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 05: Standard operating procedure for cation exchange capacity and exchangeable bases.',
        title: 'Cation Exchange Capacity and Exchangeable Bases (1 M Ammonium Acetate pH 7.0)',
        year: 2020,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-06',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 06: Standard operating procedure for particle size distribution.',
        title: 'Particle Size Distribution — Hydrometer and Pipette Methods',
        year: 2020,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-07',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 07: Standard operating procedure for extractable micronutrients by DTPA.',
        title: 'Extractable Micronutrients (Fe, Zn, Cu, Mn) by 0.005 M DTPA Extraction',
        year: 2021,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-08',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 08: Standard operating procedure for extractable boron.',
        title: 'Extractable Boron by Hot Water Azomethine-H',
        year: 2021,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-09',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 09: Standard operating procedure for total nitrogen by Kjeldahl.',
        title: 'Total Nitrogen — Regular Macro and Micro Kjeldahl Digestion',
        year: 2021,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-10',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 10: Standard operating procedure for total carbon, nitrogen and sulfur by dry combustion.',
        title: 'Total Carbon, Nitrogen and Sulfur — High-Temperature Dry Combustion (Elemental Analyzer)',
        year: 2021,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-11',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 11: Standard operating procedure for available phosphorus by Bray 1 and Bray 2.',
        title: 'Available Phosphorus — Bray and Kurtz No. 1 and No. 2 Acid Fluoride Extraction',
        year: 2021,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-12',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 12: Standard operating procedure for Mehlich 3 extractable nutrients.',
        title: 'Multi-element Extraction by Mehlich 3 Extractant',
        year: 2022,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-13',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 13: Standard operating procedure for soil inorganic carbon / carbonate equivalent.',
        title: 'Carbonate Equivalent — Calcimeter Volumetric and Acid Titration Methods',
        year: 2022,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-14',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 14: Standard operating procedure for exchangeable acidity and aluminum.',
        title: 'Exchangeable Acidity and Aluminum (1 M KCl Titration)',
        year: 2022,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-15',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 15: Standard operating procedure for soil bulk density.',
        title: 'Soil Bulk Density — Core Method (Undisturbed Core)',
        year: 2022,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-16',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 16: Standard operating procedure for soil aggregate stability.',
        title: 'Soil Aggregate Stability — Wet Sieving Method',
        year: 2023,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-17',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 17: Standard operating procedure for mid-infrared (MIR) diffuse reflectance spectroscopy.',
        title: 'Soil Mid-Infrared (MIR) Diffuse Reflectance Spectroscopy (FTIR)',
        year: 2023,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-18',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 18: Standard operating procedure for visible and near-infrared (VNIR) spectroscopy.',
        title: 'Soil Visible and Near-Infrared (VNIR) Diffuse Reflectance Spectroscopy',
        year: 2023,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-19',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 19: Standard operating procedure for extractable sulfate-sulfur.',
        title: 'Extractable Sulfate-Sulfur (0.01 M Calcium Phosphate / Turbidimetric or ICP-OES)',
        year: 2023,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-20',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 20: Standard operating procedure for mineral nitrogen (ammonium and nitrate).',
        title: 'Soil Mineral Nitrogen (2 M KCl Extraction / Colorimetric Automated Segmented Flow)',
        year: 2023,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-21',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 21: Standard operating procedure for permanganate oxidizable carbon (POXC).',
        title: 'Permanganate Oxidizable Carbon (Active Carbon / POXC)',
        year: 2024,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-22',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 22: Standard operating procedure for soil β-glucosidase activity.',
        title: 'Soil β-Glucosidase Enzyme Activity Assay',
        year: 2024,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-23',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 23: Standard operating procedure for trace metals by aqua regia digestion.',
        title: 'Trace Element Total Extraction — Aqua Regia Microwave / Hot-Plate Digestion',
        year: 2024,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    {
        id: 'GLOSOLAN-SOP-24',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 24: Standard operating procedure for saturated hydraulic conductivity.',
        title: 'Saturated Hydraulic Conductivity — Constant Head Permeameter',
        year: 2024,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'ACTIVE'
    },
    // The 4 GLOSOLAN SOPs currently under publication (WP-17 requirement)
    {
        id: 'GLOSOLAN-SOP-25',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 25: Standard operating procedure for soil biological respiration (Under Publication).',
        title: 'Soil Basal and Substrate-Induced Respiration',
        year: 2025,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'UNDER_PUBLICATION'
    },
    {
        id: 'GLOSOLAN-SOP-26',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 26: Standard operating procedure for soil moisture retention characteristics (Under Publication).',
        title: 'Soil Moisture Retention Characteristic Curves (Pressure Plate Extractor)',
        year: 2025,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'UNDER_PUBLICATION'
    },
    {
        id: 'GLOSOLAN-SOP-27',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 27: Standard operating procedure for active lime / Drouineau method (Under Publication).',
        title: 'Active Calcium Carbonate by 0.1 M Ammonium Oxalate',
        year: 2025,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'UNDER_PUBLICATION'
    },
    {
        id: 'GLOSOLAN-SOP-28',
        authority: 'GLOSOLAN',
        citation: 'FAO GLOSOLAN SOP 28: Standard operating procedure for microbial biomass carbon by fumigation-extraction (Under Publication).',
        title: 'Microbial Biomass Carbon (Chloroform Fumigation Extraction)',
        year: 2025,
        url: 'https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/standard-operating-procedures/en/',
        status: 'UNDER_PUBLICATION'
    },

    // --- ISO Standards ---
    {
        id: 'ISO-10390-2021',
        authority: 'ISO',
        citation: 'ISO 10390:2021 Soil, treated biowaste and sludge — Determination of pH.',
        title: 'Soil pH Determination',
        year: 2021,
        url: 'https://www.iso.org/standard/74728.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-11265-1994',
        authority: 'ISO',
        citation: 'ISO 11265:1994 Soil quality — Determination of the specific electrical conductivity.',
        title: 'Determination of Specific Electrical Conductivity',
        year: 1994,
        url: 'https://www.iso.org/standard/19243.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-10694-1995',
        authority: 'ISO',
        citation: 'ISO 10694:1995 Soil quality — Determination of organic and total carbon after dry combustion (elementary analysis).',
        title: 'Organic and Total Carbon by Dry Combustion',
        year: 1995,
        url: 'https://www.iso.org/standard/18791.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-14235-1998',
        authority: 'ISO',
        citation: 'ISO 14235:1998 Soil quality — Determination of organic carbon by sulfochromic oxidation.',
        title: 'Organic Carbon by Sulfochromic Oxidation (Walkley-Black)',
        year: 1998,
        url: 'https://www.iso.org/standard/24218.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-11261-1995',
        authority: 'ISO',
        citation: 'ISO 11261:1995 Soil quality — Determination of total nitrogen — Modified Kjeldahl method.',
        title: 'Total Nitrogen by Modified Kjeldahl',
        year: 1995,
        url: 'https://www.iso.org/standard/19239.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-13878-1998',
        authority: 'ISO',
        citation: 'ISO 13878:1998 Soil quality — Determination of total nitrogen content by dry combustion ("elemental analysis").',
        title: 'Total Nitrogen Content by Dry Combustion',
        year: 1998,
        url: 'https://www.iso.org/standard/22904.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-11263-1994',
        authority: 'ISO',
        citation: 'ISO 11263:1994 Soil quality — Determination of phosphorus — Spectrometric determination of phosphorus soluble in sodium hydrogen carbonate solution.',
        title: 'Phosphorus Soluble in Sodium Hydrogen Carbonate (Olsen P)',
        year: 1994,
        url: 'https://www.iso.org/standard/19241.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-11260-1994',
        authority: 'ISO',
        citation: 'ISO 11260:1994 Soil quality — Determination of effective cation exchange capacity and base saturation level using barium chloride solution.',
        title: 'Effective CEC and Base Saturation (BaCl2 Solution)',
        year: 1994,
        url: 'https://www.iso.org/standard/19238.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-14254-2018',
        authority: 'ISO',
        citation: 'ISO 14254:2018 Soil quality — Determination of exchangeable acidity in barium chloride extracts.',
        title: 'Determination of Exchangeable Acidity in Barium Chloride Extracts',
        year: 2018,
        url: 'https://www.iso.org/standard/70366.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-23470-2018',
        authority: 'ISO',
        citation: 'ISO 23470:2018 Soil quality — Determination of effective cation exchange capacity (CEC) and exchangeable cations using a hexamminecobalt trichloride solution.',
        title: 'Effective CEC and Exchangeable Cations by Hexamminecobalt(III) Chloride',
        year: 2018,
        url: 'https://www.iso.org/standard/70570.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-11277-2020',
        authority: 'ISO',
        citation: 'ISO 11277:2020 Soil quality — Determination of particle size distribution in mineral soil material — Method by sieving and sedimentation.',
        title: 'Particle Size Distribution by Sieving and Pipette Sedimentation',
        year: 2020,
        url: 'https://www.iso.org/standard/74729.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-11272-2017',
        authority: 'ISO',
        citation: 'ISO 11272:2017 Soil quality — Determination of dry bulk density.',
        title: 'Determination of Dry Bulk Density by Core Cylinder',
        year: 2017,
        url: 'https://www.iso.org/standard/66597.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-10693-1995',
        authority: 'ISO',
        citation: 'ISO 10693:1995 Soil quality — Determination of carbonate content — Volumetric method.',
        title: 'Carbonate Content by Bernard Calcimeter Volumetry',
        year: 1995,
        url: 'https://www.iso.org/standard/18790.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-14870-2001',
        authority: 'ISO',
        citation: 'ISO 14870:2001 Soil quality — Extraction of trace elements by buffered DTPA solution.',
        title: 'Trace Element Extraction by Buffered DTPA Solution',
        year: 2001,
        url: 'https://www.iso.org/standard/25852.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-11466-1995',
        authority: 'ISO',
        citation: 'ISO 11466:1995 Soil quality — Extraction of trace elements soluble in aqua regia.',
        title: 'Extraction of Trace Elements Soluble in Aqua Regia',
        year: 1995,
        url: 'https://www.iso.org/standard/19419.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-11464-2006',
        authority: 'ISO',
        citation: 'ISO 11464:2006 Soil quality — Pretreatment of samples for physico-chemical analysis.',
        title: 'Pretreatment of Samples (Air Drying, Crushing, Sieving to <2 mm)',
        year: 2006,
        url: 'https://www.iso.org/standard/38072.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-11465-1993',
        authority: 'ISO',
        citation: 'ISO 11465:1993 Soil quality — Determination of dry matter and water content on a mass basis — Gravimetric method.',
        title: 'Determination of Dry Matter and Water Content Gravimetrically',
        year: 1993,
        url: 'https://www.iso.org/standard/19418.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-14258-2008',
        authority: 'ISO',
        citation: 'ISO 14258:2008 Soil quality — Determination of urease activity.',
        title: 'Determination of Soil Urease Activity',
        year: 2008,
        url: 'https://www.iso.org/standard/37397.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-10930-2012',
        authority: 'ISO',
        citation: 'ISO 10930:2012 Soil quality — Measurement of the stability of soil aggregates subjected to the action of water.',
        title: 'Aggregate Stability Subjected to Action of Water',
        year: 2012,
        url: 'https://www.iso.org/standard/51296.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-14240-1-1997',
        authority: 'ISO',
        citation: 'ISO 14240-1:1997 Soil quality — Determination of soil microbial biomass — Part 1: Substrate-induced respiration method.',
        title: 'Soil Microbial Biomass — Substrate-Induced Respiration',
        year: 1997,
        url: 'https://www.iso.org/standard/24222.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-14240-2-1997',
        authority: 'ISO',
        citation: 'ISO 14240-2:1997 Soil quality — Determination of soil microbial biomass — Part 2: Fumigation-extraction method.',
        title: 'Soil Microbial Biomass — Chloroform Fumigation Extraction',
        year: 1997,
        url: 'https://www.iso.org/standard/24223.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-11274-2019',
        authority: 'ISO',
        citation: 'ISO 11274:2019 Soil quality — Determination of the water-retention characteristic — Laboratory methods.',
        title: 'Water Retention Characteristic — Sand, Kaolin and Pressure Cells',
        year: 2019,
        url: 'https://www.iso.org/standard/66598.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-17380-2013',
        authority: 'ISO',
        citation: 'ISO 17380:2013 Soil quality — Determination of total cyanide and easily released cyanide — Continuous-flow analysis method.',
        title: 'Determination of Total and Easily Released Cyanide',
        year: 2013,
        url: 'https://www.iso.org/standard/57788.html',
        status: 'ACTIVE'
    },
    {
        id: 'ISO-22036-2008',
        authority: 'ISO',
        citation: 'ISO 22036:2008 Soil quality — Determination of trace elements in extracts of soil by inductively coupled plasma - atomic emission spectrometry (ICP-AES).',
        title: 'Determination of Trace Elements in Soil Extracts by ICP-AES',
        year: 2008,
        url: 'https://www.iso.org/standard/38075.html',
        status: 'ACTIVE'
    },

    // --- Literature and Reference Handbook Methods ---
    {
        id: 'USDA-HB60',
        authority: 'USDA',
        citation: 'U.S. Salinity Laboratory Staff (1954) Diagnosis and Improvement of Saline and Alkali Soils. USDA Agriculture Handbook No. 60, Washington, D.C.',
        title: 'Diagnosis and Improvement of Saline and Alkali Soils (Saturated Paste)',
        year: 1954,
        url: 'https://www.ars.usda.gov/pacific-west-area/riverside-ca/agricultural-water-efficiency-and-salinity-research-unit/docs/handbook-60/',
        status: 'ACTIVE'
    },
    {
        id: 'BRAY-KURTZ-1945',
        authority: 'Literature',
        citation: 'Bray, R.H. and Kurtz, L.T. (1945) Determination of total, organic, and available forms of phosphorus in soils. Soil Science, 59, 39-46.',
        title: 'Determination of Available Phosphorus (Bray 1 and Bray 2)',
        year: 1945,
        url: 'https://doi.org/10.1097/00010694-194501000-00006',
        status: 'ACTIVE'
    },
    {
        id: 'MEHLICH-1984',
        authority: 'Literature',
        citation: 'Mehlich, A. (1984) Mehlich 3 soil test extractant: A modification of Mehlich 2 extractant. Communications in Soil Science and Plant Analysis, 15, 1409-1416.',
        title: 'Mehlich 3 Multi-Nutrient Extractant',
        year: 1984,
        url: 'https://doi.org/10.1080/00103628409367568',
        status: 'ACTIVE'
    },
    {
        id: 'MEHLICH-1953',
        authority: 'Literature',
        citation: 'Mehlich, A. (1953) Rapid determination of cation and anion exchange properties and pHe of soils. Mimeograph, North Carolina Department of Agriculture.',
        title: 'Mehlich 1 Double Acid Extractant',
        year: 1953,
        url: 'https://cir.nii.ac.jp/crid/1570572700516598528',
        status: 'ACTIVE'
    },
    {
        id: 'WALKLEY-BLACK-1934',
        authority: 'Literature',
        citation: 'Walkley, A. and Black, I.A. (1934) An examination of the Degtjareff method for determining soil organic matter, and a proposed modification of the chromic acid titration method. Soil Science, 37, 29-38.',
        title: 'Chromic Acid Wet Oxidation for Soil Organic Carbon',
        year: 1934,
        url: 'https://doi.org/10.1097/00010694-193401000-00003',
        status: 'ACTIVE'
    },
    {
        id: 'OLSEN-1954',
        authority: 'Literature',
        citation: 'Olsen, S.R., Cole, C.V., Watanabe, F.S. and Dean, L.A. (1954) Estimation of available phosphorus in soils by extraction with sodium bicarbonate. USDA Circular 939.',
        title: 'Estimation of Available Phosphorus in Soils by Sodium Bicarbonate Extraction',
        year: 1954,
        url: 'https://naldc.nal.usda.gov/download/CAT87201104/PDF',
        status: 'ACTIVE'
    },
    {
        id: 'DROUINEAU-1942',
        authority: 'Literature',
        citation: 'Drouineau, G. (1942) Dosage rapide du calcaire actif du sol: nouvelles donnees sur la repartition et la nature des fractions calcaires. Annales Agronomiques, 12, 441-450.',
        title: 'Active Carbonate by Ammonium Oxalate Extraction',
        year: 1942,
        url: null,
        status: 'ACTIVE'
    },
    {
        id: 'TABATABAI-1982',
        authority: 'Literature',
        citation: 'Tabatabai, M.A. (1982) Soil enzymes. In: Page, A.L., Ed., Methods of Soil Analysis, Part 2: Chemical and Microbiological Properties, Agronomy Monograph No. 9, Madison, 903-947.',
        title: 'Soil Enzymes Assay (Urease, β-Glucosidase, Phosphatase)',
        year: 1982,
        url: 'https://doi.org/10.2134/agronmonogr9.2.2ed.c43',
        status: 'ACTIVE'
    },
    {
        id: 'THOMAS-1982',
        authority: 'Literature',
        citation: 'Thomas, G.W. (1982) Exchangeable cations. In: Page, A.L., Ed., Methods of Soil Analysis, Part 2: Chemical and Microbiological Properties, Agronomy Monograph No. 9, Madison, 159-165.',
        title: 'Exchangeable Acidity and Aluminum by 1 M KCl Titration',
        year: 1982,
        url: 'https://doi.org/10.2134/agronmonogr9.2.2ed.c9',
        status: 'ACTIVE'
    },
    {
        id: 'RAYMENT-LYONS-2011',
        authority: 'Literature',
        citation: 'Rayment, G.E. and Lyons, D.J. (2011) Soil Chemical Methods: Australasia. CSIRO Publishing, Collingwood.',
        title: 'Soil Chemical Methods — Australasia Reference Handbook',
        year: 2011,
        url: 'https://doi.org/10.1071/9780643101364',
        status: 'ACTIVE'
    }
];

async function seedReferences(prismaClient) {
    const prisma = prismaClient || require('../prisma');
    console.log(`[SEED] Seeding ${REFERENCES.length} method references...`);
    let count = 0;
    for (const ref of REFERENCES) {
        await prisma.methodReference.upsert({
            where: { id: ref.id },
            update: {
                authority: ref.authority,
                citation: ref.citation,
                title: ref.title,
                year: ref.year,
                url: ref.url,
                status: ref.status
            },
            create: ref
        });
        count++;
    }
    console.log(`[SEED] Successfully seeded ${count} method references.`);
    return count;
}

if (require.main === module) {
    const prisma = require('../prisma');
    seedReferences(prisma)
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Failed to seed method references:', err);
            process.exit(1);
        });
}

module.exports = { REFERENCES, seedReferences };
