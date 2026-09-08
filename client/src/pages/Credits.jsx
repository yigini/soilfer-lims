import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, ExternalLink, Code2, Database, Globe, Map, BarChart3, Shield, FileText,
    Palette, Zap, TestTube2, Camera, BookOpen, Package, Server, Layout, Layers,
    CheckCircle, Heart
} from 'lucide-react';

const techStack = [
    {
        category: 'Frontend',
        icon: Layout,
        color: 'from-blue-500 to-cyan-500',
        items: [
            { name: 'React', version: '18.3', url: 'https://react.dev', icon: '⚛️', desc: 'Core UI library for building interactive user interfaces' },
            { name: 'React Router', version: '6.x', url: 'https://reactrouter.com', icon: '🧭', desc: 'Client-side routing and navigation' },
            { name: 'Vite', version: '5.x', url: 'https://vitejs.dev', icon: '⚡', desc: 'Next-generation build tool and dev server' },
            { name: 'Tailwind CSS', version: '3.4', url: 'https://tailwindcss.com', icon: '🎨', desc: 'Utility-first CSS framework for rapid styling' },
            { name: 'Lucide React', version: '0.344', url: 'https://lucide.dev', icon: '✨', desc: 'Beautiful, consistent icon library' },
            { name: 'Recharts', version: '2.12', url: 'https://recharts.org', icon: '📊', desc: 'Composable charting library for data visualization' },
        ]
    },
    {
        category: 'Mapping & Geospatial',
        icon: Globe,
        color: 'from-emerald-500 to-teal-500',
        items: [
            { name: 'CesiumJS', version: '1.124', url: 'https://cesium.com', icon: '🌍', desc: '3D geospatial visualization with terrain and satellite imagery' },
            { name: 'Cesium Ion', url: 'https://cesium.com/ion', icon: '🛰️', desc: 'Cloud platform for 3D terrain, imagery, and geospatial data' },
            { name: 'Leaflet', version: '1.9', url: 'https://leafletjs.com', icon: '🗺️', desc: 'Lightweight 2D interactive mapping library' },
            { name: 'React Leaflet', version: '4.2', url: 'https://react-leaflet.js.org', icon: '📍', desc: 'React bindings for Leaflet maps' },
            { name: 'Esri World Imagery', url: 'https://www.esri.com', icon: '🌎', desc: 'High-resolution satellite basemap tiles' },
            { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org', icon: '🗺️', desc: 'Free, collaborative world map data' },
        ]
    },
    {
        category: 'Backend & Server',
        icon: Server,
        color: 'from-violet-500 to-purple-500',
        items: [
            { name: 'Node.js', url: 'https://nodejs.org', icon: '💚', desc: 'JavaScript runtime for server-side applications' },
            { name: 'Express', version: '5.x', url: 'https://expressjs.com', icon: '🚀', desc: 'Fast, minimal web framework for Node.js' },
            { name: 'JSON Web Tokens', url: 'https://jwt.io', icon: '🔑', desc: 'Secure authentication and authorization tokens' },
            { name: 'bcrypt.js', url: 'https://github.com/dcodeIO/bcrypt.js', icon: '🔒', desc: 'Password hashing for secure credential storage' },
        ]
    },
    {
        category: 'Database & ORM',
        icon: Database,
        color: 'from-amber-500 to-orange-500',
        items: [
            { name: 'PostgreSQL', url: 'https://www.postgresql.org', icon: '🐘', desc: 'Advanced open-source relational database' },
            { name: 'Prisma', version: '5.22', url: 'https://www.prisma.io', icon: '💎', desc: 'Next-generation ORM for type-safe database access' },
        ]
    },
    {
        category: 'Data & Field Collection',
        icon: Camera,
        color: 'from-pink-500 to-rose-500',
        items: [
            { name: 'KoboToolbox', url: 'https://www.kobotoolbox.org', icon: '📋', desc: 'Open-source field data collection platform used for sample intake' },
            { name: 'PapaParse', version: '5.5', url: 'https://www.papaparse.com', icon: '📄', desc: 'Fast CSV parser for data import/export' },
            { name: 'SheetJS (xlsx)', version: '0.18', url: 'https://sheetjs.com', icon: '📊', desc: 'Excel/spreadsheet generation and parsing' },
            { name: 'jsPDF', version: '4.0', url: 'https://github.com/parallax/jsPDF', icon: '📑', desc: 'PDF generation for reports and documents' },
        ]
    },
    {
        category: 'Quality & Testing',
        icon: CheckCircle,
        color: 'from-green-500 to-lime-500',
        items: [
            { name: 'Jest', version: '30.x', url: 'https://jestjs.io', icon: '🃏', desc: 'JavaScript testing framework' },
            { name: 'SuperTest', url: 'https://github.com/ladjs/supertest', icon: '🧪', desc: 'HTTP assertion library for API testing' },
            { name: 'ESLint', version: '8.x', url: 'https://eslint.org', icon: '🔍', desc: 'JavaScript linting for code quality' },
        ]
    },
    {
        category: 'Utilities',
        icon: Package,
        color: 'from-slate-500 to-gray-500',
        items: [
            { name: 'Axios', url: 'https://axios-http.com', icon: '🌐', desc: 'HTTP client for API communication' },
            { name: 'date-fns', version: '3.6', url: 'https://date-fns.org', icon: '📅', desc: 'Modern date utility library' },
            { name: 'html5-qrcode', url: 'https://github.com/mebjas/html5-qrcode', icon: '📷', desc: 'QR code and barcode scanning' },
            { name: 'PostCSS', url: 'https://postcss.org', icon: '🔧', desc: 'CSS transformation tool' },
        ]
    },
];

const Credits = () => {
    return (
        <div className="max-w-5xl mx-auto">
            {/* Back button */}
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-6 group">
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
            </Link>

            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-8 md:p-12 mb-8 shadow-xl">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-500 rounded-full blur-3xl" />
                </div>
                <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-white/10 backdrop-blur rounded-xl border border-white/10">
                            <Code2 size={24} className="text-blue-300" />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Credits & Acknowledgments</h1>
                    </div>
                    <p className="text-blue-200/80 max-w-2xl text-sm leading-relaxed">
                        LIMS is built on the shoulders of incredible open-source projects and services.
                        We gratefully acknowledge the following technologies and their communities that make this system possible.
                    </p>
                    <div className="flex items-center gap-4 mt-6">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/10">
                            <Layers size={14} className="text-blue-300" />
                            <span className="text-xs text-blue-200 font-bold">{techStack.reduce((sum, cat) => sum + cat.items.length, 0)} Technologies</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/10">
                            <Heart size={14} className="text-pink-400" />
                            <span className="text-xs text-blue-200 font-bold">Open Source First</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories */}
            <div className="space-y-6">
                {techStack.map((category) => (
                    <div key={category.category} className="bg-sf-surface rounded-xl border border-sf-divider shadow-sm overflow-hidden">
                        {/* Category header */}
                        <div className={`px-5 py-3.5 bg-gradient-to-r ${category.color} flex items-center gap-3`}>
                            <category.icon size={18} className="text-white" />
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">{category.category}</h2>
                            <span className="ml-auto text-white/60 text-xs font-bold">{category.items.length} packages</span>
                        </div>

                        {/* Items grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-sf-raised">
                            {category.items.map((item) => (
                                <div key={item.name} className="bg-sf-surface p-4 flex items-start gap-3 group hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                    <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-sf-text">{item.name}</span>
                                            {item.version && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-sf-raised text-sf-muted rounded-md font-mono font-bold">
                                                    v{item.version}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-sf-muted mt-0.5 leading-relaxed">{item.desc}</p>
                                    </div>
                                    {item.url && (
                                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                                            className="flex-shrink-0 p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all opacity-0 group-hover:opacity-100"
                                            title={`Visit ${item.name}`}>
                                            <ExternalLink size={14} />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom attribution */}
            <div className="mt-8 mb-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-sf-raised rounded-xl border border-sf-divider">
                    <Heart size={14} className="text-red-400" fill="currentColor" />
                    <span className="text-xs text-sf-muted font-medium">
                        Thank you to all the open-source contributors who make these projects possible.
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Credits;
