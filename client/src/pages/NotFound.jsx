import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, Home, BookOpen, Layers } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const NotFound = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();

    return (
        <div className="min-h-[75vh] flex items-center justify-center p-4 font-sans animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-xl p-8 text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                    <Compass size={32} className="animate-spin-slow" />
                </div>

                <div className="space-y-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                        Error 404
                    </span>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight pt-2">
                        {t('error.pageNotFound', 'Page Not Found')}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                        {t('error.pageNotFoundDesc', 'The page you are looking for does not exist, has been relocated, or is restricted.')}
                    </p>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                    <Link
                        to="/"
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Home size={16} />
                        {t('common.returnHome', 'Return to Dashboard')}
                    </Link>

                    <button
                        onClick={() => navigate(-1)}
                        className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={14} />
                        {t('common.goBack', 'Go Back')}
                    </button>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <Link to="/about" className="hover:text-emerald-600 flex items-center gap-1 transition-colors">
                        <BookOpen size={12} /> {t('nav.about', 'About')}
                    </Link>
                    <span>·</span>
                    <Link to="/techstack" className="hover:text-emerald-600 flex items-center gap-1 transition-colors">
                        <Layers size={12} /> {t('nav.techStack', 'Tech Stack')}
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
