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
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Globe className="text-blue-600 dark:text-blue-400" />
                        Country Dashboard
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Real-time sampling data for {selectedCountry}</p>
                </div>

                {/* Country Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Select Region:</span>
                    <select
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        className="p-2 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                    >
                        {user.countries.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Samples</p>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-2">{stats.totalSamples}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
                            <Activity size={24} />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-green-600 dark:text-green-400 font-bold">
                        +{(stats.receivedToday / (stats.totalSamples || 1) * 100).toFixed(1)}% new today
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Processing</p>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-2">{stats.inProgress}</h3>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/40 rounded-xl text-orange-600 dark:text-orange-400">
                            <BarChart3 size={24} />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Active in lab workflow
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Received Today</p>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-2">{stats.receivedToday}</h3>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/40 rounded-xl text-green-600 dark:text-green-400">
                            <Map size={24} />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Daily intake volume
                    </div>
                </div>
            </div>

            {/* Placeholder Map Area */}
            <div className="bg-white dark:bg-gray-800/60 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[300px] flex flex-col justify-center items-center text-center">
                <Map size={48} className="text-gray-300 dark:text-gray-600 mb-3" />
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">Geospatial Regional Data</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Aggregated statistics and satellite layering for {selectedCountry}.</p>
            </div>
        </div>
    );
};

export default CountryData;
