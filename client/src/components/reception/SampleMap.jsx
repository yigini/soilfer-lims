import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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
        if (center) {
            map.setView(center, 13);
        }
    }, [center, map]);
    return null;
};

const SampleMap = ({ coordinates, title }) => {
    if (!coordinates || !coordinates.lat || !coordinates.lng) {
        return (
            <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                    <p className="text-gray-400 font-medium">No GPS coordinates available</p>
                </div>
            </div>
        );
    }

    const position = [coordinates.lat, coordinates.lng];

    return (
        <div className="h-64 rounded-xl overflow-hidden shadow-inner border border-gray-200 z-0">
            <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
                <ChangeView center={position} />
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={position}>
                    <Popup>
                        <div className="text-sm font-bold">{title || 'Sample Location'}</div>
                        <div className="text-xs text-gray-500">{coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}</div>
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
};

export default SampleMap;
