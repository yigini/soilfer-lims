import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
    ArrowLeft, ExternalLink, Globe2, ShieldCheck, Database, Layers,
    Award, Users, Sprout, Activity, Beaker, CheckCircle2, ChevronRight,
    MapPin, Sparkles, BookOpen, HeartHandshake, Building2, Cpu
} from 'lucide-react';

const About = () => {
    const { t } = useLanguage();
    return (
        <div className="max-w-6xl mx-auto pb-16 space-y-12 animate-in fade-in duration-500 font-sans">
            {/* Top Navigation / Breadcrumb */}
            <div className="flex items-center justify-between">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm text-sf-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    {t('common.back', 'Back to Dashboard')}
                </Link>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                        <Sparkles size={12} />
                        Global Flagship Initiative
                    </span>
                </div>
            </div>

            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-green-950 text-white p-8 md:p-14 shadow-2xl border border-emerald-800/40">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 max-w-3xl space-y-6">
                    <div className="flex items-center gap-3">
                        <img src="/assets/img/soilfer-logo.png" alt="SoilFER" className="h-12 w-auto object-contain brightness-110 drop-shadow-md" />
                        <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-amber-200 tracking-tight">
                            LIMS
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        {t('about.heroTitle', 'Soil Mapping for Resilient Agri-Food Systems & Sustainable Soil Management')}
                    </h1>

                    <p className="text-lg md:text-xl text-emerald-100/90 leading-relaxed font-light">
                        {t('about.heroSubtitle', 'The SoilFER Programme is an international cooperation framework implemented by the Food and Agriculture Organization of the United Nations (FAO). It provides data-driven, evidence-based soil nutrient management, digital soil mapping, and laboratory capacity development to address the global fertilizer and food security crisis.')}
                    </p>

                    {/* Key stats pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-emerald-800/60">
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-amber-300">$36M+</div>
                            <div className="text-xs text-emerald-200/70 uppercase tracking-wider mt-0.5">{t('about.totalGrantFunding', 'Total Grant Funding')}</div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-white">7</div>
                            <div className="text-xs text-emerald-200/70 uppercase tracking-wider mt-0.5">{t('about.focusCountries', 'Focus Countries')}</div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-amber-300">40,000+</div>
                            <div className="text-xs text-emerald-200/70 uppercase tracking-wider mt-0.5">{t('about.samplesAnalyzed', 'Soil Samples Analyzed')}</div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-white">ISO 17025</div>
                            <div className="text-xs text-emerald-200/70 uppercase tracking-wider mt-0.5">{t('about.glosolanStandards', 'GLOSOLAN Standards')}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Donors & Funding Section */}
            <div className="space-y-6">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                        {t('about.donorsHeading', 'Financial Support & Partnerships')}
                    </h2>
                    <h3 className="text-2xl md:text-3xl font-bold text-sf-text">
                        {t('about.donorsSubheading', 'Developed Thanks to Our Generous Resource Partners')}
                    </h3>
                    <p className="text-sf-muted text-sm">
                        {t('about.donorsDesc', 'This digital Laboratory Information Management System (LIMS) and the broader SoilFER country operations are made possible through bilateral grants from the Governments of the United States and Japan.')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* US State Department Card */}
                    <div className="bg-sf-surface rounded-3xl p-8 border border-gray-200/80 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all relative overflow-hidden flex flex-col justify-between group">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                                    Project GCP /GLO/1127/USA · $30,000,000 USD
                                </span>
                                <a
                                    href="https://www.state.gov/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    title="Visit State.gov"
                                >
                                    <ExternalLink size={16} />
                                </a>
                            </div>

                            <div className="flex items-center gap-5">
                                <div className="h-20 w-28 rounded-2xl bg-white p-2.5 flex items-center justify-center border border-sf-divider shadow-md flex-shrink-0">
                                    <img
                                        src="/assets/img/us_dept_state_official.svg"
                                        alt="United States Department of State"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div>
                                    <h4 className="text-xl font-bold text-sf-text leading-snug">
                                        {t('about.usTitle', 'United States of America')}
                                    </h4>
                                    <p className="text-xs font-medium text-sf-muted">
                                        {t('about.usSubtitle', 'Department of State & USAID')}
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-sf-muted leading-relaxed">
                                {t('about.usDesc', 'Supporting Guatemala, Honduras, Zambia, Kenya, and Ghana (2023–2027) through the Office of Global Food Security and USAID, advancing regional soil mapping, agricultural resilience in the Central American Dry Corridor, and sub-Saharan African food security.')}
                            </p>

                            <div className="flex flex-wrap gap-2 pt-2">
                                {['Guatemala', 'Honduras', 'Zambia', 'Kenya', 'Ghana'].map(c => (
                                    <span key={c} className="text-xs px-2.5 py-1 rounded-lg bg-sf-raised/60 font-medium text-sf-muted">
                                        {c}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="pt-6 mt-6 border-t border-sf-divider flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 font-semibold">
                            <span>Office of Global Food Security</span>
                            <a href="https://www.state.gov/" target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1">
                                Visit Portal <ChevronRight size={14} />
                            </a>
                        </div>
                    </div>

                    {/* Japan MOFA Card */}
                    <div className="bg-sf-surface rounded-3xl p-8 border border-gray-200/80 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all relative overflow-hidden flex flex-col justify-between group">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-3 py-1 rounded-full border border-rose-200 dark:border-rose-800">
                                    Project GCP /GLO/1242/JPN · $6,000,000 USD
                                </span>
                                <a
                                    href="https://www.mofa.go.jp/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                    title="Visit MOFA Japan"
                                >
                                    <ExternalLink size={16} />
                                </a>
                            </div>

                            <div className="flex items-center gap-5">
                                <div className="h-20 w-28 rounded-2xl bg-white p-2.5 flex items-center justify-center border border-sf-divider shadow-md flex-shrink-0">
                                    <img
                                        src="/assets/img/japan_oda_official.jpg"
                                        alt="From the People of Japan"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div>
                                    <h4 className="text-xl font-bold text-sf-text leading-snug">
                                        {t('about.japanTitle', 'Government of Japan')}
                                    </h4>
                                    <p className="text-xs font-medium text-sf-muted">
                                        {t('about.japanSubtitle', 'Ministry of Foreign Affairs (MOFA) · Japan ODA')}
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-sf-muted leading-relaxed">
                                {t('about.japanDesc', 'Supporting Mozambique and Tunisia under the SoilFER-VACS Framework (Vision for Adapted Crops and Soils), promoting climate-resilient opportunity crops, soil spectroscopy, and nutrition-sensitive agricultural systems.')}
                            </p>

                            <div className="flex flex-wrap gap-2 pt-2">
                                {['Mozambique', 'Tunisia', 'VACS Framework'].map(c => (
                                    <span key={c} className="text-xs px-2.5 py-1 rounded-lg bg-sf-raised/60 font-medium text-sf-muted">
                                        {c}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="pt-6 mt-6 border-t border-sf-divider flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-semibold">
                            <span>From the People of Japan</span>
                            <a href="https://www.mofa.go.jp/" target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1">
                                Visit MOFA <ChevronRight size={14} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* The Purpose of the LIMS Environment */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-3xl p-8 md:p-12 border border-emerald-200 dark:border-emerald-800/60 space-y-8">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-md flex-shrink-0">
                        <Beaker size={28} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl md:text-2xl font-bold text-sf-text">
                            Why this LIMS Environment Was Developed
                        </h3>
                        <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                            Mandated under Output 1 (Activity 1.10) of the Official SoilFER Project Document
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-sf-surface p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/60 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                            <ShieldCheck size={18} />
                            <span>GLOSOLAN Standardization</span>
                        </div>
                        <p className="text-xs text-sf-muted leading-relaxed">
                            Enforces standardized Standard Operating Procedures (SOPs), quality assurance and quality control (QA/QC), blind blank validation, duplicate precision testing, and international proficiency ring trials across all National Reference Soil Laboratories.
                        </p>
                    </div>

                    <div className="bg-sf-surface p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/60 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                            <Layers size={18} />
                            <span>Wet & Dry Chemistry</span>
                        </div>
                        <p className="text-xs text-sf-muted leading-relaxed">
                            Integrates traditional wet chemistry analyses (Olsen/Bray/Mehlich P, Total N, Potassium, SOC, pH, EC, CEC, micronutrients) with next-generation dry proximal sensing (FTIR-DRIFTS, Mid-Infrared, NIR, and Gamma spectrometry).
                        </p>
                    </div>

                    <div className="bg-sf-surface p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/60 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                            <Database size={18} />
                            <span>NSIS & National Mapping</span>
                        </div>
                        <p className="text-xs text-sf-muted leading-relaxed">
                            Serves as the direct digital feeder to the National Soil Information System (NSIS), ensuring seamless data sovereignty and flowing verified analytical data directly into high-resolution national nutrient budget maps and farmer decision support tools.
                        </p>
                    </div>
                </div>
            </div>

            {/* Four Strategic Outputs */}
            <div className="space-y-6">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                        Project Framework & Deliverables
                    </h2>
                    <h3 className="text-2xl md:text-3xl font-bold text-sf-text">
                        The Four Interconnected Outputs of SoilFER
                    </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-sf-surface rounded-2xl p-6 border border-sf-divider shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 font-black text-sm flex items-center justify-center">
                                1
                            </span>
                            <h4 className="font-bold text-sf-text">
                                National Soil Information Systems (NSIS)
                            </h4>
                        </div>
                        <p className="text-sm text-sf-muted leading-relaxed">
                            Establishment of robust National Soil Information Systems, national spectral libraries, high-resolution digital soil nutrient (NPK) and property maps (10m to 1km), and integration with satellite remote sensing (WaPOR, Cosmic Ray Neutron Sensors).
                        </p>
                    </div>

                    <div className="bg-sf-surface rounded-2xl p-6 border border-sf-divider shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 font-black text-sm flex items-center justify-center">
                                2
                            </span>
                            <h4 className="font-bold text-sf-text">
                                Crop Suitability & Climate Adaptation (VACS)
                            </h4>
                        </div>
                        <p className="text-sm text-sf-muted leading-relaxed">
                            Integration with FAO's Global Agro-Ecological Zones (GAEZ) framework to model crop suitability under baseline and future climate scenarios, prioritizing nutritious, drought-resilient traditional and opportunity crops under the VACS framework.
                        </p>
                    </div>

                    <div className="bg-sf-surface rounded-2xl p-6 border border-sf-divider shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 font-black text-sm flex items-center justify-center">
                                3
                            </span>
                            <h4 className="font-bold text-sf-text">
                                Sustainable Soil Management & 4R Stewardship
                            </h4>
                        </div>
                        <p className="text-sm text-sf-muted leading-relaxed">
                            Promoting the 4R Nutrient Stewardship principles (Right Source, Right Rate, Right Time, Right Place), testing local bio-fertilizers and organic alternatives, and expanding the farmer-to-farmer <strong>Global Soil Doctors Programme</strong>.
                        </p>
                    </div>

                    <div className="bg-sf-surface rounded-2xl p-6 border border-sf-divider shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 font-black text-sm flex items-center justify-center">
                                4
                            </span>
                            <h4 className="font-bold text-sf-text">
                                Farmer Advisory (FerSIS) & Decision Support (DSS)
                            </h4>
                        </div>
                        <p className="text-sm text-sf-muted leading-relaxed">
                            Deployment of the cross-platform <strong>FerSIS App</strong> for tailored farm-level fertilizer recommendations, interactive farmer feedback mechanisms, and high-level Decision Support Dashboards for government policy formulation.
                        </p>
                    </div>
                </div>
            </div>

            {/* Implementing Institutions and Global Networks */}
            <div className="bg-sf-surface rounded-3xl p-8 border border-sf-divider shadow-sm space-y-6">
                <div className="space-y-1">
                    <h3 className="text-xl font-bold text-sf-text">
                        Implementing Agencies & Global Networks
                    </h3>
                    <p className="text-sm text-sf-muted">
                        Executed globally by UN FAO in direct partnership with national ministries and scientific centres.
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-sf-canvas/50 border border-sf-divider/60 text-center space-y-1">
                        <div className="font-bold text-xs text-sf-text">FAO NSL</div>
                        <div className="text-[11px] text-sf-muted">Land & Water Division</div>
                    </div>
                    <div className="p-4 rounded-xl bg-sf-canvas/50 border border-sf-divider/60 text-center space-y-1">
                        <div className="font-bold text-xs text-sf-text">FAO GSP</div>
                        <div className="text-[11px] text-sf-muted">Global Soil Partnership</div>
                    </div>
                    <div className="p-4 rounded-xl bg-sf-canvas/50 border border-sf-divider/60 text-center space-y-1">
                        <div className="font-bold text-xs text-sf-text">GLOSOLAN</div>
                        <div className="text-[11px] text-sf-muted">Soil Laboratory Network</div>
                    </div>
                    <div className="p-4 rounded-xl bg-sf-canvas/50 border border-sf-divider/60 text-center space-y-1">
                        <div className="font-bold text-xs text-sf-text">Joint FAO/IAEA</div>
                        <div className="text-[11px] text-sf-muted">Nuclear Techniques in Agri</div>
                    </div>
                    <div className="p-4 rounded-xl bg-sf-canvas/50 border border-sf-divider/60 text-center space-y-1">
                        <div className="font-bold text-xs text-sf-text">ISRIC & IFDC</div>
                        <div className="text-[11px] text-sf-muted">Soil & Fertilizer Info</div>
                    </div>
                    <div className="p-4 rounded-xl bg-sf-canvas/50 border border-sf-divider/60 text-center space-y-1">
                        <div className="font-bold text-xs text-sf-text">CGIAR (CIAT / ICRAF)</div>
                        <div className="text-[11px] text-sf-muted">Agroforestry & Soil Research</div>
                    </div>
                    <div className="p-4 rounded-xl bg-sf-canvas/50 border border-sf-divider/60 text-center space-y-1">
                        <div className="font-bold text-xs text-sf-text">AFRILAB & LATSOLAN</div>
                        <div className="text-[11px] text-sf-muted">Regional Lab Networks</div>
                    </div>
                    <div className="p-4 rounded-xl bg-sf-canvas/50 border border-sf-divider/60 text-center space-y-1">
                        <div className="font-bold text-xs text-sf-text">Space2Place</div>
                        <div className="text-[11px] text-sf-muted">Geospatial Decision Support</div>
                    </div>
                </div>
            </div>

            {/* Quick Links Section */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-sf-raised/60 rounded-2xl border border-sf-divider">
                <div className="flex items-center gap-3">
                    <Cpu size={20} className="text-emerald-600 dark:text-emerald-400" />
                    <div>
                        <div className="text-sm font-bold text-sf-text">Looking for Technical Architecture?</div>
                        <div className="text-xs text-sf-muted">Explore libraries, framework components, release changelog and version history.</div>
                    </div>
                </div>
                <Link
                    to="/techstack"
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm"
                >
                    View Tech Stack & Changelog <ChevronRight size={14} />
                </Link>
            </div>

            {/* Footer with support */}
            <div className="pt-6 border-t border-sf-divider text-center text-xs text-sf-muted space-y-2">
                <p>
                    SoilFER LIMS is an open digital laboratory platform developed for the Global Soil Partnership.
                </p>
                <p>
                    For technical support or institutional inquiries: <a href="mailto:GLOSOLAN@fao.org" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">GLOSOLAN@fao.org</a>
                </p>
            </div>
        </div>
    );
};

export default About;
