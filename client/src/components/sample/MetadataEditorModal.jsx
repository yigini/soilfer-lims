
import React, { useState, useEffect } from 'react';
import { X, Save, MapPin } from 'lucide-react';
import LocationPicker from '../reception/LocationPicker';

const MetadataEditorModal = ({ isOpen, onClose, sample, onSave }) => {
    if (!isOpen || !sample) return null;

    const [formData, setFormData] = useState({});

    // Helper to get initial value from fieldMetadata
    const getVal = (key) => sample.fieldMetadata?.[key]?.value || '';

    useEffect(() => {
        if (sample) {
            setFormData({
                // Identification
                projectCode: sample.projectCode || getVal('projectCode'),
                submitterName: getVal('submitterName'),
                submitterPhone: getVal('submitterPhone'),
                submitterEmail: getVal('submitterEmail'),
                organization: getVal('organization'),
                contactMethod: getVal('contactMethod'),

                // Location
                siteName: getVal('siteName'),
                locationDescription: getVal('locationDescription'),
                latitude: getVal('latitude'),
                longitude: getVal('longitude'),
                gpsAccuracy: getVal('gpsAccuracy'),
                elevation: getVal('elevation'),
                admin1: getVal('admin1'), // Region
                admin2: getVal('admin2'), // District

                // Sampling
                collectionDate: sample.collectionDate || getVal('collectionDate'),
                depthType: getVal('depthType'),
                depthTop: getVal('depthTop'),
                depthBottom: getVal('depthBottom'),
                samplingPurpose: getVal('samplingPurpose'),
                numberOfSubsamples: getVal('numberOfSubsamples'),
                isComposite: getVal('isComposite'),

                // Land Use
                landUse: getVal('landUse'),
                crop: getVal('crop'),
                previousCrop: getVal('previousCrop'),
                managementPractices: getVal('managementPractices'),
                fertilizer: getVal('fertilizer')
            });
        }
    }, [sample]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleLocationChange = (loc) => {
        setFormData(prev => ({
            ...prev,
            latitude: loc.lat,
            longitude: loc.lng,
            gpsAccuracy: loc.accuracy,
            locationDescription: loc.description || prev.locationDescription
        }));
    };

    const handleSubmit = () => {
        onSave(formData);
    };

    const Section = ({ title, children }) => (
        <div className="mb-6 border-b border-gray-100 pb-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {children}
            </div>
        </div>
    );

    const Input = ({ label, name, type = "text", placeholder }) => (
        <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
            <input
                type={type}
                name={name}
                value={formData[name] || ''}
                onChange={handleChange}
                placeholder={placeholder}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
        </div>
    );

    const Select = ({ label, name, options }) => (
        <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
            <select
                name={name}
                value={formData[name] || ''}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
                <option value="">Select...</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Edit2Icon className="w-5 h-5 text-blue-600" />
                        Edit Sample Metadata
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6">

                    <Section title="Identification">
                        <Input label="Project Code" name="projectCode" />
                        <Input label="Site Name" name="siteName" />
                        <Input label="Submitter Name" name="submitterName" />
                        <Input label="Organization" name="organization" />
                        <Input label="Phone" name="submitterPhone" />
                        <Input label="Email" name="submitterEmail" />
                    </Section>

                    <Section title="Location">
                        <div className="md:col-span-2 mb-4">
                            <LocationPicker
                                value={{
                                    lat: parseFloat(formData.latitude),
                                    lng: parseFloat(formData.longitude),
                                    accuracy: formData.gpsAccuracy,
                                    description: formData.locationDescription
                                }}
                                onChange={handleLocationChange}
                            />
                        </div>
                        <Input label="Region (Admin 1)" name="admin1" />
                        <Input label="District (Admin 2)" name="admin2" />
                        <Input label="Elevation (m)" name="elevation" type="number" />
                    </Section>

                    <Section title="Sampling Design">
                        <Input label="Collection Date" name="collectionDate" type="date" />
                        <Input label="Sampling Purpose" name="samplingPurpose" />
                        <Select label="Depth Range (cm)" name="depthType" options={['0-20', '0-30', '0-15', '30-60', 'Custom']} />
                        <div className="flex gap-2">
                            <Input label="Top (cm)" name="depthTop" type="number" />
                            <Input label="Bottom (cm)" name="depthBottom" type="number" />
                        </div>
                        <Select label="Composite?" name="isComposite" options={['true', 'false']} />
                        <Input label="Subsamples" name="numberOfSubsamples" type="number" />
                    </Section>

                    <Section title="Land Use & Management">
                        <Select label="Land Use" name="landUse" options={['Cropland', 'Forest', 'Grassland', 'Wetland', 'Other']} />
                        <Input label="Current Crop" name="crop" />
                        <Input label="Previous Crop" name="previousCrop" />
                        <Input label="Management Notes" name="managementPractices" placeholder="e.g. Tillage, Residue..." />
                        <Input label="Fertilizer History" name="fertilizer" />
                    </Section>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-200 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
                        <Save size={18} /> Save Changes
                    </button>
                </div>

            </div>
        </div>
    );
};

// Helper for icon
const Edit2Icon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
);

export default MetadataEditorModal;
