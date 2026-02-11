import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ManagerDashboard from '../components/dashboard/ManagerDashboard';
import TechnicianDashboard from '../components/dashboard/TechnicianDashboard';
import ReceptionDashboard from '../components/dashboard/ReceptionDashboard';
import OversightDashboard from '../components/dashboard/OversightDashboard';
import QADashboard from '../pages/QADashboard';

const Dashboard = () => {
    const { user } = useAuth();
    const { t } = useLanguage();

    if (!user) return <div>{t('common.loading')}</div>;

    // Role-Based Routing
    switch (user.role) {
        case 'LAB_MANAGER':
        case 'SUPER_ADMIN': // Super Admin sees Manager View for now + Admin links in sidebar
            return <ManagerDashboard user={user} />;

        case 'LAB_TECHNICIAN':
            return <TechnicianDashboard user={user} />;

        case 'SAMPLE_RECEPTION':
            return <ReceptionDashboard user={user} />;

        case 'PROJECT_MANAGER':
        case 'COUNTRY_ADMIN':
        case 'MASTER_USER':
            return <OversightDashboard user={user} />;

        case 'VIEWER':
            return <OversightDashboard user={user} />;

        default:
            return <div className="p-8"><h1>{t('dashboard.welcome')} to SoilFER LIMS</h1><p>Your role ({user.role}) has no specific dashboard yet.</p></div>;
    }
};

export default Dashboard;
