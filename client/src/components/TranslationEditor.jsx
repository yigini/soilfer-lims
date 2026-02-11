import React, { useState, useEffect } from 'react';
import enTranslations from '../translations/en.json';

export const TranslationEditor = ({ language, translations, onSave, onClose }) => {
    const [editTranslations, setEditTranslations] = useState({});

    // Flatten nested JSON structure
    const flattenObject = (obj, prefix = '') => {
        return Object.keys(obj).reduce((acc, key) => {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                Object.assign(acc, flattenObject(obj[key], newKey));
            } else {
                acc[newKey] = obj[key];
            }
            return acc;
        }, {});
    };

    const flatEnglish = flattenObject(enTranslations);

    useEffect(() => {
        // Initialize with existing translations or empty strings
        const initial = {};
        Object.keys(flatEnglish).forEach(key => {
            initial[key] = translations[key] || '';
        });
        setEditTranslations(initial);
    }, [language]);

    const handleSave = () => {
        onSave(editTranslations);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-11/12 max-w-6xl h-5/6 flex flex-col shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Edit Translations: {language.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Translate from English to {language.name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
                            <tr>
                                <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 border-b dark:border-gray-600 w-1/4">
                                    Translation Key
                                </th>
                                <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 border-b dark:border-gray-600 w-3/8">
                                    English (Source)
                                </th>
                                <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 border-b dark:border-gray-600 w-3/8">
                                    {language.name} (Translation)
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(flatEnglish).map(key => (
                                <tr key={key} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="p-3 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 align-top">
                                        {key}
                                    </td>
                                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300 align-top">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                            {flatEnglish[key]}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top">
                                        <input
                                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            value={editTranslations[key] || ''}
                                            onChange={(e) => setEditTranslations(prev => ({ ...prev, [key]: e.target.value }))}
                                            placeholder={`Enter ${language.name} translation...`}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-center gap-2 mt-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        💡 Tip: Leave fields empty to fall back to English
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                        >
                            Save Translations
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
