require('dotenv').config();
const prisma = require('../prisma');

// ─── Native translations for all 92 dynamic keys ────────────────────────────

const translations = {
    fr: {
        // ─── Analyses: Physical ─────────────────────────────────────────
        "dynamic.analysis.PH_H2O.name": "pH (Eau)",
        "dynamic.analysis.EC.name": "Conductivité électrique",
        "dynamic.analysis.SAND.name": "Teneur en sable",
        "dynamic.analysis.SILT.name": "Teneur en limon",
        "dynamic.analysis.CLAY.name": "Teneur en argile",
        "dynamic.analysis.TEXTURE.name": "Texture du sol (Sable/Limon/Argile)",
        "dynamic.analysis.BD.name": "Masse volumique apparente",
        "dynamic.analysis.MOISTURE.name": "Teneur en humidité",
        "dynamic.analysis.WHC.name": "Capacité de rétention en eau",
        "dynamic.analysis.POROSITY.name": "Porosité",
        "dynamic.analysis.COLOUR.name": "Couleur du sol (Munsell)",
        "dynamic.analysis.AGG_STAB.name": "Stabilité des agrégats",

        // ─── Analyses: Chemical ─────────────────────────────────────────
        "dynamic.analysis.SOC.name": "Carbone organique du sol",
        "dynamic.analysis.N_TOT.name": "Azote total",
        "dynamic.analysis.P_AVAIL.name": "Phosphore assimilable",
        "dynamic.analysis.K_EXCH.name": "Potassium échangeable",
        "dynamic.analysis.PH_KCL.name": "pH (KCl)",
        "dynamic.analysis.PH_CACL2.name": "pH (CaCl₂)",
        "dynamic.analysis.OC.name": "Carbone organique",
        "dynamic.analysis.OM.name": "Matière organique",
        "dynamic.analysis.TN.name": "Azote total",
        "dynamic.analysis.CN_RATIO.name": "Ratio C:N",
        "dynamic.analysis.CEC.name": "Capacité d'échange cationique",
        "dynamic.analysis.ECEC.name": "CEC effective",
        "dynamic.analysis.BS.name": "Taux de saturation en bases",
        "dynamic.analysis.LIME_REQ.name": "Besoin en chaulage",
        "dynamic.analysis.CACO3.name": "Carbonate de calcium (Calcaire libre)",
        "dynamic.analysis.AL_SAT.name": "Saturation en aluminium",

        // ─── Analyses: Nutrients ────────────────────────────────────────
        "dynamic.analysis.P_OLSEN.name": "Phosphore assimilable (Olsen)",
        "dynamic.analysis.P_BRAY.name": "Phosphore assimilable (Bray-1)",
        "dynamic.analysis.P_MEHLICH.name": "Phosphore assimilable (Mehlich-3)",
        "dynamic.analysis.CA_EXCH.name": "Calcium échangeable",
        "dynamic.analysis.MG_EXCH.name": "Magnésium échangeable",
        "dynamic.analysis.NA_EXCH.name": "Sodium échangeable",
        "dynamic.analysis.AL_EXCH.name": "Aluminium échangeable",
        "dynamic.analysis.S_AVAIL.name": "Soufre assimilable",
        "dynamic.analysis.NO3.name": "Azote nitrique",
        "dynamic.analysis.NH4.name": "Azote ammoniacal",
        "dynamic.analysis.MIN_N.name": "Azote minéral (NO₃ + NH₄)",

        // ─── Analyses: Micronutrients ───────────────────────────────────
        "dynamic.analysis.FE_DTPA.name": "Fer (DTPA)",
        "dynamic.analysis.ZN_DTPA.name": "Zinc (DTPA)",
        "dynamic.analysis.MN_DTPA.name": "Manganèse (DTPA)",
        "dynamic.analysis.CU_DTPA.name": "Cuivre (DTPA)",
        "dynamic.analysis.B_HW.name": "Bore (Eau chaude)",
        "dynamic.analysis.MO.name": "Molybdène",

        // ─── Analyses: Biological ───────────────────────────────────────
        "dynamic.analysis.MBC.name": "Carbone de la biomasse microbienne",
        "dynamic.analysis.MBN.name": "Azote de la biomasse microbienne",
        "dynamic.analysis.RESP.name": "Respiration du sol (CO₂)",
        "dynamic.analysis.PHOS_ACT.name": "Activité phosphatasique",
        "dynamic.analysis.DEHYDRO.name": "Activité de la déshydrogénase",

        // ─── Analyses: Spectral ─────────────────────────────────────────
        "dynamic.analysis.SPECTRAL.name": "Analyse spectrale",
        "dynamic.analysis.SPEC_VIS_NIR.name": "Spectroscopie visible-proche infrarouge",
        "dynamic.analysis.SPEC_MIR.name": "Spectroscopie moyen infrarouge",
        "dynamic.analysis.XRF.name": "Fluorescence X",
        "dynamic.analysis.LIBS.name": "Spectroscopie de plasma induit par laser",

        // ─── Analyses: Contamination ────────────────────────────────────
        "dynamic.analysis.PB_TOTAL.name": "Plomb total",
        "dynamic.analysis.CD_TOTAL.name": "Cadmium total",
        "dynamic.analysis.CR_TOTAL.name": "Chrome total",
        "dynamic.analysis.NI_TOTAL.name": "Nickel total",
        "dynamic.analysis.AS_TOTAL.name": "Arsenic total",
        "dynamic.analysis.HG_TOTAL.name": "Mercure total",

        // ─── Analyses: Salinity ─────────────────────────────────────────
        "dynamic.analysis.SAR.name": "Taux d'adsorption du sodium",
        "dynamic.analysis.ESP.name": "Pourcentage de sodium échangeable",
        "dynamic.analysis.TDS.name": "Total des solides dissous",

        // ─── Analyses: Preparation ──────────────────────────────────────
        "dynamic.analysis.DRYING.name": "Séchage de l'échantillon",
        "dynamic.analysis.PREPARATION.name": "Préparation de l'échantillon",

        // ─── Operational Gates ──────────────────────────────────────────
        "dynamic.gate.RECEIVING.name": "Réception et enregistrement de l'échantillon",
        "dynamic.gate.DRYING.name": "Séchage à l'air (40°C)",
        "dynamic.gate.GRINDING.name": "Broyage / Concassage",
        "dynamic.gate.SIEVING.name": "Tamisage (< 2mm)",
        "dynamic.gate.SUBSAMPLING.name": "Sous-échantillonnage / Division",
        "dynamic.gate.PREPARATION.name": "Préparation analytique",

        // ─── Categories ─────────────────────────────────────────────────
        "dynamic.category.physical.name": "Propriétés physiques",
        "dynamic.category.chemical.name": "Propriétés chimiques",
        "dynamic.category.nutrient.name": "Éléments nutritifs des plantes",
        "dynamic.category.micronutrient.name": "Oligo-éléments et éléments traces",
        "dynamic.category.biological.name": "Propriétés biologiques",
        "dynamic.category.spectral.name": "Analyse spectrale",
        "dynamic.category.contamination.name": "Contamination et métaux lourds",
        "dynamic.category.salinity.name": "Salinité et sodicité",

        // ─── Equipment Types ────────────────────────────────────────────
        "dynamic.equipmentType.SPECTROMETER.label": "Spectromètre",
        "dynamic.equipmentType.BALANCE.label": "Balance",
        "dynamic.equipmentType.OVEN.label": "Étuve",
        "dynamic.equipmentType.PH_METER.label": "pH-mètre",
        "dynamic.equipmentType.EC_METER.label": "Conductimètre",

        // ─── Statuses ───────────────────────────────────────────────────
        "dynamic.status.EXPECTED.label": "Attendu",
        "dynamic.status.RECEIVED.label": "Reçu",
        "dynamic.status.ACCEPTED.label": "Accepté",
        "dynamic.status.PROCESSING.label": "En traitement",
        "dynamic.status.DONE.label": "Terminé",
        "dynamic.status.FAILED.label": "Échoué",
        "dynamic.status.ARCHIVED.label": "Archivé"
    },

    es: {
        // ─── Analyses: Physical ─────────────────────────────────────────
        "dynamic.analysis.PH_H2O.name": "pH (Agua)",
        "dynamic.analysis.EC.name": "Conductividad eléctrica",
        "dynamic.analysis.SAND.name": "Contenido de arena",
        "dynamic.analysis.SILT.name": "Contenido de limo",
        "dynamic.analysis.CLAY.name": "Contenido de arcilla",
        "dynamic.analysis.TEXTURE.name": "Textura del suelo (Arena/Limo/Arcilla)",
        "dynamic.analysis.BD.name": "Densidad aparente",
        "dynamic.analysis.MOISTURE.name": "Contenido de humedad",
        "dynamic.analysis.WHC.name": "Capacidad de retención de agua",
        "dynamic.analysis.POROSITY.name": "Porosidad",
        "dynamic.analysis.COLOUR.name": "Color del suelo (Munsell)",
        "dynamic.analysis.AGG_STAB.name": "Estabilidad de agregados",

        // ─── Analyses: Chemical ─────────────────────────────────────────
        "dynamic.analysis.SOC.name": "Carbono orgánico del suelo",
        "dynamic.analysis.N_TOT.name": "Nitrógeno total",
        "dynamic.analysis.P_AVAIL.name": "Fósforo disponible",
        "dynamic.analysis.K_EXCH.name": "Potasio intercambiable",
        "dynamic.analysis.PH_KCL.name": "pH (KCl)",
        "dynamic.analysis.PH_CACL2.name": "pH (CaCl₂)",
        "dynamic.analysis.OC.name": "Carbono orgánico",
        "dynamic.analysis.OM.name": "Materia orgánica",
        "dynamic.analysis.TN.name": "Nitrógeno total",
        "dynamic.analysis.CN_RATIO.name": "Relación C:N",
        "dynamic.analysis.CEC.name": "Capacidad de intercambio catiónico",
        "dynamic.analysis.ECEC.name": "CIC efectiva",
        "dynamic.analysis.BS.name": "Saturación de bases",
        "dynamic.analysis.LIME_REQ.name": "Necesidad de encalado",
        "dynamic.analysis.CACO3.name": "Carbonato de calcio (Cal libre)",
        "dynamic.analysis.AL_SAT.name": "Saturación de aluminio",

        // ─── Analyses: Nutrients ────────────────────────────────────────
        "dynamic.analysis.P_OLSEN.name": "Fósforo disponible (Olsen)",
        "dynamic.analysis.P_BRAY.name": "Fósforo disponible (Bray-1)",
        "dynamic.analysis.P_MEHLICH.name": "Fósforo disponible (Mehlich-3)",
        "dynamic.analysis.CA_EXCH.name": "Calcio intercambiable",
        "dynamic.analysis.MG_EXCH.name": "Magnesio intercambiable",
        "dynamic.analysis.NA_EXCH.name": "Sodio intercambiable",
        "dynamic.analysis.AL_EXCH.name": "Aluminio intercambiable",
        "dynamic.analysis.S_AVAIL.name": "Azufre disponible",
        "dynamic.analysis.NO3.name": "Nitrógeno nítrico",
        "dynamic.analysis.NH4.name": "Nitrógeno amoniacal",
        "dynamic.analysis.MIN_N.name": "Nitrógeno mineral (NO₃ + NH₄)",

        // ─── Analyses: Micronutrients ───────────────────────────────────
        "dynamic.analysis.FE_DTPA.name": "Hierro (DTPA)",
        "dynamic.analysis.ZN_DTPA.name": "Zinc (DTPA)",
        "dynamic.analysis.MN_DTPA.name": "Manganeso (DTPA)",
        "dynamic.analysis.CU_DTPA.name": "Cobre (DTPA)",
        "dynamic.analysis.B_HW.name": "Boro (Agua caliente)",
        "dynamic.analysis.MO.name": "Molibdeno",

        // ─── Analyses: Biological ───────────────────────────────────────
        "dynamic.analysis.MBC.name": "Carbono de la biomasa microbiana",
        "dynamic.analysis.MBN.name": "Nitrógeno de la biomasa microbiana",
        "dynamic.analysis.RESP.name": "Respiración del suelo (CO₂)",
        "dynamic.analysis.PHOS_ACT.name": "Actividad fosfatasa",
        "dynamic.analysis.DEHYDRO.name": "Actividad deshidrogenasa",

        // ─── Analyses: Spectral ─────────────────────────────────────────
        "dynamic.analysis.SPECTRAL.name": "Análisis espectral",
        "dynamic.analysis.SPEC_VIS_NIR.name": "Espectroscopía visible-infrarrojo cercano",
        "dynamic.analysis.SPEC_MIR.name": "Espectroscopía infrarrojo medio",
        "dynamic.analysis.XRF.name": "Fluorescencia de rayos X",
        "dynamic.analysis.LIBS.name": "Espectroscopía de plasma inducido por láser",

        // ─── Analyses: Contamination ────────────────────────────────────
        "dynamic.analysis.PB_TOTAL.name": "Plomo total",
        "dynamic.analysis.CD_TOTAL.name": "Cadmio total",
        "dynamic.analysis.CR_TOTAL.name": "Cromo total",
        "dynamic.analysis.NI_TOTAL.name": "Níquel total",
        "dynamic.analysis.AS_TOTAL.name": "Arsénico total",
        "dynamic.analysis.HG_TOTAL.name": "Mercurio total",

        // ─── Analyses: Salinity ─────────────────────────────────────────
        "dynamic.analysis.SAR.name": "Relación de adsorción de sodio",
        "dynamic.analysis.ESP.name": "Porcentaje de sodio intercambiable",
        "dynamic.analysis.TDS.name": "Sólidos disueltos totales",

        // ─── Analyses: Preparation ──────────────────────────────────────
        "dynamic.analysis.DRYING.name": "Secado de muestra",
        "dynamic.analysis.PREPARATION.name": "Preparación de muestra",

        // ─── Operational Gates ──────────────────────────────────────────
        "dynamic.gate.RECEIVING.name": "Recepción y registro de muestra",
        "dynamic.gate.DRYING.name": "Secado al aire (40°C)",
        "dynamic.gate.GRINDING.name": "Molienda / Trituración",
        "dynamic.gate.SIEVING.name": "Tamizado (< 2mm)",
        "dynamic.gate.SUBSAMPLING.name": "Submuestreo / División",
        "dynamic.gate.PREPARATION.name": "Preparación analítica",

        // ─── Categories ─────────────────────────────────────────────────
        "dynamic.category.physical.name": "Propiedades físicas",
        "dynamic.category.chemical.name": "Propiedades químicas",
        "dynamic.category.nutrient.name": "Nutrientes vegetales",
        "dynamic.category.micronutrient.name": "Micronutrientes y elementos traza",
        "dynamic.category.biological.name": "Propiedades biológicas",
        "dynamic.category.spectral.name": "Análisis espectral",
        "dynamic.category.contamination.name": "Contaminación y metales pesados",
        "dynamic.category.salinity.name": "Salinidad y sodicidad",

        // ─── Equipment Types ────────────────────────────────────────────
        "dynamic.equipmentType.SPECTROMETER.label": "Espectrómetro",
        "dynamic.equipmentType.BALANCE.label": "Balanza",
        "dynamic.equipmentType.OVEN.label": "Horno",
        "dynamic.equipmentType.PH_METER.label": "Medidor de pH",
        "dynamic.equipmentType.EC_METER.label": "Conductímetro",

        // ─── Statuses ───────────────────────────────────────────────────
        "dynamic.status.EXPECTED.label": "Esperado",
        "dynamic.status.RECEIVED.label": "Recibido",
        "dynamic.status.ACCEPTED.label": "Aceptado",
        "dynamic.status.PROCESSING.label": "Procesando",
        "dynamic.status.DONE.label": "Completado",
        "dynamic.status.FAILED.label": "Fallido",
        "dynamic.status.ARCHIVED.label": "Archivado"
    },

    pt: {
        // ─── Analyses: Physical ─────────────────────────────────────────
        "dynamic.analysis.PH_H2O.name": "pH (Água)",
        "dynamic.analysis.EC.name": "Condutividade elétrica",
        "dynamic.analysis.SAND.name": "Teor de areia",
        "dynamic.analysis.SILT.name": "Teor de silte",
        "dynamic.analysis.CLAY.name": "Teor de argila",
        "dynamic.analysis.TEXTURE.name": "Textura do solo (Areia/Silte/Argila)",
        "dynamic.analysis.BD.name": "Densidade do solo",
        "dynamic.analysis.MOISTURE.name": "Teor de umidade",
        "dynamic.analysis.WHC.name": "Capacidade de retenção de água",
        "dynamic.analysis.POROSITY.name": "Porosidade",
        "dynamic.analysis.COLOUR.name": "Cor do solo (Munsell)",
        "dynamic.analysis.AGG_STAB.name": "Estabilidade de agregados",

        // ─── Analyses: Chemical ─────────────────────────────────────────
        "dynamic.analysis.SOC.name": "Carbono orgânico do solo",
        "dynamic.analysis.N_TOT.name": "Nitrogênio total",
        "dynamic.analysis.P_AVAIL.name": "Fósforo disponível",
        "dynamic.analysis.K_EXCH.name": "Potássio trocável",
        "dynamic.analysis.PH_KCL.name": "pH (KCl)",
        "dynamic.analysis.PH_CACL2.name": "pH (CaCl₂)",
        "dynamic.analysis.OC.name": "Carbono orgânico",
        "dynamic.analysis.OM.name": "Matéria orgânica",
        "dynamic.analysis.TN.name": "Nitrogênio total",
        "dynamic.analysis.CN_RATIO.name": "Relação C:N",
        "dynamic.analysis.CEC.name": "Capacidade de troca catiônica",
        "dynamic.analysis.ECEC.name": "CTC efetiva",
        "dynamic.analysis.BS.name": "Saturação de bases",
        "dynamic.analysis.LIME_REQ.name": "Necessidade de calagem",
        "dynamic.analysis.CACO3.name": "Carbonato de cálcio (Calcário livre)",
        "dynamic.analysis.AL_SAT.name": "Saturação de alumínio",

        // ─── Analyses: Nutrients ────────────────────────────────────────
        "dynamic.analysis.P_OLSEN.name": "Fósforo disponível (Olsen)",
        "dynamic.analysis.P_BRAY.name": "Fósforo disponível (Bray-1)",
        "dynamic.analysis.P_MEHLICH.name": "Fósforo disponível (Mehlich-3)",
        "dynamic.analysis.CA_EXCH.name": "Cálcio trocável",
        "dynamic.analysis.MG_EXCH.name": "Magnésio trocável",
        "dynamic.analysis.NA_EXCH.name": "Sódio trocável",
        "dynamic.analysis.AL_EXCH.name": "Alumínio trocável",
        "dynamic.analysis.S_AVAIL.name": "Enxofre disponível",
        "dynamic.analysis.NO3.name": "Nitrogênio nítrico",
        "dynamic.analysis.NH4.name": "Nitrogênio amoniacal",
        "dynamic.analysis.MIN_N.name": "Nitrogênio mineral (NO₃ + NH₄)",

        // ─── Analyses: Micronutrients ───────────────────────────────────
        "dynamic.analysis.FE_DTPA.name": "Ferro (DTPA)",
        "dynamic.analysis.ZN_DTPA.name": "Zinco (DTPA)",
        "dynamic.analysis.MN_DTPA.name": "Manganês (DTPA)",
        "dynamic.analysis.CU_DTPA.name": "Cobre (DTPA)",
        "dynamic.analysis.B_HW.name": "Boro (Água quente)",
        "dynamic.analysis.MO.name": "Molibdênio",

        // ─── Analyses: Biological ───────────────────────────────────────
        "dynamic.analysis.MBC.name": "Carbono da biomassa microbiana",
        "dynamic.analysis.MBN.name": "Nitrogênio da biomassa microbiana",
        "dynamic.analysis.RESP.name": "Respiração do solo (CO₂)",
        "dynamic.analysis.PHOS_ACT.name": "Atividade fosfatásica",
        "dynamic.analysis.DEHYDRO.name": "Atividade da desidrogenase",

        // ─── Analyses: Spectral ─────────────────────────────────────────
        "dynamic.analysis.SPECTRAL.name": "Análise espectral",
        "dynamic.analysis.SPEC_VIS_NIR.name": "Espectroscopia visível-infravermelho próximo",
        "dynamic.analysis.SPEC_MIR.name": "Espectroscopia infravermelho médio",
        "dynamic.analysis.XRF.name": "Fluorescência de raios X",
        "dynamic.analysis.LIBS.name": "Espectroscopia de plasma induzido por laser",

        // ─── Analyses: Contamination ────────────────────────────────────
        "dynamic.analysis.PB_TOTAL.name": "Chumbo total",
        "dynamic.analysis.CD_TOTAL.name": "Cádmio total",
        "dynamic.analysis.CR_TOTAL.name": "Cromo total",
        "dynamic.analysis.NI_TOTAL.name": "Níquel total",
        "dynamic.analysis.AS_TOTAL.name": "Arsênio total",
        "dynamic.analysis.HG_TOTAL.name": "Mercúrio total",

        // ─── Analyses: Salinity ─────────────────────────────────────────
        "dynamic.analysis.SAR.name": "Razão de adsorção de sódio",
        "dynamic.analysis.ESP.name": "Percentagem de sódio trocável",
        "dynamic.analysis.TDS.name": "Sólidos dissolvidos totais",

        // ─── Analyses: Preparation ──────────────────────────────────────
        "dynamic.analysis.DRYING.name": "Secagem da amostra",
        "dynamic.analysis.PREPARATION.name": "Preparação da amostra",

        // ─── Operational Gates ──────────────────────────────────────────
        "dynamic.gate.RECEIVING.name": "Recepção e registro da amostra",
        "dynamic.gate.DRYING.name": "Secagem ao ar (40°C)",
        "dynamic.gate.GRINDING.name": "Moagem / Trituração",
        "dynamic.gate.SIEVING.name": "Peneiramento (< 2mm)",
        "dynamic.gate.SUBSAMPLING.name": "Subamostragem / Divisão",
        "dynamic.gate.PREPARATION.name": "Preparação analítica",

        // ─── Categories ─────────────────────────────────────────────────
        "dynamic.category.physical.name": "Propriedades físicas",
        "dynamic.category.chemical.name": "Propriedades químicas",
        "dynamic.category.nutrient.name": "Nutrientes vegetais",
        "dynamic.category.micronutrient.name": "Micronutrientes e elementos traço",
        "dynamic.category.biological.name": "Propriedades biológicas",
        "dynamic.category.spectral.name": "Análise espectral",
        "dynamic.category.contamination.name": "Contaminação e metais pesados",
        "dynamic.category.salinity.name": "Salinidade e sodicidade",

        // ─── Equipment Types ────────────────────────────────────────────
        "dynamic.equipmentType.SPECTROMETER.label": "Espectrômetro",
        "dynamic.equipmentType.BALANCE.label": "Balança",
        "dynamic.equipmentType.OVEN.label": "Estufa",
        "dynamic.equipmentType.PH_METER.label": "Medidor de pH",
        "dynamic.equipmentType.EC_METER.label": "Condutivímetro",

        // ─── Statuses ───────────────────────────────────────────────────
        "dynamic.status.EXPECTED.label": "Esperado",
        "dynamic.status.RECEIVED.label": "Recebido",
        "dynamic.status.ACCEPTED.label": "Aceito",
        "dynamic.status.PROCESSING.label": "Processando",
        "dynamic.status.DONE.label": "Concluído",
        "dynamic.status.FAILED.label": "Falhou",
        "dynamic.status.ARCHIVED.label": "Arquivado"
    },

    "es-419": {
        // ─── Analyses: Physical ─────────────────────────────────────────
        "dynamic.analysis.PH_H2O.name": "pH (Agua)",
        "dynamic.analysis.EC.name": "Conductividad eléctrica",
        "dynamic.analysis.SAND.name": "Contenido de arena",
        "dynamic.analysis.SILT.name": "Contenido de limo",
        "dynamic.analysis.CLAY.name": "Contenido de arcilla",
        "dynamic.analysis.TEXTURE.name": "Textura del suelo (Arena/Limo/Arcilla)",
        "dynamic.analysis.BD.name": "Densidad aparente",
        "dynamic.analysis.MOISTURE.name": "Contenido de humedad",
        "dynamic.analysis.WHC.name": "Capacidad de retención de agua",
        "dynamic.analysis.POROSITY.name": "Porosidad",
        "dynamic.analysis.COLOUR.name": "Color del suelo (Munsell)",
        "dynamic.analysis.AGG_STAB.name": "Estabilidad de agregados",

        // ─── Analyses: Chemical ─────────────────────────────────────────
        "dynamic.analysis.SOC.name": "Carbono orgánico del suelo",
        "dynamic.analysis.N_TOT.name": "Nitrógeno total",
        "dynamic.analysis.P_AVAIL.name": "Fósforo disponible",
        "dynamic.analysis.K_EXCH.name": "Potasio intercambiable",
        "dynamic.analysis.PH_KCL.name": "pH (KCl)",
        "dynamic.analysis.PH_CACL2.name": "pH (CaCl₂)",
        "dynamic.analysis.OC.name": "Carbono orgánico",
        "dynamic.analysis.OM.name": "Materia orgánica",
        "dynamic.analysis.TN.name": "Nitrógeno total",
        "dynamic.analysis.CN_RATIO.name": "Relación C:N",
        "dynamic.analysis.CEC.name": "Capacidad de intercambio catiónico",
        "dynamic.analysis.ECEC.name": "CIC efectiva",
        "dynamic.analysis.BS.name": "Saturación de bases",
        "dynamic.analysis.LIME_REQ.name": "Requerimiento de encalado",
        "dynamic.analysis.CACO3.name": "Carbonato de calcio (Cal libre)",
        "dynamic.analysis.AL_SAT.name": "Saturación de aluminio",

        // ─── Analyses: Nutrients ────────────────────────────────────────
        "dynamic.analysis.P_OLSEN.name": "Fósforo disponible (Olsen)",
        "dynamic.analysis.P_BRAY.name": "Fósforo disponible (Bray-1)",
        "dynamic.analysis.P_MEHLICH.name": "Fósforo disponible (Mehlich-3)",
        "dynamic.analysis.CA_EXCH.name": "Calcio intercambiable",
        "dynamic.analysis.MG_EXCH.name": "Magnesio intercambiable",
        "dynamic.analysis.NA_EXCH.name": "Sodio intercambiable",
        "dynamic.analysis.AL_EXCH.name": "Aluminio intercambiable",
        "dynamic.analysis.S_AVAIL.name": "Azufre disponible",
        "dynamic.analysis.NO3.name": "Nitrógeno nítrico",
        "dynamic.analysis.NH4.name": "Nitrógeno amoniacal",
        "dynamic.analysis.MIN_N.name": "Nitrógeno mineral (NO₃ + NH₄)",

        // ─── Analyses: Micronutrients ───────────────────────────────────
        "dynamic.analysis.FE_DTPA.name": "Hierro (DTPA)",
        "dynamic.analysis.ZN_DTPA.name": "Zinc (DTPA)",
        "dynamic.analysis.MN_DTPA.name": "Manganeso (DTPA)",
        "dynamic.analysis.CU_DTPA.name": "Cobre (DTPA)",
        "dynamic.analysis.B_HW.name": "Boro (Agua caliente)",
        "dynamic.analysis.MO.name": "Molibdeno",

        // ─── Analyses: Biological ───────────────────────────────────────
        "dynamic.analysis.MBC.name": "Carbono de biomasa microbiana",
        "dynamic.analysis.MBN.name": "Nitrógeno de biomasa microbiana",
        "dynamic.analysis.RESP.name": "Respiración del suelo (CO₂)",
        "dynamic.analysis.PHOS_ACT.name": "Actividad fosfatasa",
        "dynamic.analysis.DEHYDRO.name": "Actividad deshidrogenasa",

        // ─── Analyses: Spectral ─────────────────────────────────────────
        "dynamic.analysis.SPECTRAL.name": "Análisis espectral",
        "dynamic.analysis.SPEC_VIS_NIR.name": "Espectroscopía visible-infrarrojo cercano",
        "dynamic.analysis.SPEC_MIR.name": "Espectroscopía infrarrojo medio",
        "dynamic.analysis.XRF.name": "Fluorescencia de rayos X",
        "dynamic.analysis.LIBS.name": "Espectroscopía de plasma inducido por láser",

        // ─── Analyses: Contamination ────────────────────────────────────
        "dynamic.analysis.PB_TOTAL.name": "Plomo total",
        "dynamic.analysis.CD_TOTAL.name": "Cadmio total",
        "dynamic.analysis.CR_TOTAL.name": "Cromo total",
        "dynamic.analysis.NI_TOTAL.name": "Níquel total",
        "dynamic.analysis.AS_TOTAL.name": "Arsénico total",
        "dynamic.analysis.HG_TOTAL.name": "Mercurio total",

        // ─── Analyses: Salinity ─────────────────────────────────────────
        "dynamic.analysis.SAR.name": "Razón de adsorción de sodio",
        "dynamic.analysis.ESP.name": "Porcentaje de sodio intercambiable",
        "dynamic.analysis.TDS.name": "Sólidos disueltos totales",

        // ─── Analyses: Preparation ──────────────────────────────────────
        "dynamic.analysis.DRYING.name": "Secado de muestra",
        "dynamic.analysis.PREPARATION.name": "Preparación de muestra",

        // ─── Operational Gates ──────────────────────────────────────────
        "dynamic.gate.RECEIVING.name": "Recepción y registro de muestra",
        "dynamic.gate.DRYING.name": "Secado al aire (40°C)",
        "dynamic.gate.GRINDING.name": "Molienda / Trituración",
        "dynamic.gate.SIEVING.name": "Tamizado (< 2mm)",
        "dynamic.gate.SUBSAMPLING.name": "Submuestreo / División",
        "dynamic.gate.PREPARATION.name": "Preparación analítica",

        // ─── Categories ─────────────────────────────────────────────────
        "dynamic.category.physical.name": "Propiedades físicas",
        "dynamic.category.chemical.name": "Propiedades químicas",
        "dynamic.category.nutrient.name": "Nutrientes vegetales",
        "dynamic.category.micronutrient.name": "Micronutrientes y elementos traza",
        "dynamic.category.biological.name": "Propiedades biológicas",
        "dynamic.category.spectral.name": "Análisis espectral",
        "dynamic.category.contamination.name": "Contaminación y metales pesados",
        "dynamic.category.salinity.name": "Salinidad y sodicidad",

        // ─── Equipment Types ────────────────────────────────────────────
        "dynamic.equipmentType.SPECTROMETER.label": "Espectrómetro",
        "dynamic.equipmentType.BALANCE.label": "Balanza",
        "dynamic.equipmentType.OVEN.label": "Horno",
        "dynamic.equipmentType.PH_METER.label": "Medidor de pH",
        "dynamic.equipmentType.EC_METER.label": "Conductímetro",

        // ─── Statuses ───────────────────────────────────────────────────
        "dynamic.status.EXPECTED.label": "Esperado",
        "dynamic.status.RECEIVED.label": "Recibido",
        "dynamic.status.ACCEPTED.label": "Aceptado",
        "dynamic.status.PROCESSING.label": "Procesando",
        "dynamic.status.DONE.label": "Completado",
        "dynamic.status.FAILED.label": "Fallido",
        "dynamic.status.ARCHIVED.label": "Archivado"
    }
};

async function main() {
    for (const [code, newKeys] of Object.entries(translations)) {
        // Get existing overrides
        const lang = await prisma.language.findUnique({ where: { code } });
        if (!lang) {
            console.log(`[SKIP] Language '${code}' not found in DB`);
            continue;
        }

        let existing = {};
        if (lang.translations) {
            try { existing = JSON.parse(lang.translations); } catch { }
        }

        // Merge: existing overrides take priority (don't overwrite manual edits)
        const merged = { ...newKeys, ...existing };

        await prisma.language.update({
            where: { code },
            data: { translations: JSON.stringify(merged) }
        });

        const added = Object.keys(newKeys).filter(k => !existing[k]).length;
        console.log(`[${code}] Updated: ${Object.keys(merged).length} total keys (${added} new, ${Object.keys(existing).length} preserved)`);
    }

    console.log('\nDone! Dynamic translations populated.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
