import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { MapPinOff, AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in Leaflet + React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIconRetina,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to center map when coordinates change
const ChangeView = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.setView(center, 13);
        }
    }, [center, map]);
    return null;
};

const SampleMap = ({ coordinates, title, uncertaintyM }) => {
    const hasCoords = Boolean(coordinates && coordinates.lat && coordinates.lng);

    if (!hasCoords) {
        return (
            <div className="h-64 bg-amber-50/50 dark:bg-gray-800 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-amber-300 dark:border-amber-800/60 p-6 text-center">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full mb-2">
                    <MapPinOff size={24} />
                </div>
                <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                    No coordinates recorded in the field
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1">
                    This sample was logged without GPS coordinates. Contact the field survey team or check the delivery manifest.
                </p>
            </div>
        );
    }

    const lat = parseFloat(coordinates.lat);
    const lng = parseFloat(coordinates.lng);
    const position = [lat, lng];
    const uncertainty = uncertaintyM || coordinates.positionalUncertaintyM || coordinates.accuracy;

    return (
        <div className="h-64 rounded-xl overflow-hidden shadow-inner border border-gray-200 dark:border-gray-700 z-0">
            <MapContainer center={position} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <ChangeView center={position} />
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={position}>
                    <Popup>
                        <div className="text-xs font-mono">
                            <div className="font-bold text-gray-900">{title || 'Sample Location'}</div>
                            <div>{lat.toFixed(6)}, {lng.toFixed(6)}</div>
                            {uncertainty && <div>Uncertainty: &plusmn;{uncertainty}m</div>}
                        </div>
                    </Popup>
                </Marker>
                {uncertainty && uncertainty > 0 && (
                    <Circle
                        center={position}
                        radius={parseFloat(uncertainty)}
                        pathOptions={{
                            color: '#2563eb',
                            fillColor: '#3b82f6',
                            fillOpacity: 0.15,
                            weight: 1.5
                        }}
                    />
                )}
            </MapContainer>
        </div>
    );
};

export default SampleMap;
