
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

    const handleCancel = useCallback(() => {
        if (dialog?.onCancel) dialog.onCancel();
        closeDialog();
    }, [dialog, closeDialog]);

    // Close on Escape key
    React.useEffect(() => {
        if (!dialog) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dialog, handleCancel]);

    return (
        <DialogContext.Provider value={{ showDialog, closeDialog }}>
            {children}
            {dialog && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="dialog-title"
                >
                    <div className="bg-sf-surface border border-sf-divider rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-200">
                        {/* Status Bar */}
                        <div className={`h-2 ${dialog.type === 'error' ? 'bg-rose-500' :
                            dialog.type === 'success' ? 'bg-emerald-500' :
                                dialog.type === 'confirm' || dialog.type === 'prompt' ? 'bg-sf-primary' : 'bg-sf-divider'
                            }`} />

                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-full shrink-0 ${dialog.type === 'error' ? 'bg-rose-500/10 text-rose-500' :
                                    dialog.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                        dialog.type === 'confirm' || dialog.type === 'prompt' ? 'bg-sf-primary/10 text-sf-primary' : 'bg-sf-raised text-sf-muted'
                                    }`}>
                                    {dialog.type === 'error' && <AlertCircle size={24} />}
                                    {dialog.type === 'success' && <CheckCircle size={24} />}
                                    {(dialog.type === 'confirm' || dialog.type === 'prompt') && <HelpCircle size={24} />}
                                    {dialog.type === 'info' && <Info size={24} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 id="dialog-title" className="text-xl font-bold text-sf-text mb-2">{dialog.title}</h3>
                                    <p className="text-sf-muted leading-relaxed mb-4 text-sm">{dialog.message}</p>

                                    {dialog.type === 'prompt' && (
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder={dialog.inputPlaceholder}
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                                            className="w-full px-4 py-3 bg-sf-canvas border border-sf-divider rounded-xl outline-none focus:ring-2 focus:ring-sf-primary transition-all text-sf-text placeholder:text-sf-muted"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                {dialog.onCancel || dialog.type === 'confirm' || dialog.type === 'prompt' ? (
                                    <button
                                        onClick={handleCancel}
                                        className="px-5 py-2.5 text-sf-muted hover:text-sf-text hover:bg-sf-hover rounded-xl font-semibold transition-all text-sm"
                                    >
                                        {dialog.cancelText}
                                    </button>
                                ) : null}
                                <button
                                    onClick={handleConfirm}
                                    className={`px-6 py-2.5 rounded-xl font-bold shadow-md transition-all text-sm ${dialog.type === 'error' ? 'bg-rose-600 hover:bg-rose-700 text-white' :
                                        dialog.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :
                                            dialog.type === 'confirm' || dialog.type === 'prompt' ? 'bg-sf-primary hover:bg-sf-primary-hover text-sf-on-primary' :
                                                'bg-sf-raised hover:bg-sf-hover text-sf-text'
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
