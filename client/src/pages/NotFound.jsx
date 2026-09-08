import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, Home, BookOpen, Layers } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const NotFound = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();

    return (
        <div className="min-h-[75vh] flex items-center justify-center p-4 font-sans animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-sf-surface rounded-3xl border border-sf-divider shadow-xl p-8 text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-sf-primary/10 text-sf-primary flex items-center justify-center shadow-inner">
                    <Compass size={32} className="animate-spin-slow" />
                </div>

                <div className="space-y-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-sf-primary bg-sf-primary/10 px-3 py-1 rounded-full border border-sf-primary/20">
                        Error 404
                    </span>
                    <h1 className="text-2xl font-black text-sf-text tracking-tight pt-2">
                        {t('error.pageNotFound', 'Page Not Found')}
                    </h1>
                    <p className="text-sm text-sf-muted leading-relaxed">
                        {t('error.pageNotFoundDesc', 'The page you are looking for does not exist, has been relocated, or is restricted.')}
                    </p>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                    <Link
                        to="/"
                        className="w-full py-2.5 px-4 bg-sf-primary hover:bg-sf-primary-hover text-sf-on-primary rounded-xl text-sm font-bold shadow-md shadow-sf-primary/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Home size={16} />
                        {t('common.returnHome', 'Return to Dashboard')}
                    </Link>

                    <button
                        onClick={() => navigate(-1)}
                        className="w-full py-2 px-4 bg-sf-raised hover:bg-sf-hover text-sf-text rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 border border-sf-divider"
                    >
                        <ArrowLeft size={14} />
                        {t('common.goBack', 'Go Back')}
                    </button>
                </div>

                <div className="pt-4 border-t border-sf-divider flex items-center justify-center gap-4 text-xs text-sf-muted">
                    <Link to="/about" className="hover:text-sf-primary flex items-center gap-1 transition-colors">
                        <BookOpen size={12} /> {t('nav.about', 'About')}
                    </Link>
                    <span>·</span>
                    <Link to="/techstack" className="hover:text-sf-primary flex items-center gap-1 transition-colors">
                        <Layers size={12} /> {t('nav.techStack', 'Tech Stack')}
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
