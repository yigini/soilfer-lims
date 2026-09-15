import React from 'react';
import { User, MapPin, Clipboard, Sprout, HelpCircle, FlaskConical, Search, Shield, Bug } from 'lucide-react';
import LocationPicker from './LocationPicker';
import InfoTooltip from '../common/InfoTooltip';
import { useLanguage } from '../../context/LanguageContext';

const WalkInForm = ({ submitter, setSubmitter, sampling, setSampling, groups = [], onPurposeSelect, errors = [] }) => {
    const { t } = useLanguage();

    const STATIC_PURPOSES = [
        { val: 'Research', label: t('reception.purposeResearch', 'Research'), icon: Search, color: 'bg-violet-100 text-violet-700 border-violet-200' },
        { val: 'Compliance', label: t('reception.purposeRegulatory', 'Regulatory'), icon: Shield, color: 'bg-amber-100 text-amber-700 border-amber-200' },
        { val: 'Diagnosis', label: t('reception.purposeDiagnosis', 'Problem Diagnosis'), icon: Bug, color: 'bg-rose-100 text-rose-700 border-rose-200' },
    ];

    const hasErr = (key) => errors.some(e => e.key === key);
    const errBorder = (key) => hasErr(key) ? 'border-red-400 ring-1 ring-red-200' : '';

    const handleChange = (section, key, value) => {
        if (section === 'submitter') setSubmitter({ ...submitter, [key]: value });
        if (section === 'sampling') setSampling({ ...sampling, [key]: value });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

            {/* SUBMITTER */}
            <div className="bg-purple-50/50 dark:bg-purple-950/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm">
                <h3 className="font-bold text-purple-900 dark:text-purple-300 mb-4 flex items-center gap-2">
                    <User size={20} /> {t('reception.submitterDetails', '1. Submitter Details')}
                    <InfoTooltip text={t('reception.submitterTooltip', 'Information about the laboratory customer or farmer submitting the samples.')} />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input
                        data-field-key="submitter.name"
                        placeholder={t('reception.firstName', 'First Name *')}
                        className={`p-2 border rounded-lg bg-sf-surface border-sf-divider text-sf-text ${errBorder('submitter.name')}`}
                        value={submitter.name}
                        onChange={e => handleChange('submitter', 'name', e.target.value)}
                    />
                    <input
                        placeholder={t('reception.lastName', 'Last Name *')}
                        className="p-2 border rounded-lg bg-sf-surface border-sf-divider text-sf-text"
                        value={submitter.surname}
                        onChange={e => handleChange('submitter', 'surname', e.target.value)}
                    />
                    <div className="relative">
                        <input
                            data-field-key="submitter.phone"
                            placeholder={t('reception.phoneReq', 'Phone (Required) *')}
                            className={`w-full p-2 border rounded-lg bg-sf-surface border-sf-divider text-sf-text ${errBorder('submitter.phone')}`}
                            value={submitter.phone}
                            onChange={e => handleChange('submitter', 'phone', e.target.value)}
                        />
                        <div className="absolute right-2 top-2"><InfoTooltip text={t('reception.phoneTooltip', 'Essential for sending results via SMS or WhatsApp.')} /></div>
                    </div>
                    <input
                        placeholder={t('reception.email', 'Email')}
                        className="p-2 border rounded-lg bg-sf-surface border-sf-divider text-sf-text"
                        value={submitter.email}
                        onChange={e => handleChange('submitter', 'email', e.target.value)}
                    />
                    <input
                        placeholder={t('reception.organization', 'Organization / Farm Name')}
                        className="p-2 border rounded-lg lg:col-span-2 bg-sf-surface border-sf-divider text-sf-text"
                        value={submitter.organization}
                        onChange={e => handleChange('submitter', 'organization', e.target.value)}
                    />
                    <div className="lg:col-span-2">
                        <label className="text-xs font-semibold text-sf-muted uppercase flex items-center gap-1">
                            {t('reception.contactPreference', 'Contact Preference')}
                            <InfoTooltip text={t('reception.contactPrefTooltip', 'How the client prefers to receive their final analysis report.')} />
                        </label>
                        <div className="flex flex-wrap gap-4 mt-1">
                            {['Phone', 'Email', 'WhatsApp', 'In-Person'].map(m => (
                                <label key={m} className="flex items-center gap-2 cursor-pointer text-sf-text">
                                    <input
                                        type="radio"
                                        name="contactMethod"
                                        value={m}
                                        checked={submitter.contactMethod === m}
                                        onChange={e => handleChange('submitter', 'contactMethod', e.target.value)}
                                        className="text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm">{t(`reception.pref${m.replace(/[^a-zA-Z]/g, '')}`, m)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* SAMPLING CONTEXT */}
            <div className="bg-sf-surface p-6 rounded-xl border border-sf-divider shadow-sm">
                <h3 className="font-bold text-sf-text mb-4 flex items-center gap-2">
                    <Sprout size={20} /> {t('reception.sampleContext', '2. Sample Context')}
                    <InfoTooltip text={t('reception.sampleContextTooltip', 'Agronomic and environmental data helps experts interpret soil results more accurately.')} />
                </h3>

                {/* Row 1: Crops, Land Use, Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-semibold text-sf-muted mb-1 flex items-center gap-1">
                            {t('reception.crops', 'Crops')}
                            <InfoTooltip text={t('reception.cropsTooltip', 'Providing crop history allows for tailored fertilizer recommendations.')} />
                        </label>
                        <input
                            placeholder={t('reception.currentCrop', 'Current Crop')}
                            className="w-full p-2 border rounded-lg mb-2 bg-sf-surface border-sf-divider text-sf-text"
                            value={sampling.crop}
                            onChange={e => handleChange('sampling', 'crop', e.target.value)}
                        />
                        <input
                            placeholder={t('reception.previousCrop', 'Previous Crop (Rotation)')}
                            className="w-full p-2 border rounded-lg text-sm bg-sf-canvas border-sf-divider text-sf-text"
                            value={sampling.previousCrop || ''}
                            onChange={e => handleChange('sampling', 'previousCrop', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-sf-muted mb-1 flex items-center gap-1">
                            {t('reception.landUse', 'Land Use & Management')} 
                            <InfoTooltip text={t('reception.landUseTooltip', 'Current land use affects nutrient availability and fertilizer recommendations.')} />
                        </label>
                        <select
                            className="w-full p-2 border rounded-lg mb-2 bg-sf-surface border-sf-divider text-sf-text"
                            value={sampling.landUse}
                            onChange={e => handleChange('sampling', 'landUse', e.target.value)}
                        >
                            <option value="">{t('reception.selectLandUse', '-- Select Land Use --')}</option>
                            <option value="Cropland">{t('reception.cropland', 'Cropland')}</option>
                            <option value="Pasture">{t('reception.pasture', 'Pasture')}</option>
                            <option value="Forest">{t('reception.forest', 'Forest')}</option>
                            <option value="Garden">{t('reception.garden', 'Home Garden')}</option>
                            <option value="Greenhouse">{t('reception.greenhouse', 'Greenhouse')}</option>
                        </select>
                        <input
                            placeholder={t('reception.fertilizerUsed', 'Fertilizer / Manure Used?')}
                            className="w-full p-2 border rounded-lg text-sm bg-sf-canvas border-sf-divider text-sf-text"
                            value={sampling.management || ''}
                            onChange={e => handleChange('sampling', 'management', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-sf-muted mb-1">
                            {t('reception.collectionDate', 'Collection Date')}
                            <InfoTooltip text={t('reception.collectionDateTooltip', 'Date of physical collection in the field.')} />
                        </label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded-lg bg-sf-surface border-sf-divider text-sf-text"
                            value={sampling.date}
                            onChange={e => handleChange('sampling', 'date', e.target.value)}
                        />
                    </div>
                </div>

                {/* Row 2: Sampling Depth — full width */}
                <div data-field-key="depth" className={`p-4 bg-sf-canvas rounded-xl border ${hasErr('depth') ? 'border-red-400 ring-1 ring-red-200' : 'border-sf-divider'}`}>
                    <label className="block text-xs font-semibold text-sf-muted mb-2 flex items-center gap-1">
                        Sampling Depth
                        <InfoTooltip text="Select the standard soil horizon or enter a custom depth range." />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: '0–20 cm', val: '0-20' },
                            { label: '20–40 cm', val: '20-40' },
                            { label: '0–30 cm', val: '0-30' },
                            { label: '30–60 cm', val: '30-60' },
                        ].map(opt => (
                            <button
                                key={opt.val}
                                type="button"
                                onClick={() => setSampling(prev => ({ ...prev, depthType: opt.val, depth: opt.label }))}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border cursor-pointer ${sampling.depthType === opt.val
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-sf-surface text-sf-muted border-sf-divider hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-sf-raised hover:text-sf-text'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setSampling(prev => ({ ...prev, depthType: 'Custom', depth: '' }))}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border cursor-pointer ${sampling.depthType === 'Custom'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-sf-surface text-sf-muted border-sf-divider hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-sf-raised hover:text-sf-text'
                                    }`}
                        >
                            Custom…
                        </button>
                    </div>
                    {sampling.depthType === 'Custom' && (
                        <div className="flex gap-2 items-center mt-3 p-3 bg-sf-surface rounded-lg border border-sf-divider">
                            <input
                                type="number"
                                placeholder="From"
                                min="0"
                                className="w-24 p-2 border rounded-lg text-sm text-center bg-sf-surface border-sf-divider text-sf-text"
                                value={sampling.depthMin || ''}
                                onChange={e => handleChange('sampling', 'depthMin', e.target.value)}
                            />
                            <span className="text-sf-muted font-bold">–</span>
                            <input
                                type="number"
                                placeholder="To"
                                min="0"
                                className="w-24 p-2 border rounded-lg text-sm text-center bg-sf-surface border-sf-divider text-sf-text"
                                value={sampling.depthMax || ''}
                                onChange={e => handleChange('sampling', 'depthMax', e.target.value)}
                            />
                            <span className="text-sm text-sf-muted font-semibold">cm</span>
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-sf-divider grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="flex items-center gap-2 mb-2 text-sf-text">
                            <input
                                type="checkbox"
                                checked={sampling.isComposite || false}
                                onChange={e => handleChange('sampling', 'isComposite', e.target.checked)}
                                className="text-blue-600 focus:ring-blue-500 rounded"
                            />
                            <span className="font-semibold text-sm flex items-center gap-1">
                                Composite Sample?
                                <InfoTooltip text="Was this sample mixed from multiple spots in the field? (Recommended)" />
                            </span>
                        </label>
                        {sampling.isComposite && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Sub-samples count"
                                    className="w-full p-2 border rounded-lg bg-sf-surface border-sf-divider text-sf-text text-sm"
                                    value={sampling.subsamples || ''}
                                    onChange={e => handleChange('sampling', 'subsamples', e.target.value)}
                                />
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        placeholder="Composite Radius"
                                        className="w-full p-2 pr-8 border rounded-lg bg-sf-surface border-sf-divider text-sf-text text-sm"
                                        value={sampling.compositeRadiusM || ''}
                                        onChange={e => {
                                            const r = parseFloat(e.target.value);
                                            const rad = isNaN(r) ? '' : r;
                                            handleChange('sampling', 'compositeRadiusM', rad);
                                            if (rad && (!sampling.positionalUncertaintyM || sampling.positionalUncertaintyM < rad)) {
                                                handleChange('sampling', 'positionalUncertaintyM', rad);
                                            }
                                        }}
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">&plusmn;m</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-sf-muted mb-2 flex items-center gap-1">
                            Purpose of Testing
                            <InfoTooltip text="Select the testing purpose. Group-based options will auto-suggest the matching analysis bundle." />
                        </label>
                        <div className={`flex flex-wrap gap-2 ${hasErr('purpose') ? 'p-2 rounded-xl border border-red-400 ring-1 ring-red-200' : ''}`}>
                            {/* Dynamic buttons from admin analysis groups */}
                            {groups.map(g => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => {
                                        setSampling(prev => ({ ...prev, purpose: g.id }));
                                        if (onPurposeSelect) onPurposeSelect(g.id, g.id);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border cursor-pointer ${sampling.purpose === g.id
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]'
                                        : 'bg-sf-surface text-sf-muted border-sf-divider hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-sf-raised hover:text-sf-text hover:shadow-sm'
                                        }`}
                                >
                                    <FlaskConical size={16} />
                                    {g.name}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${sampling.purpose === g.id ? 'bg-white/20' : 'bg-sf-canvas border border-sf-divider text-sf-muted'
                                        }`}>
                                        {g.analyses?.length || 0}
                                    </span>
                                </button>
                            ))}

                            {/* Separator */}
                            {groups.length > 0 && <div className="w-px bg-sf-divider mx-1 self-stretch" />}

                            {/* Static expert options */}
                            {STATIC_PURPOSES.map(sp => (
                                <button
                                    key={sp.val}
                                    type="button"
                                    onClick={() => {
                                        setSampling(prev => ({ ...prev, purpose: sp.val }));
                                        if (onPurposeSelect) onPurposeSelect(sp.val, null);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border cursor-pointer ${sampling.purpose === sp.val
                                        ? `${sp.color} ring-2 ring-offset-1 shadow-md scale-[1.02] dark:bg-opacity-20`
                                        : 'bg-sf-surface text-sf-muted border-sf-divider hover:border-sf-divider hover:bg-sf-canvas hover:text-sf-text hover:shadow-sm'
                                        }`}
                                >
                                    <sp.icon size={16} />
                                    {sp.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Urgency Selector */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-sf-muted mb-1 flex items-center gap-1">
                            Processing Urgency
                            <InfoTooltip text="Priority level for lab processing. Urgent samples are prioritized in the queue." />
                        </label>
                        <div className="flex gap-4">
                            {[
                                { val: 'Normal', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' },
                                { val: 'Medium', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
                                { val: 'Urgent', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' }
                            ].map(opt => (
                                <label key={opt.val} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${sampling.urgency === opt.val ? `ring-2 ring-offset-1 ${opt.color}` : 'border-sf-divider hover:bg-sf-canvas text-sf-text'}`}>
                                    <input
                                        type="radio"
                                        name="urgency"
                                        value={opt.val}
                                        checked={(sampling.urgency || 'Normal') === opt.val}
                                        onChange={e => handleChange('sampling', 'urgency', e.target.value)}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="font-bold text-sm">{opt.val}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* LOCATION PICKER */}
            <div data-field-key="location" className={`bg-sf-surface p-6 rounded-xl border shadow-sm relative z-0 ${hasErr('location') ? 'border-red-400 ring-1 ring-red-200' : 'border-sf-divider'}`}>
                <h3 className="font-bold text-sf-text mb-4 flex items-center gap-2">
                    <MapPin size={20} /> 3. Sampling Location
                </h3>
                <LocationPicker
                    value={{
                        lat: sampling.coordinates?.lat,
                        lng: sampling.coordinates?.lng,
                        accuracy: sampling.coordinates?.accuracy,
                        elevation: sampling.coordinates?.elevation,
                        description: sampling.location
                    }}
                    captureMethod={sampling.captureMethod || 'MAP_PIN'}
                    onCaptureMethodChange={(method) => handleChange('sampling', 'captureMethod', method)}
                    confidence={sampling.locationConfidence}
                    onConfidenceChange={(level) => handleChange('sampling', 'locationConfidence', level)}
                    positionalUncertaintyM={sampling.positionalUncertaintyM}
                    onPositionalUncertaintyChange={(u) => handleChange('sampling', 'positionalUncertaintyM', u)}
                    locationSource={sampling.locationSource}
                    onLocationSourceChange={(s) => handleChange('sampling', 'locationSource', s)}
                    siteName={sampling.siteName}
                    onSiteNameChange={(v) => handleChange('sampling', 'siteName', v)}
                    areaVillage={sampling.areaVillage}
                    onAreaVillageChange={(v) => handleChange('sampling', 'areaVillage', v)}
                    district={sampling.district}
                    onDistrictChange={(v) => handleChange('sampling', 'district', v)}
                    landmark={sampling.landmark}
                    onLandmarkChange={(v) => handleChange('sampling', 'landmark', v)}
                    uncertaintyReason={sampling.locationUncertaintyReason}
                    onUncertaintyReasonChange={(v) => handleChange('sampling', 'locationUncertaintyReason', v)}
                    errors={errors}
                    onChange={async (val) => {
                        let locationDesc = val.description || sampling.location;

                        // Update coordinates immediately to avoid stale closure race conditions
                        setSampling(prev => ({
                            ...prev,
                            location: locationDesc,
                            coordinates: {
                                lat: val.lat,
                                lng: val.lng,
                                accuracy: val.accuracy,
                                elevation: val.elevation
                            }
                        }));

                        // Reverse Geocode using secure server proxy (RC-08)
                        if (val.lat && val.lng && (!locationDesc || locationDesc.startsWith('Near '))) {
                            try {
                                const token = localStorage.getItem('token');
                                const res = await fetch(`/api/reception/reverse-geocode?lat=${val.lat}&lng=${val.lng}`, {
                                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    if (data.displayName || data.village || data.municipality) {
                                        const resolvedDesc = data.displayName || `${data.village || data.municipality}, ${data.district}`;
                                        setSampling(prev => ({
                                            ...prev,
                                            location: resolvedDesc
                                        }));
                                        if (!sampling.areaVillage && (data.village || data.municipality)) {
                                            handleChange('sampling', 'areaVillage', data.village || data.municipality);
                                        }
                                        if (!sampling.district && data.district) {
                                            handleChange('sampling', 'district', data.district);
                                        }
                                    }
                                }
                            } catch (e) {
                                console.warn("Reverse geocode failed", e);
                            }
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default WalkInForm;
