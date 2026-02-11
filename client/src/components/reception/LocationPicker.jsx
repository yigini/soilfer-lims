
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Crosshair, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationPicker = ({ value, onChange }) => {
    // value = { lat, lng, accuracy: 'EXACT'|'APPROX'|'UNKNOWN', description }
    const [position, setPosition] = useState(value?.lat && value?.lng ? [value.lat, value.lng] : [15.783, -90.230]); // Default Guatemala
    const [zoom, setZoom] = useState(7);

    useEffect(() => {
        if (value?.lat && value?.lng) {
            setPosition([value.lat, value.lng]);
            setZoom(13);
        }
    }, [value]);

    const LocationMarker = () => {
        const map = useMapEvents({
            click(e) {
                const { lat, lng } = e.latlng;
                setPosition([lat, lng]);
                onChange({ ...value, lat, lng, accuracy: value?.accuracy || 'EXACT' });
                map.flyTo(e.latlng, map.getZoom());
            },
        });

        return position === null ? null : (
            <Marker position={position} draggable={true} eventHandlers={{
                dragend: (e) => {
                    const marker = e.target;
                    const { lat, lng } = marker.getLatLng();
                    setPosition([lat, lng]);
                    onChange({ ...value, lat, lng, accuracy: value?.accuracy || 'EXACT' });
                }
            }}>
                <Popup>
                    <span>Sample Location</span>
                </Popup>
            </Marker>
        );
    };

    const handleLocateMe = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude, accuracy } = pos.coords;
                    setPosition([latitude, longitude]);
                    onChange({
                        ...value,
                        lat: latitude,
                        lng: longitude,
                        accuracy: accuracy < 20 ? 'EXACT' : 'APPROX'
                    });
                    setZoom(15);
                },
                (err) => {
                    alert("Could not get your location.");
                }
            );
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <MapPin size={16} /> Map Location
                </label>
                <div className="flex gap-2">
                    <input
                        type="number"
                        step="0.00001"
                        placeholder="Latitude"
                        value={position ? position[0] : ''}
                        onChange={(e) => {
                            const lat = parseFloat(e.target.value);
                            if (!isNaN(lat)) {
                                setPosition([lat, position[1]]);
                                onChange({ ...value, lat, lng: position[1] });
                            }
                        }}
                        className="text-xs p-1 border rounded w-24"
                    />
                    <input
                        type="number"
                        step="0.00001"
                        placeholder="Longitude"
                        value={position ? position[1] : ''}
                        onChange={(e) => {
                            const lng = parseFloat(e.target.value);
                            if (!isNaN(lng)) {
                                setPosition([position[0], lng]);
                                onChange({ ...value, lat: position[0], lng });
                            }
                        }}
                        className="text-xs p-1 border rounded w-24"
                    />
                </div>
            </div>

            <div className="h-64 w-full rounded-xl overflow-hidden border border-gray-300 relative z-0">
                <MapContainer center={position} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker />
                </MapContainer>
                <button
                    type="button"
                    onClick={handleLocateMe}
                    className="absolute bottom-2 right-2 bg-white p-2 rounded shadow-md z-[400] text-gray-600 hover:text-blue-600"
                    title="Use My Location"
                >
                    <Crosshair size={20} />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Accuracy</label>
                    <select
                        className="w-full p-2 border rounded text-sm bg-white"
                        value={value?.accuracy || 'UNKNOWN'}
                        onChange={(e) => onChange({ ...value, accuracy: e.target.value })}
                    >
                        <option value="EXACT">Exact (GPS)</option>
                        <option value="APPROX">Approximate (Town/Area)</option>
                        <option value="UNKNOWN">Unknown</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Location Description</label>
                    <input
                        className="w-full p-2 border rounded text-sm"
                        placeholder="e.g. Field near river"
                        value={value?.description || ''}
                        onChange={(e) => onChange({ ...value, description: e.target.value })}
                    />
                </div>
            </div>
        </div>
    );
};

export default LocationPicker;
