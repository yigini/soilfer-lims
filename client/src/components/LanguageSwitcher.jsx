import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Globe, Check } from 'lucide-react';

export const LanguageSwitcher = () => {
    const { locale, changeLanguage, availableLanguages } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);

    // Use dynamic languages from context (populated from DB, with comprehensive fallback)
    const languages = availableLanguages || [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Español' },
        { code: 'es-419', name: 'Español (América Latina)' },
        { code: 'fr', name: 'Français' },
        { code: 'pt', name: 'Português' }
    ];

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleSelect = (code) => {
        changeLanguage(code);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-full text-sf-muted hover:text-sf-text hover:bg-sf-hover transition-colors focus:outline-none focus:ring-2 focus:ring-sf-primary focus:ring-offset-2 focus:ring-offset-sf-surface"
                title="Change Language"
                aria-label="Change Language"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <Globe size={20} />
            </button>

            {isOpen && (
                <div 
                    role="listbox" 
                    className="absolute right-0 mt-2 w-56 bg-sf-surface rounded-xl shadow-xl z-50 overflow-hidden border border-sf-divider animate-in fade-in zoom-in-95 duration-150"
                >
                    <div className="text-[11px] font-bold text-sf-muted uppercase tracking-wider px-3.5 py-2.5 bg-sf-raised/40 border-b border-sf-divider">
                        Select Language
                    </div>
                    <div className="py-1">
                        {languages.map((l) => {
                            const isSelected = locale === l.code;
                            return (
                                <button
                                    key={l.code}
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleSelect(l.code)}
                                    className={`w-full text-left px-3.5 py-2 text-sm flex justify-between items-center transition-colors ${
                                        isSelected
                                            ? 'bg-sf-primary/10 text-sf-primary font-semibold'
                                            : 'text-sf-text hover:bg-sf-hover'
                                    }`}
                                >
                                    <span>{l.name}</span>
                                    {isSelected && <Check size={16} className="text-sf-primary shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
