# Scientific terminology and translation review

## 1. Research conclusion

An analysis label must describe the measured property and its method context. Translate the concept, retain the method identity, and distinguish a measured value from a derived or predicted value. Soil methods cannot be made equivalent by giving them the same translated name. ISRIC's [WoSIS method-coding documentation](https://docs.isric.org/globaldata/wosis/faq-wosis.html) and [2025 method-description report](https://files.isric.org/public/documents/2025_WoSIS_coding_analytical_method_descriptions.pdf) are appropriate references for preserving property/procedure distinctions.

AGROVOC provides multilingual concepts, not a replacement for the laboratory's SOP. Its soil texture concept has French “texture du sol,” Spanish “textura del suelo,” and Portuguese “textura do solo.” Its cation-exchange concept includes Portuguese “capacidade de troca catiónica.” Use concepts and locale-specific preferred terms as evidence, then have a qualified reviewer check the exact application meaning: [texture concept](https://agrovoc.fao.org/browse/agrovoc/en/page/c_7199), [Spanish texture](https://agrovoc.fao.org/browse/agrovoc/en/page/c_7199?clang=es), [Portuguese texture](https://agrovoc.fao.org/browse/agrovoc/en/page/c_7199?clang=pt), [cation-exchange concept](https://agrovoc.fao.org/browse/agrovoc/en/page/c_24981?clang=ca).

Embrapa's [Manual de métodos de análise de solo, third edition](https://www.infoteca.cnptia.embrapa.br/handle/doc/1085209) covers physical, chemical, organic-matter, mineralogical and micromorphological analyses and is a strong Portuguese technical reference. Its [regional analytical manual](https://rolas.cnpt.embrapa.br/arquivos/manual_rolas.pdf) uses terms for electrical conductivity, particle-size analysis, cation exchange and organic carbon. Brazilian terminology/spelling must be adapted deliberately to the chosen Portuguese editorial profile rather than copied indiscriminately.

For spectroscopy, IRD uses French “spectroscopie dans le moyen infrarouge” in a soil study, while Embrapa uses “espectroscopia no infravermelho próximo.” These support the terminology, not validation of this platform's instrument/model configuration: [IRD soil MIR study](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers13-06/010056055.pdf), [Embrapa SpecSolo](https://www.embrapa.br/en/web/solos/busca-de-solucoes-tecnologicas/-/produto-servico/8668/specsolo).

## 2. Editorial decisions for five locales

- English: concise international laboratory language, sentence case, full method meaning in the details.
- Spanish (`es`): consistent scientific Spanish; retain existing locale identity without assuming every phrase needs Spain-specific wording.
- Latin American Spanish (`es-419`): regional operational vocabulary with the same scientific meaning. It is valid for most parameter names to match Spanish exactly.
- French: correct diacritics, scientific phrasing and readable abbreviations; do not translate silt as a different fraction or “available” as “total.”
- Portuguese (`pt`): propose a Mozambique-compatible institutional register. Confirm the choices azoto/nitrogénio, humidade/umidade, controlo/controle, and catiónica/catiônica with the lab reviewer. Store alternatives as searchable aliases where appropriate; never mix registers arbitrarily within one page.

Preserve chemical symbols (P, K, Ca, N), formulae, ratios, temperatures, sieves, wavelengths and method/version references. Label translation does not convert a reported quantity from P to P₂O₅, from whole soil to fine earth, or from mg/kg to another basis.

## 3. Proposed terminology examples

These are researched drafting examples, **not a certified complete translation set**. Each needs source-meaning and locale review before publication. The machine-readable draft stores this status explicitly. English here is a concept label; production method qualifiers must be appended from the exact configured method, not dropped.

| Concept | English | French | Spanish | Latin American Spanish | Portuguese proposal |
|---|---|---|---|---|---|
| pH in water | Soil pH in water | pH du sol dans l’eau | pH del suelo en agua | pH del suelo en agua | pH do solo em água |
| Electrical conductivity | Electrical conductivity | Conductivité électrique | Conductividad eléctrica | Conductividad eléctrica | Condutividade elétrica |
| Organic carbon | Soil organic carbon | Carbone organique du sol | Carbono orgánico del suelo | Carbono orgánico del suelo | Carbono orgânico do solo |
| Organic matter | Soil organic matter | Matière organique du sol | Materia orgánica del suelo | Materia orgánica del suelo | Matéria orgânica do solo |
| Total nitrogen | Total nitrogen | Azote total | Nitrógeno total | Nitrógeno total | Azoto total |
| CEC | Cation exchange capacity | Capacité d’échange cationique | Capacidad de intercambio catiónico | Capacidad de intercambio catiónico | Capacidade de troca catiónica |
| Effective CEC | Effective cation exchange capacity | Capacité d’échange cationique effective | Capacidad de intercambio catiónico efectiva | Capacidad de intercambio catiónico efectiva | Capacidade de troca catiónica efetiva |
| Olsen P | Extractable phosphorus — Olsen method | Phosphore extractible — méthode Olsen | Fósforo extraíble — método Olsen | Fósforo extraíble — método Olsen | Fósforo extraível — método Olsen |
| Exchangeable acidity | Exchangeable acidity | Acidité échangeable | Acidez intercambiable | Acidez intercambiable | Acidez de troca |
| Texture panel | Particle-size analysis: sand, silt and clay | Analyse granulométrique : sable, limon et argile | Análisis granulométrico: arena, limo y arcilla | Análisis granulométrico: arena, limo y arcilla | Análise granulométrica: areia, silte e argila |
| Sand | Sand fraction | Fraction sableuse | Fracción de arena | Fracción de arena | Fração de areia |
| Silt | Silt fraction | Fraction limoneuse | Fracción de limo | Fracción de limo | Fração de silte |
| Clay | Clay fraction | Fraction argileuse | Fracción de arcilla | Fracción de arcilla | Fração de argila |
| Derived texture | USDA textural class | Classe texturale USDA | Clase textural USDA | Clase textural USDA | Classe textural USDA |
| Bulk density | Soil bulk density | Masse volumique apparente du sol | Densidad aparente del suelo | Densidad aparente del suelo | Massa volúmica aparente do solo |
| Gravimetric water | Gravimetric water content | Teneur en eau gravimétrique | Contenido gravimétrico de agua | Contenido gravimétrico de agua | Teor gravimétrico de água |
| Drying | Sample drying | Séchage de l’échantillon | Secado de la muestra | Secado de la muestra | Secagem da amostra |
| Preparation | Sample preparation | Préparation de l’échantillon | Preparación de la muestra | Preparación de la muestra | Preparação da amostra |
| MIR | Mid-infrared spectroscopy | Spectroscopie dans le moyen infrarouge | Espectroscopia de infrarrojo medio | Espectroscopia de infrarrojo medio | Espectroscopia no infravermelho médio |
| Vis–NIR | Visible and near-infrared spectroscopy | Spectroscopie dans le visible et le proche infrarouge | Espectroscopia del visible y del infrarrojo cercano | Espectroscopia del visible y del infrarrojo cercano | Espectroscopia no visível e no infravermelho próximo |
| Reflectance | Reflectance | Réflectance | Reflectancia | Reflectancia | Refletância |
| Absorbance | Absorbance | Absorbance | Absorbancia | Absorbancia | Absorvância |
| Wavenumber | Wavenumber | Nombre d’onde | Número de onda | Número de onda | Número de onda |
| Wavelength | Wavelength | Longueur d’onde | Longitud de onda | Longitud de onda | Comprimento de onda |
| Reference result | Reference laboratory result | Résultat de laboratoire de référence | Resultado de laboratorio de referencia | Resultado de laboratorio de referencia | Resultado laboratorial de referência |
| Predicted result | Predicted value | Valeur prédite | Valor predicho | Valor predicho | Valor previsto |
| QC | Quality control | Contrôle qualité | Control de calidad | Control de calidad | Controlo da qualidade |
| Blank | Analytical blank | Blanc analytique | Blanco analítico | Blanco analítico | Branco analítico |
| CRM | Certified reference material | Matériau de référence certifié | Material de referencia certificado | Material de referencia certificado | Material de referência certificado |
| LOQ | Limit of quantification | Limite de quantification | Límite de cuantificación | Límite de cuantificación | Limite de quantificação |

Do not apply the Olsen concept row directly as a rename of every “available phosphorus” entity. Keep the laboratory's approved description and explain the operational extraction meaning in context. The same care applies to bulk-density synonyms and Portuguese regional variants.

## 4. Scientific traps to resolve in the actual catalogue

| Area | Observed or foreseeable translation trap | Implementation rule |
|---|---|---|
| Texture | `TEXTURE` fallback name says class, while the workflow treats fractions as a panel. | Distinct display concepts for the ordered panel, measured components, closure check and derived class. No changes to task grouping or calculation in this translation pass. |
| USDA fractions | English SAND/SILT/CLAY names include size boundaries. Other schemes may use different boundaries. | Retain configured boundaries, fine-earth basis and classification version; do not substitute a national triangle. |
| USDA class names | “Loam” is not just silt; literal translations or country-specific class names can imply another scheme. | Review all 12 class labels against the current USDA algorithm. Keep class ID and scheme/version; include canonical English in details when regional equivalence is ambiguous. |
| pH | `PH_H2O` seed name contains 1:2.5, while a listed method has 1:5; `PH_KCL` fallback refers to reserve acidity. | Show the actual selected method ratio and extractant. Obtain method-owner clarification of conflicting source labels; never translate pH as a titratable acidity result. |
| EC | 1:5 soil/water EC and saturated paste extract ECe are distinct. | Preserve extraction context, reporting temperature if specified, unit and method identity. |
| Organic carbon vs matter | SOC and SOM may be conflated by convenient wording. | Distinct terms; no automatic conversion factor or calculation change. |
| CEC vs ECEC | Effective CEC and CEC measured at a specified pH are not interchangeable labels. | Preserve method/buffer/measurement context and charge-based units. |
| Phosphorus | Available, extractable and total; Olsen, Bray and Mehlich; elemental P vs P₂O₅. | Translate the exact approved measurand and extraction. Maintain basis and chemical reporting form. |
| Aqua regia | Several English names say “Total ... (Aqua Regia)”; current catalogue policy already warns about it. | Route to scientific clarification of total/quasi-total/acid-extractable meaning. No silent relabeling of historical results. |
| Nitrate/ammonium | Ion mass vs nitrogen-equivalent mass. | Preserve NO₃⁻-N versus NO₃⁻ and NH₄⁺-N versus NH₄⁺; labels must not change the reporting basis. |
| Water retention | Field-capacity or wilting labels can hide a specific applied potential. | Retain the configured pressure/potential/pF and basis; translating a name does not change the test condition. |
| MIR/Vis–NIR | A spectrum is not one reflectance number, and a model prediction is not a wet-chemistry measurement. | Translate import/QC/model provenance labels consistently; retain spectra and distinction between reference/predicted values. |
| Spectral axes | Wavelength vs wavenumber; absorbance vs reflectance; fraction vs percent reflectance. | Translate axis labels while preserving axis quantity, direction, units and stored transformations. |
| Calibration | Instrument calibration, model calibration and method validation have different meanings. | Separate keys/context and definitions; never label model fitting as instrument qualification. |
| Fertilizer/plant/water | Soil terms reused for other matrices can become scientifically wrong. | Review all 10 seed categories and every live matrix, not just common soil fertility parameters. |
| Workflow wording | Draft, submitted, accepted, verified, approved, released and archived express different events. | Translate by domain/state; never collapse them to “complete.” |

The USDA source explicitly describes class calculation from sand, silt and clay: [NRCS Soil Texture Calculator](https://www.nrcs.usda.gov/resources/education-and-teaching-materials/soil-texture-calculator). Use it to verify class identity; translation must not alter the algorithm.

## 5. Review protocol for every analysis and methodology

1. Reconcile its stable ID with the live scoped catalogue and existing historic references.
2. Read the English name, description, matrix, method, extractant/digestion, basis, units, fraction limits and method reference/revision together.
3. Decide whether the English source is scientifically unambiguous. If not, create a linked definition issue and keep this entry awaiting clarification.
4. Obtain a preferred term from an authoritative vocabulary/manual or a method-owner-approved local term. Record the source URL/reference and relevant section or concept ID.
5. Draft each target locale; preserve locked tokens and add reviewed synonyms for search. Identical ES/ES-419 wording is allowed, but each locale must be explicitly reviewed.
6. Technical reviewer checks meaning, qualifiers and abbreviations. Language reviewer checks natural wording, grammar, spelling and regional fit. The same qualified person can fill both roles; record actual review rather than invented reviewers.
7. Preview in analysis selection, worksheet, sample record, workflow, review and report. Ensure long labels do not hide the distinguishing method qualifiers.
8. Publish a reviewed translation revision tied to the exact source hash. Changing the source or draft later invalidates that review.

Use `catalogue-translation-review-matrix.json` to track every checked-in name/description, then add all live-only records and configurable text. A source-only or null target value is a work item, not proof of completed translation.

## 6. Research register and limits

| Reference | Use in this plan | Access/result |
|---|---|---|
| [AGROVOC texture](https://agrovoc.fao.org/browse/agrovoc/en/page/c_7199) and locale views | Concept and multilingual preferred terminology | Indexed concept text inspected. Some direct fetches were access-restricted. |
| [AGROVOC CEC](https://agrovoc.fao.org/browse/agrovoc/en/page/c_24981?clang=ca) | Cation-exchange concept and listed language terms | Indexed concept text includes English, French and Portuguese; the `clang=ca` page explicitly falls back to English rather than defining Catalan. |
| [Embrapa 2017 soil methods manual](https://www.infoteca.cnptia.embrapa.br/handle/doc/1085209) | Portuguese technical reference and scope | Repository metadata inspected; this pass did not read or validate all 574 pages. |
| [Embrapa analytical manual](https://rolas.cnpt.embrapa.br/arquivos/manual_rolas.pdf) | Portuguese parameter names | Indexed contents inspected; regional language review still required. |
| [IRD MIR soil study](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers13-06/010056055.pdf) | French MIR usage | Indexed primary research text inspected. |
| [Embrapa SpecSolo](https://www.embrapa.br/en/web/solos/busca-de-solucoes-tecnologicas/-/produto-servico/8668/specsolo) | Portuguese NIR usage | Indexed institution description inspected. |
| [USDA texture calculator](https://www.nrcs.usda.gov/resources/education-and-teaching-materials/soil-texture-calculator) | Classification identity | Current primary page opened. |
| [WoSIS methods documentation](https://docs.isric.org/globaldata/wosis/faq-wosis.html) and [2025 report](https://files.isric.org/public/documents/2025_WoSIS_coding_analytical_method_descriptions.pdf) | Property/method identity, original data preservation | Primary documentation/indexed report inspected. |
| [BIPM SI Brochure](https://www.bipm.org/utils/common/pdf/si-brochure/SI-Brochure-9.pdf) | Symbols and scientific number presentation | Primary indexed text; use complete current brochure for implementation reference. |
| [FAO GLOSOLAN SOP index](https://www.fao.org/global-soil-partnership/glosolan-old/repository/standard-operating-procedures/en/) | Locate pH, preparation, EC and digestion SOPs | Search index lists the SOPs; old index URLs returned 404 and several direct FAO/Open Knowledge documents returned 403/redirect errors. Do not claim those full SOPs were read in this audit. Resolve current document links and record the exact SOP/version during technical review. |

These references establish a credible terminology-review process and identify distinctions that must be protected. They do not independently certify the platform's 467 methods, their claimed standards, or a complete five-language glossary. That certification work is an explicit implementation deliverable rather than an assumption.
