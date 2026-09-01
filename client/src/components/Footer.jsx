import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Shield, Award } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Footer = () => {
    const currentYear = new Date().getFullYear();
    const { t } = useLanguage();

    return (
        <footer className="mt-auto border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Left: branding */}
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                        <span className="font-semibold text-gray-500 dark:text-gray-400">LIMS</span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span>{t('footer.systemName', 'Laboratory Information Management System')}</span>
                    </div>

                    {/* Center: links */}
                    <div className="flex items-center gap-4 text-xs">
                        <Link
                            to="/about"
                            className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                        >
                            <Shield size={12} />
                            {t('footer.about', 'About SoilFER')}
                        </Link>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <Link
                            to="/techstack"
                            className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                        >
                            <Award size={12} />
                            {t('footer.techstack', 'Tech Stack & Releases')}
                        </Link>
                    </div>

                    {/* Right: copyright */}
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                        <span>© {currentYear}</span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span className="flex items-center gap-1">
                            {t('footer.builtWith', 'Built with')} <Heart size={10} className="text-red-400" fill="currentColor" /> {t('footer.care', 'care')}
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
