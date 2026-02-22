import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [bgVideo, setBgVideo] = useState('');

    useEffect(() => {
        const videos = ['/assets/img/bg1.mp4', '/assets/img/bg2.mp4'];
        setBgVideo(videos[Math.floor(Math.random() * videos.length)]);
    }, []);

    const navigate = useNavigate();
    const { login } = useAuth();
    const { t, locale, changeLanguage, availableLanguages } = useLanguage();

    const languages = availableLanguages || [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Español' },
        { code: 'fr', name: 'Français' },
        { code: 'pt', name: 'Português' }
    ];

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError(t('login.error') || 'Invalid credentials. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-stone-50 dark:bg-gray-900 overflow-hidden font-sans">
            {/* Left Side - Visual / Branding */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-emerald-800 via-green-900 to-amber-950 relative items-center justify-center p-12 overflow-hidden">
                {bgVideo && (
                    <video
                        key={bgVideo}
                        src={bgVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
                    />
                )}
                {!bgVideo && (
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=3420&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-overlay"></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>

                <div className="relative z-10 text-white max-w-lg text-left">
                    <h1 className="text-6xl font-extrabold mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-100 to-amber-200">
                        SoilFER LIMS
                    </h1>
                    <p className="text-xl text-emerald-50/90 leading-relaxed font-light mb-8">
                        Advanced Laboratory Information Management System for Soil Analysis and Fertility Tracking.
                        Dedicated to global sustainable agriculture.
                    </p>

                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl"></div>

                {/* Donor Acknowledgement */}
                <div className="absolute bottom-8 left-12 right-12 z-20">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 shadow-2xl p-5">
                        <p className="text-[10px] font-semibold text-emerald-100/70 uppercase tracking-[0.2em] mb-3">
                            With the financial support of
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="bg-white rounded-full p-2 shadow-md flex-shrink-0">
                                <img
                                    src="/assets/img/mofa_japan.svg"
                                    alt="Ministry of Foreign Affairs of Japan"
                                    className="h-8 w-8 object-contain"
                                />
                            </div>
                            <span className="text-white/80 text-xs font-medium leading-tight">Ministry of Foreign Affairs<br />of Japan</span>
                            <div className="w-px h-10 bg-white/20 mx-1"></div>
                            <div className="bg-white rounded-full p-2 shadow-md flex-shrink-0">
                                <img
                                    src="/assets/img/us_dept_state.svg"
                                    alt="United States Department of State"
                                    className="h-8 w-8 object-contain"
                                />
                            </div>
                            <span className="text-white/80 text-xs font-medium leading-tight">United States<br />Department of State</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
                {/* Language Segmented Pill */}
                <div className="absolute top-6 right-6 z-20">
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-1 shadow-sm border border-gray-200/60 dark:border-gray-700">
                        {languages.map(l => {
                            const isActive = locale === l.code;
                            return (
                                <button
                                    key={l.code}
                                    onClick={() => changeLanguage(l.code)}
                                    title={l.name}
                                    className={clsx(
                                        'px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200',
                                        isActive
                                            ? 'bg-white dark:bg-gray-600 text-emerald-700 dark:text-emerald-300 shadow-sm'
                                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    )}
                                >
                                    {l.code}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="max-w-[440px] w-full">
                    {/* Mobile Branding View */}
                    <div className="lg:hidden flex flex-col items-center mb-10">
                        <h1 className="text-3xl font-bold text-emerald-800 dark:text-emerald-400">SoilFER LIMS</h1>
                        <div className="w-12 h-1 bg-amber-500 rounded-full mt-2"></div>
                    </div>

                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('login.title') || 'Welcome Back'}</h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('login.subtitle') || 'Enter your credentials to access the laboratory workspace.'}</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-300 text-sm rounded-r-lg flex items-center shadow-sm animate-in fade-in slide-in-from-top-2">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1" htmlFor="username">
                                {t('login.username') || 'Username or ID'}
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 w-14 flex items-center justify-center pointer-events-none z-10 border-r border-gray-200 dark:border-gray-700 my-2.5">
                                    <User className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                                </div>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    autoComplete="username"
                                    className="w-full pl-16 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:bg-white dark:focus:bg-gray-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl outline-none transition-all font-semibold text-gray-900 dark:text-white placeholder-gray-400 shadow-sm"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="password">
                                    {t('login.password') || 'Password'}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowForgotPassword(true)}
                                    className="text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 w-14 flex items-center justify-center pointer-events-none z-10 border-r border-gray-200 dark:border-gray-700 my-2.5">
                                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    className="w-full pl-16 pr-12 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:bg-white dark:focus:bg-gray-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl outline-none transition-all font-semibold text-gray-900 dark:text-white placeholder-gray-400 shadow-sm"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={clsx(
                                    "w-full flex items-center justify-center py-4 px-4 rounded-2xl text-white font-bold text-lg shadow-xl shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-md",
                                    isLoading
                                        ? "bg-emerald-400 cursor-not-allowed"
                                        : "bg-emerald-700 hover:bg-emerald-800"
                                )}
                            >
                                {isLoading ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <>
                                        {t('login.signin') || 'Secure Sign In'} <ArrowRight className="ml-2" size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
                        <p className="text-gray-400 dark:text-gray-500 text-[11px] font-medium tracking-wide">
                            <span className="text-gray-500 dark:text-gray-400 font-bold">SoilFER LIMS</span>
                            {' · '}v{__APP_VERSION__}{' · '}build {__BUILD_DATE__}
                        </p>
                        <div className="mt-3">
                            <a href="mailto:GLOSOLAN@fao.org" className="text-[11px] font-bold text-amber-600 hover:underline transition-colors">
                                Support: GLOSOLAN@fao.org
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Forgot Password Modal */}
            {showForgotPassword && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 text-left font-sans">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in-95 duration-200 border border-emerald-50 dark:border-emerald-900/30">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <Lock size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">Password Reset Instructions</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Internal Security Protocol</p>
                        </div>

                        <div className="space-y-6 mb-8 text-sm text-gray-600 dark:text-gray-300 text-left">
                            <div className="p-5 bg-stone-50 dark:bg-gray-700/50 rounded-2xl border border-stone-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                                <h4 className="font-bold text-gray-900 dark:text-white mb-2 underline decoration-emerald-500/30">Technicians & Staff</h4>
                                <p className="leading-relaxed">Contact your <span className="text-emerald-700 dark:text-emerald-400 font-bold">Laboratory Manager</span> to reset your access directly from the management console.</p>
                            </div>

                            <div className="p-5 bg-stone-50 dark:bg-gray-700/50 rounded-2xl border border-stone-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                                <h4 className="font-bold text-gray-900 dark:text-white mb-2 underline decoration-amber-500/30">Managers & Admins</h4>
                                <p className="leading-relaxed">Please email the global GLOSOLAN support desk for system-level overrides:</p>
                                <a href="mailto:GLOSOLAN@fao.org" className="text-emerald-600 dark:text-emerald-400 font-black mt-2 inline-block hover:underline">GLOSOLAN@fao.org</a>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowForgotPassword(false)}
                            className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 shadow-emerald-700/20"
                        >
                            Understood
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
