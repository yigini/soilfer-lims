import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
    ArrowLeft, ExternalLink, Code2, Database, Globe, Map, BarChart3, Shield, FileText,
    Palette, Zap, TestTube2, Camera, BookOpen, Package, Server, Layout, Layers,
    CheckCircle, CheckCircle2, Heart, History, Tag, GitCommit, Sparkles, Cpu, Terminal
} from 'lucide-react';

const techStack = [
    {
        category: 'Frontend Architecture',
        icon: Layout,
        color: 'from-blue-500 to-cyan-500',
        items: [
            { name: 'React', version: '18.3', url: 'https://react.dev', icon: '⚛️', desc: 'Core reactive component library for modern user interfaces' },
            { name: 'React Router', version: '6.x', url: 'https://reactrouter.com', icon: '🧭', desc: 'Declarative client-side routing and protected view guards' },
            { name: 'Vite', version: '5.x', url: 'https://vitejs.dev', icon: '⚡', desc: 'Next-generation ES module bundler and ultra-fast dev server' },
            { name: 'Tailwind CSS', version: '3.4', url: 'https://tailwindcss.com', icon: '🎨', desc: 'Utility-first styling with custom dark-mode & glassmorphism' },
            { name: 'Lucide React', version: '0.344', url: 'https://lucide.dev', icon: '✨', desc: 'Comprehensive, accessible SVG iconography' },
            { name: 'Recharts', version: '2.12', url: 'https://recharts.org', icon: '📊', desc: 'High-performance SVG chart visualizations for spectral & QA data' },
        ]
    },
    {
        category: 'Geospatial & 3D Mapping',
        icon: Globe,
        color: 'from-emerald-500 to-teal-500',
        items: [
            { name: 'CesiumJS', version: '1.124', url: 'https://cesium.com', icon: '🌍', desc: '3D geospatial globe with real-time terrain, satellite imagery & coordinate projection' },
            { name: 'Cesium Ion', url: 'https://cesium.com/ion', icon: '🛰️', desc: 'Tiled 3D world terrain and global elevation data services' },
            { name: 'Leaflet', version: '1.9', url: 'https://leafletjs.com', icon: '🗺️', desc: 'Lightweight 2D interactive mapping for field sampling sites' },
            { name: 'React Leaflet', version: '4.2', url: 'https://react-leaflet.js.org', icon: '📍', desc: 'React component bindings for layered GIS maps' },
            { name: 'Esri World Imagery', url: 'https://www.esri.com', icon: '🌎', desc: 'High-resolution global satellite basemap tiles' },
            { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org', icon: '🗺️', desc: 'Open crowdsourced vector street and topographic map layers' },
        ]
    },
    {
        category: 'Backend & Services',
        icon: Server,
        color: 'from-violet-500 to-purple-500',
        items: [
            { name: 'Node.js', url: 'https://nodejs.org', icon: '💚', desc: 'JavaScript asynchronous event-driven server runtime' },
            { name: 'Express', version: '5.x', url: 'https://expressjs.com', icon: '🚀', desc: 'RESTful API gateway and middleware routing engine' },
            { name: 'JSON Web Tokens', url: 'https://jwt.io', icon: '🔑', desc: 'Stateless cryptographic token-based authentication (JWT)' },
            { name: 'bcrypt.js', url: 'https://github.com/dcodeIO/bcrypt.js', icon: '🔒', desc: 'Salted cryptographic hashing for credentials' },
            { name: 'Multer', url: 'https://github.com/expressjs/multer', icon: '📁', desc: 'Multipart/form-data middleware for spectral raw files & imports' },
        ]
    },
    {
        category: 'Database & Persistence',
        icon: Database,
        color: 'from-amber-500 to-orange-500',
        items: [
            { name: 'PostgreSQL', url: 'https://www.postgresql.org', icon: '🐘', desc: 'Enterprise ACID-compliant relational SQL database' },
            { name: 'Prisma ORM', version: '5.22', url: 'https://www.prisma.io', icon: '💎', desc: 'Type-safe database client, schema migrations & connection pooling' },
            { name: 'SQLite / Better-SQLite3', url: 'https://github.com/WiseLibs/better-sqlite3', icon: '📦', desc: 'High-speed embedded database engine for offline/local field deployments' },
        ]
    },
    {
        category: 'Field Data & Interoperability',
        icon: Camera,
        color: 'from-pink-500 to-rose-500',
        items: [
            { name: 'KoboToolbox API', url: 'https://www.kobotoolbox.org', icon: '📋', desc: 'Open-source field survey sync connector for sample collection intake' },
            { name: 'PapaParse', version: '5.5', url: 'https://www.papaparse.com', icon: '📄', desc: 'High-speed CSV batch parser for soil analytical datasets' },
            { name: 'SheetJS (xlsx)', version: '0.18', url: 'https://sheetjs.com', icon: '📊', desc: 'Excel spreadsheet generation, batch export, and matrix parsing' },
            { name: 'jsPDF & AutoTable', version: '4.0', url: 'https://github.com/parallax/jsPDF', icon: '📑', desc: 'Automated ISO-compliant Certificate of Analysis PDF generation' },
            { name: 'html5-qrcode', url: 'https://github.com/mebjas/html5-qrcode', icon: '📷', desc: 'Camera barcode and QR code scanner for sample tube intake' },
        ]
    },
    {
        category: 'DevOps, Security & QA',
        icon: Shield,
        color: 'from-green-500 to-lime-500',
        items: [
            { name: 'Docker Compose', url: 'https://www.docker.com', icon: '🐳', desc: 'Multi-stage containerized architecture and deployment orchestration' },
            { name: 'Let\'s Encrypt / Certbot', url: 'https://letsencrypt.org', icon: '🔐', desc: 'Automated TLS/SSL encryption and renewal pipeline' },
            { name: 'Jest & SuperTest', url: 'https://jestjs.io', icon: '🧪', desc: 'Automated API endpoint integration and unit testing framework' },
            { name: 'ESLint', version: '8.x', url: 'https://eslint.org', icon: '🔍', desc: 'Static code analysis and code consistency enforcement' },
        ]
    },
];

const changelog = [
    {
        version: 'v1.4.0',
        date: 'September 2026',
        tag: 'Sample Reception Rework & Chain of Custody (RC-01 - RC-20)',
        badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        changes: [
            'Received Mass & Analytical Sufficiency (RC-01): Live mass sufficiency gauge checking ordered tests plus 100g retention buffer with explicit shortfall override tracking (MASS_DEFICIT_OVERRIDE).',
            'Arrival Conditions & Evidence (RC-02, RC-03): Moisture on arrival states (Dry/Moist/Wet/Saturated), foreign material inclusion chips, and photographic upload pipeline for non-conformance documentation.',
            'Duplicate & Re-Submission Detection (RC-04): Prior receipt alerts on duplicate field IDs with explicit authorized re-submission confirmation.',
            'Universal Geodesy & Offline Boundaries (RC-05, RC-08): Parsing Decimal Degrees, DMS, and UTM with Zone/Hemisphere; reverse geocoding proxy with offline boundary fallback.',
            'Positional Uncertainty & Geometry (RC-06, RC-07, RC-10, RC-11): Evidence-derived location confidence resisting unevidenced HIGH claims; 40km spatial outlier detection; composite radius and numeric depth cm intervals.',
            'Consignments & Batch Intake (RC-12 to RC-15): Consignment entity model with waybill tracking; per-sample exception modal (ACCEPTED vs REJECTED) with PARTIAL rollup; spreadsheet manifest import wizard (CSV/XLSX) with automatic column mapping.',
            'Hardware Wedge Mode & Audio Cues (RC-16): Sub-millisecond scanner input handling, auto-refocus loop, and client-side synthesized Web Audio API sound feedback.',
            'Offline Thermal Label Printing (RC-17): 100% offline client-side vector QR thermal label printing for sample bags (101x54mm) and cryovials (50x25mm) with continuous roll printing.',
            'Distinct RECEIVED_REJECTED State & Custody (RC-19): Distinct non-conformance lifecycle state excluding rejected samples from expected backlog; immutable physical handover custody metadata with courier tracking and officer counter-signatures.',
            'Comprehensive Contract Regression Suite (RC-20): 18-contract automated regression test suite ensuring full contract integrity across all reception criteria.'
        ]
    },
    {
        version: 'v1.3.0',
        date: 'September 2026',
        tag: 'Operations Engine, Spectral Rebuild & Workflow Integrity',
        badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        changes: [
            'Sample Detail & Operations Reconciliation (Vol. XIII): Implemented 3-way analysis reconciliation (delete unstarted, waive in-progress with mandatory audit reasons, prevent deletion of result-bearing work).',
            'Sample-Bound Lab Isolation: Enforced strict sample-level custody checks blocking cross-laboratory work assignment for all roles (including Super Admin).',
            'Prerequisite Gate Enforcement: Server-side validation (HTTP 412) requiring sample preparation completion before starting work or entering results.',
            'Native Binary Spectral Parsers: Direct binary parsing for Bruker OPUS, ASD FieldSpec, and Galactic SPC formats with auto-extraction of acquisition parameters.',
            'Scheduled Escalation Engine (MAP-19): Background service monitoring unassigned work (>48h) and stalled work (>72h), alerting managers automatically.',
            'Multi-Episode Analytical Tracking: Distinct analytical passes for reopened samples, capturing reasons, timestamps, and multi-approval dates on Certificates of Analysis.',
            'Declarative Deployment Profiles: Multi-lab configuration engine supporting SoilFER 7-lab reference setup and standalone deployments.',
            'GLOSOLAN Metrology & QA Engine: ISO 13528 proficiency testing evaluation, batch QC disposition flagging, and full result provenance tracking (MEASURED, DERIVED, IMPORTED).',
        ]
    },
    {
        version: 'v1.2.0',
        date: 'August 2026',
        tag: 'Visual Identity & Donor Integration',
        badgeColor: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
        changes: [
            'Visual Rebrand: Integrated the official illustrated SoilFER logo across desktop, mobile headers, sidebar, and reports.',
            'Official Donor Badges: Added official vector assets for the US Department of State and Japan MOFA/ODA with direct portal links.',
            'Ambient Soil Lab Backgrounds: Implemented 4 authentic soil laboratory scenes (FTIR DRIFTS spectroscopy, Olsen P extraction shaker, standard 2mm sieving, and precision weighing station) with smooth 60fps GPU-accelerated CSS Ken Burns crossfade.',
            'About SoilFER Page: Created dedicated public institutional portal detailing the global programme, US and Japan donor grants ($36M+), VACS framework, and LIMS role.',
            'SSL Certificate Renewal: Automated renewal system and health monitoring pipeline on production servers.',
        ]
    },
    {
        version: 'v1.1.0',
        date: 'June 2026',
        tag: 'Results Reporting & Intake Synchronization',
        badgeColor: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
        changes: [
            'Result Reports Engine: Complete public report generation with token-based cryptographic verification URLs for farmers and agronomists.',
            'Multi-Sample Reception: Enhanced walk-in intake modal and batch QR barcode scanning for incoming field samples.',
            'KoboToolbox Multi-Project Sync: Integrated dynamic project code binding for automated field survey intake.',
            'Manager Queue & Workflow Tracking: Role-based approval and rejection workflows for lab managers.',
        ]
    },
    {
        version: 'v1.0.0',
        date: 'March 2026',
        tag: 'Initial Production Release',
        badgeColor: 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
        changes: [
            '3D Cesium Geospatial Workflow Map: Interactive 3D globe displaying global field sampling coordinates and analytical progress.',
            'FTIR & MIRS Spectral Library: Raw spectral curve viewer, baseline correction, and dry spectroscopy data store.',
            'GLOSOLAN Quality Assurance: Implemented blind blank validation, duplicate precision checks, and CRM tracking.',
            'Multilingual Support: Full internationalization support for English, Spanish, Latin American Spanish, French, and Portuguese.',
            'Role-Based Access Control: Granular permissions for Technicians, Lab Managers, Sample Reception, and Super Administrators.',
        ]
    },
    {
        version: 'v0.9.0',
        date: 'December 2025',
        tag: 'Beta & Pilot Deployments',
        badgeColor: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        changes: [
            'Pilot deployments at National Reference Soil Laboratories in Zambia, Honduras, and Guatemala.',
            'Core database schema design for wet chemistry parameters (N, P, K, pH, EC, SOC, CEC, texture).',
            'CSV & Excel batch import/export pipelines for legacy laboratory datasets.',
        ]
    }
];

const TechStack = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('stack'); // 'stack' | 'changelog'

    return (
        <div className="max-w-6xl mx-auto pb-16 space-y-8 animate-in fade-in duration-500 font-sans">
            {/* Top Navigation */}
            <div className="flex items-center justify-between">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    {t('common.back', 'Back to Dashboard')}
                </Link>
                <div className="flex items-center gap-3">
                    <Link
                        to="/about"
                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                        {t('nav.about', 'About SoilFER')} <ExternalLink size={12} />
                    </Link>
                </div>
            </div>

            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-gray-900 to-emerald-950 text-white p-8 md:p-12 shadow-xl border border-gray-800">
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow-lg">
                            <Cpu size={26} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-white tracking-tight">
                                Technical Architecture & Release Log
                            </h1>
                            <p className="text-emerald-200/80 text-sm font-medium">
                                SoilFER LIMS · Enterprise Laboratory Information Management System
                            </p>
                        </div>
                    </div>

                    <p className="text-gray-300 text-sm max-w-3xl leading-relaxed">
                        Built with a modular, cloud-ready stack engineered for high availability, ISO 17025 compliance,
                        3D geospatial visualization, and seamless integration with the FAO Global Soil Information System (GloSIS).
                    </p>

                    {/* Tab Switcher */}
                    <div className="flex items-center gap-2 pt-4 border-t border-gray-800">
                        <button
                            onClick={() => setActiveTab('stack')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'stack' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                        >
                            <Code2 size={14} /> Technology Stack
                        </button>
                        <button
                            onClick={() => setActiveTab('changelog')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'changelog' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                        >
                            <History size={14} /> Release History & Changelog
                        </button>
                    </div>
                </div>
            </div>

            {/* TAB 1: TECH STACK */}
            {activeTab === 'stack' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {techStack.map((group) => (
                            <div
                                key={group.category}
                                className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200/80 dark:border-gray-700 shadow-sm space-y-4"
                            >
                                <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                                    <div className={`p-2 rounded-xl bg-gradient-to-r ${group.color} text-white shadow-sm`}>
                                        <group.icon size={18} />
                                    </div>
                                    <h3 className="font-bold text-base text-gray-900 dark:text-white">
                                        {group.category}
                                    </h3>
                                </div>

                                <div className="space-y-3">
                                    {group.items.map((item) => (
                                        <div
                                            key={item.name}
                                            className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all flex items-start justify-between gap-3 group"
                                        >
                                            <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">{item.icon}</span>
                                                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                                                        {item.name}
                                                    </span>
                                                    {item.version && (
                                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold">
                                                            {item.version}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                                    {item.desc}
                                                </p>
                                            </div>
                                            {item.url && (
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                                                    title={`Visit ${item.name}`}
                                                >
                                                    <ExternalLink size={14} />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Architecture Overview Card */}
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-800/80 rounded-3xl p-8 border border-emerald-200/60 dark:border-gray-700 shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <Layers size={22} className="text-emerald-700 dark:text-emerald-400" />
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                System Architecture & ISO 17025 Principles
                            </h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            The SoilFER LIMS architecture adheres to the Global Soil Laboratory Network (GLOSOLAN) governance model. It guarantees strict chain-of-custody tracking from field sampling points (integrated with KoboToolbox mobile surveys) through wet-chemical extraction, automated spectrophotometry/titration, and FTIR diffuse reflectance spectroscopy. Results undergo cryptographic verification before entering National Soil Information Systems (NSIS).
                        </p>
                    </div>
                </div>
            )}

            {/* TAB 2: CHANGELOG & VERSIONING */}
            {activeTab === 'changelog' && (
                <div className="space-y-6">
                    <div className="relative border-l-2 border-emerald-500/30 dark:border-emerald-500/20 ml-4 md:ml-6 pl-6 md:pl-8 space-y-10">
                        {changelog.map((release) => (
                            <div key={release.version} className="relative space-y-3">
                                {/* Timeline Dot */}
                                <div className="absolute -left-[31px] md:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-emerald-600 border-4 border-white dark:border-gray-900 shadow-md"></div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white">
                                        {release.version}
                                    </h3>
                                    <span className={`text-xs font-bold px-3 py-0.5 rounded-full border ${release.badgeColor}`}>
                                        {release.tag}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                        {release.date}
                                    </span>
                                </div>

                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
                                    <ul className="space-y-2">
                                        {release.changes.map((change, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                                <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                                                <span>{change}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TechStack;
