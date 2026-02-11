import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Shield, Award } from 'lucide-react';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="mt-auto border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Left: branding */}
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                        <span className="font-semibold text-gray-500 dark:text-gray-400">LIMS</span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span>Laboratory Information Management System</span>
                    </div>

                    {/* Center: links */}
                    <div className="flex items-center gap-4 text-xs">
                        <Link
                            to="/credits"
                            className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
                        >
                            <Award size={12} />
                            Credits & Acknowledgments
                        </Link>
                    </div>

                    {/* Right: copyright */}
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                        <span>© {currentYear}</span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span className="flex items-center gap-1">
                            Built with <Heart size={10} className="text-red-400" fill="currentColor" /> care
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
