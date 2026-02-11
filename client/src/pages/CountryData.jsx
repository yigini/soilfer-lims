import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Map, BarChart3, Activity, Users, Globe } from 'lucide-react';

const CountryData = () => {
    const { user } = useAuth();
    const [selectedCountry, setSelectedCountry] = useState(user?.countries?.[0] || '');
    const [stats, setStats] = useState({ totalSamples: 0, inProgress: 0, receivedToday: 0, recentActivity: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (selectedCountry) {
            fetchStats();
        }
    }, [selectedCountry]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/dashboard/stats?country=${selectedCountry}`);
            setStats(res.data);
        } catch (error) {
            console.error("Failed to fetch country stats", error);
        }
        setLoading(false);
    };

    if (!user?.countries || user.countries.length === 0) {
        return <div className="p-8 text-gray-500">No country data assigned to your profile.</div>;
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <Globe className="text-blue-600" />
                        Country Dashboard
                    </h1>
                    <p className="text-gray-500 mt-1">Real-time sampling data for {selectedCountry}</p>
                </div>

                {/* Country Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Select Region:</span>
                    <select
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        className="p-2 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {user.countries.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Samples</p>
                            <h3 className="text-4xl font-bold text-gray-800 mt-2">{stats.totalSamples}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                            <Activity size={24} />
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-green-600 font-medium">
                        +{(stats.receivedToday / (stats.totalSamples || 1) * 100).toFixed(1)}% new today
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Processing</p>
                            <h3 className="text-4xl font-bold text-gray-800 mt-2">{stats.inProgress}</h3>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
                            <BarChart3 size={24} />
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                        Active in lab workflow
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Received Today</p>
                            <h3 className="text-4xl font-bold text-gray-800 mt-2">{stats.receivedToday}</h3>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg text-green-600">
                            <Map size={24} />
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                        Daily intake volume
                    </div>
                </div>
            </div>

            {/* Placeholder Map Area */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-96 flex flex-col justify-center items-center bg-gray-50">
                <Map size={64} className="text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-600">Geospatial Visualization</h3>
                <p className="text-gray-500">Map integration for {selectedCountry} coming in Mapbox Phase.</p>
            </div>
        </div>
    );
};

export default CountryData;
