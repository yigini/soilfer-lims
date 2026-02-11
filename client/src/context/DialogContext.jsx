
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, AlertCircle, CheckCircle, HelpCircle, Info } from 'lucide-react';

const DialogContext = createContext();

export const useDialog = () => {
    const context = useContext(DialogContext);
    if (!context) throw new Error('useDialog must be used within a DialogProvider');
    return context;
};

export const DialogProvider = ({ children }) => {
    const [dialog, setDialog] = useState(null);

    const [inputValue, setInputValue] = useState('');

    const showDialog = useCallback(({ title, message, type = 'info', onConfirm, onCancel, confirmText = 'OK', cancelText = 'Cancel', inputPlaceholder = '', defaultValue = '' }) => {
        setInputValue(defaultValue);
        setDialog({ title, message, type, onConfirm, onCancel, confirmText, cancelText, inputPlaceholder });
    }, []);

    const closeDialog = useCallback(() => {
        setDialog(null);
        setInputValue('');
    }, []);

    const handleConfirm = () => {
        if (!dialog) return;

        const callback = dialog.onConfirm;
        const type = dialog.type;
        const currentInputValue = inputValue;

        closeDialog(); // Close current dialog first

        if (callback) {
            if (type === 'prompt') {
                callback(currentInputValue);
            } else {
                callback();
            }
        }
    };

    const handleCancel = () => {
        if (dialog.onCancel) dialog.onCancel();
        closeDialog();
    };

    return (
        <DialogContext.Provider value={{ showDialog, closeDialog }}>
            {children}
            {dialog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-200">
                        {/* Status Bar */}
                        <div className={`h-2 ${dialog.type === 'error' ? 'bg-red-500' :
                            dialog.type === 'success' ? 'bg-emerald-500' :
                                dialog.type === 'confirm' || dialog.type === 'prompt' ? 'bg-blue-500' : 'bg-slate-500'
                            }`} />

                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-full shrink-0 ${dialog.type === 'error' ? 'bg-red-100 text-red-600' :
                                    dialog.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                        dialog.type === 'confirm' || dialog.type === 'prompt' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {dialog.type === 'error' && <AlertCircle size={24} />}
                                    {dialog.type === 'success' && <CheckCircle size={24} />}
                                    {(dialog.type === 'confirm' || dialog.type === 'prompt') && <HelpCircle size={24} />}
                                    {dialog.type === 'info' && <Info size={24} />}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{dialog.title}</h3>
                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{dialog.message}</p>

                                    {dialog.type === 'prompt' && (
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder={dialog.inputPlaceholder}
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                {dialog.onCancel || dialog.type === 'confirm' || dialog.type === 'prompt' ? (
                                    <button
                                        onClick={handleCancel}
                                        className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl font-semibold transition-all"
                                    >
                                        {dialog.cancelText}
                                    </button>
                                ) : null}
                                <button
                                    onClick={handleConfirm}
                                    className={`px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-opacity-30 transition-all ${dialog.type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200' :
                                        dialog.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200' :
                                            dialog.type === 'confirm' || dialog.type === 'prompt' ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200' :
                                                'bg-slate-800 hover:bg-slate-900 text-white shadow-slate-200'
                                        }`}
                                >
                                    {dialog.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
};
