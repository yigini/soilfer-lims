import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Globe } from 'lucide-react';

export const LanguageSwitcher = () => {
    const { locale, changeLanguage, availableLanguages } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    // Use dynamic languages from context (populated from DB, with hardcoded fallback)
    const languages = availableLanguages || [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Español' },
        { code: 'fr', name: 'Français' },
        { code: 'pt', name: 'Português' }
    ];

    const handleSelect = (code) => {
        changeLanguage(code);
        setIsOpen(false);
    };

    const currentLang = languages.find(l => l.code === locale) || { code: locale, name: locale.toUpperCase() };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Change Language"
            >
                <Globe size={20} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-50 overflow-hidden border border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 px-4 py-2 bg-gray-50 border-b">
                        Select Language
                    </div>
                    {languages.map(l => (
                        <button
                            key={l.code}
                            onClick={() => handleSelect(l.code)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex justify-between items-center ${locale === l.code ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                        >
                            <span>{l.name}</span>
                            {locale === l.code && <span className="text-blue-600">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
