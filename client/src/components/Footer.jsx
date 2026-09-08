import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Shield, Award } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Footer = () => {
    const currentYear = new Date().getFullYear();
    const { t } = useLanguage();

    return (
        <footer className="mt-auto border-t border-sf-divider bg-sf-surface/80 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Left: branding */}
                    <div className="flex items-center gap-2 text-xs text-sf-muted">
                        <span className="font-semibold text-sf-text">LIMS</span>
                        <span className="text-sf-divider">•</span>
                        <span>{t('footer.systemName', 'Laboratory Information Management System')}</span>
                    </div>

                    {/* Center: links */}
                    <div className="flex items-center gap-4 text-xs">
                        <Link
                            to="/about"
                            className="flex items-center gap-1.5 text-sf-muted hover:text-sf-primary transition-colors font-medium"
                        >
                            <Shield size={12} />
                            {t('footer.about', 'About SoilFER')}
                        </Link>
                        <span className="text-sf-divider">•</span>
                        <Link
                            to="/techstack"
                            className="flex items-center gap-1.5 text-sf-muted hover:text-sf-primary transition-colors font-medium"
                        >
                            <Award size={12} />
                            {t('footer.techstack', 'Tech Stack & Releases')}
                        </Link>
                    </div>

                    {/* Right: copyright */}
                    <div className="flex items-center gap-1.5 text-[11px] text-sf-muted">
                        <span>© {currentYear}</span>
                        <span className="text-sf-divider">•</span>
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
