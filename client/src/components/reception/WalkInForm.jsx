
import React from 'react';
import { User, MapPin, Clipboard, Sprout, HelpCircle, FlaskConical, Search, Shield, Bug } from 'lucide-react';
import LocationPicker from './LocationPicker';
import InfoTooltip from '../common/InfoTooltip';

const STATIC_PURPOSES = [
    { val: 'Research', label: 'Research', icon: Search, color: 'bg-violet-100 text-violet-700 border-violet-200' },
    { val: 'Compliance', label: 'Regulatory', icon: Shield, color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { val: 'Diagnosis', label: 'Problem Diagnosis', icon: Bug, color: 'bg-rose-100 text-rose-700 border-rose-200' },
];

const WalkInForm = ({ submitter, setSubmitter, sampling, setSampling, groups = [], onPurposeSelect }) => {

    const handleChange = (section, key, value) => {
        if (section === 'submitter') setSubmitter({ ...submitter, [key]: value });
        if (section === 'sampling') setSampling({ ...sampling, [key]: value });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

            {/* SUBMITTER */}
            <div className="bg-purple-50 p-6 rounded-xl border border-purple-200 shadow-sm">
                <h3 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <User size={20} /> 1. Submitter Details
                    <InfoTooltip text="Information about the laboratory customer or farmer submitting the samples." />
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <input
                        placeholder="First Name *"
                        className="p-2 border rounded"
                        value={submitter.name}
                        onChange={e => handleChange('submitter', 'name', e.target.value)}
                    />
                    <input
                        placeholder="Last Name *"
                        className="p-2 border rounded"
                        value={submitter.surname}
                        onChange={e => handleChange('submitter', 'surname', e.target.value)}
                    />
                    <div className="relative">
                        <input
                            placeholder="Phone (Required) *"
                            className="w-full p-2 border rounded"
                            value={submitter.phone}
                            onChange={e => handleChange('submitter', 'phone', e.target.value)}
                        />
                        <div className="absolute right-2 top-2"><InfoTooltip text="Essential for sending results via SMS or WhatsApp." /></div>
                    </div>
                    <input
                        placeholder="Email"
                        className="p-2 border rounded"
                        value={submitter.email}
                        onChange={e => handleChange('submitter', 'email', e.target.value)}
                    />
                    <input
                        placeholder="Organization / Farm Name"
                        className="p-2 border rounded md:col-span-2"
                        value={submitter.organization}
                        onChange={e => handleChange('submitter', 'organization', e.target.value)}
                    />
                    <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                            Contact Preference
                            <InfoTooltip text="How the client prefers to receive their final analysis report." />
                        </label>
                        <div className="flex gap-4 mt-1">
                            {['Phone', 'Email', 'WhatsApp', 'In-Person'].map(m => (
                                <label key={m} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="contactMethod"
                                        value={m}
                                        checked={submitter.contactMethod === m}
                                        onChange={e => handleChange('submitter', 'contactMethod', e.target.value)}
                                    />
                                    <span className="text-sm">{m}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* SAMPLING CONTEXT */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Sprout size={20} /> 2. Sample Context
                    <InfoTooltip text="Agronomic and environmental data helps experts interpret soil results more accurately." />
                </h3>

                {/* Row 1: Crops, Land Use, Date */}
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                            Crops
                            <InfoTooltip text="Providing crop history allows for tailored fertilizer recommendations." />
                        </label>
                        <input
                            placeholder="Current Crop"
                            className="w-full p-2 border rounded mb-2"
                            value={sampling.crop}
                            onChange={e => handleChange('sampling', 'crop', e.target.value)}
                        />
                        <input
                            placeholder="Previous Crop (Rotation)"
                            className="w-full p-2 border rounded text-sm bg-gray-50"
                            value={sampling.previousCrop || ''}
                            onChange={e => handleChange('sampling', 'previousCrop', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">Land Use & Management <InfoTooltip text="Current land use affects nutrient availability and fertilizer recommendations." /></label>
                        <select
                            className="w-full p-2 border rounded mb-2"
                            value={sampling.landUse}
                            onChange={e => handleChange('sampling', 'landUse', e.target.value)}
                        >
                            <option value="">-- Select Land Use --</option>
                            <option value="Cropland">Cropland</option>
                            <option value="Pasture">Pasture</option>
                            <option value="Forest">Forest</option>
                            <option value="Garden">Home Garden</option>
                            <option value="Greenhouse">Greenhouse</option>
                        </select>
                        <input
                            placeholder="Fertilizer / Manure Used?"
                            className="w-full p-2 border rounded text-sm bg-gray-50"
                            value={sampling.management || ''}
                            onChange={e => handleChange('sampling', 'management', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Collection Date
                            <InfoTooltip text="Date of physical collection in the field." />
                        </label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded"
                            value={sampling.date}
                            onChange={e => handleChange('sampling', 'date', e.target.value)}
                        />
                    </div>
                </div>

                {/* Row 2: Sampling Depth — full width */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
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
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
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
                                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                                }`}
                        >
                            Custom…
                        </button>
                    </div>
                    {sampling.depthType === 'Custom' && (
                        <div className="flex gap-2 items-center mt-3 p-3 bg-white rounded-lg border border-blue-100">
                            <input
                                type="number"
                                placeholder="From"
                                min="0"
                                className="w-24 p-2 border rounded text-sm text-center"
                                value={sampling.depthMin || ''}
                                onChange={e => handleChange('sampling', 'depthMin', e.target.value)}
                            />
                            <span className="text-gray-400 font-bold">–</span>
                            <input
                                type="number"
                                placeholder="To"
                                min="0"
                                className="w-24 p-2 border rounded text-sm text-center"
                                value={sampling.depthMax || ''}
                                onChange={e => handleChange('sampling', 'depthMax', e.target.value)}
                            />
                            <span className="text-sm text-gray-500 font-semibold">cm</span>
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                checked={sampling.isComposite || false}
                                onChange={e => handleChange('sampling', 'isComposite', e.target.checked)}
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
                                className="w-full p-2 border rounded"
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
                        <div className="flex flex-wrap gap-2">
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
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm'
                                        }`}
                                >
                                    <FlaskConical size={16} />
                                    {g.name}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${sampling.purpose === g.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {g.analyses?.length || 0}
                                    </span>
                                </button>
                            ))}

                            {/* Separator */}
                            {groups.length > 0 && <div className="w-px bg-gray-200 mx-1 self-stretch" />}

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
                                            ? `${sp.color} ring-2 ring-offset-1 shadow-md scale-[1.02]`
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
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
                                { val: 'Normal', color: 'bg-green-100 text-green-700 border-green-200' },
                                { val: 'Medium', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                                { val: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200' }
                            ].map(opt => (
                                <label key={opt.val} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${sampling.urgency === opt.val ? `ring-2 ring-offset-1 ${opt.color}` : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        name="urgency"
                                        value={opt.val}
                                        checked={(sampling.urgency || 'Normal') === opt.val}
                                        onChange={e => handleChange('sampling', 'urgency', e.target.value)}
                                        className="text-blue-600"
                                    />
                                    <span className="font-bold text-sm">{opt.val}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* LOCATION PICKER */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative z-0">
                <LocationPicker
                    value={{
                        lat: sampling.coordinates?.lat,
                        lng: sampling.coordinates?.lng,
                        accuracy: sampling.coordinates?.accuracy,
                        description: sampling.location
                    }}
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
                                }
                            } catch (e) {
                                console.warn("Reverse geocode failed", e);
                            }
                        }

                        // Spread val into coordinates
                        setSampling(prev => ({
                            ...prev,
                            location: locationDesc,
                            coordinates: { lat: val.lat, lng: val.lng, accuracy: val.accuracy }
                        }));
                    }}
                />
            </div>
        </div>
    );
};

export default WalkInForm;
