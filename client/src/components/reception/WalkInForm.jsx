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
            <div className="bg-purple-50 dark:bg-purple-900/10 p-6 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm">
                <h3 className="font-bold text-purple-900 dark:text-purple-300 mb-4 flex items-center gap-2">
                    <User size={20} /> {t('reception.submitterDetails', '1. Submitter Details')}
                    <InfoTooltip text={t('reception.submitterTooltip', 'Information about the laboratory customer or farmer submitting the samples.')} />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input
                        placeholder={t('reception.firstName', 'First Name *')}
                        className={`p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 ${errBorder('submitter.name')}`}
                        value={submitter.name}
                        onChange={e => handleChange('submitter', 'name', e.target.value)}
                    />
                    <input
                        placeholder={t('reception.lastName', 'Last Name *')}
                        className="p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                        value={submitter.surname}
                        onChange={e => handleChange('submitter', 'surname', e.target.value)}
                    />
                    <div className="relative">
                        <input
                            placeholder={t('reception.phoneReq', 'Phone (Required) *')}
                            className={`w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 ${errBorder('submitter.phone')}`}
                            value={submitter.phone}
                            onChange={e => handleChange('submitter', 'phone', e.target.value)}
                        />
                        <div className="absolute right-2 top-2"><InfoTooltip text={t('reception.phoneTooltip', 'Essential for sending results via SMS or WhatsApp.')} /></div>
                    </div>
                    <input
                        placeholder={t('reception.email', 'Email')}
                        className="p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                        value={submitter.email}
                        onChange={e => handleChange('submitter', 'email', e.target.value)}
                    />
                    <input
                        placeholder={t('reception.organization', 'Organization / Farm Name')}
                        className="p-2 border rounded lg:col-span-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                        value={submitter.organization}
                        onChange={e => handleChange('submitter', 'organization', e.target.value)}
                    />
                    <div className="lg:col-span-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                            {t('reception.contactPreference', 'Contact Preference')}
                            <InfoTooltip text={t('reception.contactPrefTooltip', 'How the client prefers to receive their final analysis report.')} />
                        </label>
                        <div className="flex flex-wrap gap-4 mt-1">
                            {['Phone', 'Email', 'WhatsApp', 'In-Person'].map(m => (
                                <label key={m} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
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
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                    <Sprout size={20} /> {t('reception.sampleContext', '2. Sample Context')}
                    <InfoTooltip text={t('reception.sampleContextTooltip', 'Agronomic and environmental data helps experts interpret soil results more accurately.')} />
                </h3>

                {/* Row 1: Crops, Land Use, Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                            {t('reception.crops', 'Crops')}
                            <InfoTooltip text={t('reception.cropsTooltip', 'Providing crop history allows for tailored fertilizer recommendations.')} />
                        </label>
                        <input
                            placeholder={t('reception.currentCrop', 'Current Crop')}
                            className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            value={sampling.crop}
                            onChange={e => handleChange('sampling', 'crop', e.target.value)}
                        />
                        <input
                            placeholder={t('reception.previousCrop', 'Previous Crop (Rotation)')}
                            className="w-full p-2 border rounded text-sm bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-200"
                            value={sampling.previousCrop || ''}
                            onChange={e => handleChange('sampling', 'previousCrop', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                            {t('reception.landUse', 'Land Use & Management')} 
                            <InfoTooltip text={t('reception.landUseTooltip', 'Current land use affects nutrient availability and fertilizer recommendations.')} />
                        </label>
                        <select
                            className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
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
                            className="w-full p-2 border rounded text-sm bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-200"
                            value={sampling.management || ''}
                            onChange={e => handleChange('sampling', 'management', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                            {t('reception.collectionDate', 'Collection Date')}
                            <InfoTooltip text={t('reception.collectionDateTooltip', 'Date of physical collection in the field.')} />
                        </label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            value={sampling.date}
                            onChange={e => handleChange('sampling', 'date', e.target.value)}
                        />
                    </div>
                </div>

                {/* Row 2: Sampling Depth — full width */}
                <div className={`p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border ${hasErr('depth') ? 'border-red-400 ring-1 ring-red-200' : 'border-gray-100 dark:border-gray-700'}`}>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
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
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700'
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
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            Custom…
                        </button>
                    </div>
                    {sampling.depthType === 'Custom' && (
                        <div className="flex gap-2 items-center mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-gray-700">
                            <input
                                type="number"
                                placeholder="From"
                                min="0"
                                className="w-24 p-2 border rounded text-sm text-center dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                value={sampling.depthMin || ''}
                                onChange={e => handleChange('sampling', 'depthMin', e.target.value)}
                            />
                            <span className="text-gray-400 font-bold">–</span>
                            <input
                                type="number"
                                placeholder="To"
                                min="0"
                                className="w-24 p-2 border rounded text-sm text-center dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                value={sampling.depthMax || ''}
                                onChange={e => handleChange('sampling', 'depthMax', e.target.value)}
                            />
                            <span className="text-sm text-gray-500 font-semibold">cm</span>
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="flex items-center gap-2 mb-2 text-gray-700 dark:text-gray-300">
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
                            <input
                                type="number"
                                placeholder="Number of Sub-samples"
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                value={sampling.subsamples || ''}
                                onChange={e => handleChange('sampling', 'subsamples', e.target.value)}
                            />
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
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
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:shadow-sm'
                                        }`}
                                >
                                    <FlaskConical size={16} />
                                    {g.name}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${sampling.purpose === g.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                        }`}>
                                        {g.analyses?.length || 0}
                                    </span>
                                </button>
                            ))}

                            {/* Separator */}
                            {groups.length > 0 && <div className="w-px bg-gray-200 dark:bg-gray-600 mx-1 self-stretch" />}

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
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm'
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
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                            Processing Urgency
                            <InfoTooltip text="Priority level for lab processing. Urgent samples are prioritized in the queue." />
                        </label>
                        <div className="flex gap-4">
                            {[
                                { val: 'Normal', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' },
                                { val: 'Medium', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
                                { val: 'Urgent', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' }
                            ].map(opt => (
                                <label key={opt.val} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${sampling.urgency === opt.val ? `ring-2 ring-offset-1 ${opt.color}` : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
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
            <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl border shadow-sm relative z-0 ${hasErr('location') ? 'border-red-400 ring-1 ring-red-200' : 'border-gray-200 dark:border-gray-700'}`}>
                <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
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

                        // Auto-Reverse Geocode if coordinates changed and desc is empty or previous auto
                        if (val.lat && val.lng && (!locationDesc || locationDesc.startsWith('Near '))) {
                            try {
                                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${val.lat}&lon=${val.lng}&zoom=14`);
                                if (res.ok) {
                                    const data = await res.json();
                                    const address = data.address;
                                    const town = address.town || address.village || address.city || address.county || address.state;
                                    if (town) {
                                        locationDesc = `${town}, ${address.country_code?.toUpperCase()}`;
                                    }
                                    // Auto-fill structured fields from reverse geocode
                                    if (!sampling.areaVillage && (address.village || address.town)) {
                                        handleChange('sampling', 'areaVillage', address.village || address.town);
                                    }
                                    if (!sampling.district && (address.county || address.state)) {
                                        handleChange('sampling', 'district', address.county || address.state);
                                    }
                                }
                            } catch (e) {
                                console.warn("Reverse geocode failed", e);
                            }
                        }

                        // Spread val into coordinates
                        setSampling(prev => ({
                            ...prev,
                            location: locationDesc,
                            coordinates: { lat: val.lat, lng: val.lng, accuracy: val.accuracy, elevation: val.elevation }
                        }));
                    }}
                />
            </div>
        </div>
    );
};

export default WalkInForm;
