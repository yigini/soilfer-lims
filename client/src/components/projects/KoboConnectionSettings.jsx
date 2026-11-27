import React, { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';

// Lets a lab manager fix the Kobo server, form or token of an existing connection.
// The stored token is never shown; leaving the token box empty keeps it.
export default function KoboConnectionSettings({ projectId, config, onSaved }) {
    const { t } = useLanguage();
    const [serverUrl, setServerUrl] = useState(config.koboServerUrl || 'https://kf.kobotoolbox.org');
    const [formId, setFormId] = useState(config.formId || config.koboFormId || '');
    const [apiToken, setApiToken] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);

    const save = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const body = { koboServerUrl: serverUrl.trim(), formId: formId.trim() };
            if (apiToken.trim()) body.apiToken = apiToken.trim();
            const res = await axios.put(`/api/projects/${projectId}/kobo-connections/${config.configId}`, body);
            setApiToken('');
            const test = res.data.connectionTest;
            if (test && !test.success) {
                setMessage({ ok: false, text: t('projects.connections.settingsSavedTestFailed', 'Saved, but Kobo did not accept these details, so the connection stays disabled. Check that the token comes from the same server as the form.') });
            } else {
                setMessage({ ok: true, text: test?.formName
                    ? t('projects.connections.settingsSavedConnected', 'Saved and connected to form "{name}".').replace('{name}', test.formName)
                    : t('projects.connections.settingsSaved', 'Connection settings saved.') });
            }
            if (typeof onSaved === 'function') await onSaved();
        } catch (err) {
            setMessage({ ok: false, text: err.response?.data?.message || err.message || t('projects.connections.settingsSaveFailed', 'Could not save the connection settings.') });
        } finally {
            setBusy(false);
        }
    };

    const inputClass = 'mt-1 w-full text-xs font-mono rounded-lg border border-sf-border bg-sf-surface p-2 text-sf-text';
    return (
        <details className="border-t border-sf-divider pt-3">
            <summary className="text-sm font-semibold text-sf-text cursor-pointer">
                {t('projects.connections.settingsTitle', 'Connection settings')}
            </summary>
            <fieldset disabled={busy} className="min-w-0 grid grid-cols-1 gap-3 mt-3">
                <label className="text-xs text-sf-muted">
                    {t('projects.create.koboServerUrl', 'Kobo server URL')}
                    <input type="url" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="https://kf.kobotoolbox.org" className={inputClass} />
                </label>
                <label className="text-xs text-sf-muted">
                    {t('projects.connections.koboForm', 'Form / asset ID')}
                    <input type="text" value={formId} onChange={e => setFormId(e.target.value)} className={inputClass} />
                </label>
                <label className="text-xs text-sf-muted">
                    {t('projects.connections.newApiToken', 'New API token (leave empty to keep the current one)')}
                    <input type="password" autoComplete="off" value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="••••••••••••" className={inputClass} />
                </label>
            </fieldset>
            {message && (
                <p role={message.ok ? 'status' : 'alert'} className={`text-xs mt-3 ${message.ok ? 'text-sf-text' : 'text-red-600 dark:text-red-300'}`}>
                    {message.text}
                </p>
            )}
            <button type="button" onClick={save} disabled={busy || !serverUrl.trim() || !formId.trim()} className="btn-secondary text-xs mt-3">
                {busy ? t('common.saving', 'Saving…') : t('projects.connections.saveAndTest', 'Save and test')}
            </button>
        </details>
    );
}
