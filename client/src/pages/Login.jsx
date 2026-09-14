import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { User, Lock, Eye, EyeOff, ArrowRight, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const bgImages = [
        '/assets/img/bg1.jpg',
        '/assets/img/bg2.jpg',
        '/assets/img/bg3.jpg',
        '/assets/img/bg4.jpg'
    ];
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % bgImages.length);
        }, 8000);
        return () => clearInterval(timer);
    }, [bgImages.length]);

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
        <div className="min-h-screen w-full flex bg-sf-canvas text-sf-text overflow-hidden font-sans">
            {/* Left Side - Visual / Branding */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-emerald-900 via-emerald-950 to-green-950 relative items-center justify-center p-12 overflow-hidden">
                {/* Smooth Multi-Layer Crossfading Backgrounds */}
                {bgImages.map((src, index) => {
                    const isActive = currentImageIndex === index;
                    return (
                        <div
                            key={src}
                            className={clsx(
                                "absolute inset-0 bg-cover bg-center transition-all ease-in-out mix-blend-overlay",
                                isActive ? "opacity-45" : "opacity-0 pointer-events-none"
                            )}
                            style={{
                                backgroundImage: `url(${src})`,
                                transitionProperty: "opacity, transform",
                                transitionDuration: "2500ms, 16000ms",
                                transform: isActive ? "scale(1.08)" : "scale(1.0)",
                                willChange: "transform, opacity"
                            }}
                        />
                    );
                })}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>

                <div className="relative z-10 text-white max-w-lg text-left">
                    <div className="flex items-center gap-5 mb-6">
                        <img
                            src="/assets/img/soilfer-logo.png"
                            alt="SoilFER"
                            className="h-20 w-auto object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
                        />
                        <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-100 to-amber-200">
                            LIMS
                        </h1>
                    </div>
                    <p className="text-xl text-emerald-50/90 leading-relaxed font-light mb-8">
                        Advanced Laboratory Information Management System for Soil Analysis and Fertility Tracking.
                        Dedicated to global sustainable agriculture.
                    </p>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl"></div>

                {/* Donor Acknowledgement */}
                <div className="absolute bottom-8 left-8 right-8 z-20">
                    <div className="bg-black/35 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl p-4 transition-all">
                        <p className="text-[10px] font-bold text-emerald-200/70 uppercase tracking-[0.2em] mb-2.5 ml-1">
                            With the financial support of
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* 1. US Department of State Link (FIRST) */}
                            <a
                                href="https://www.state.gov/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 backdrop-blur-md transition-all duration-200 group"
                                title="United States Department of State"
                            >
                                <div className="w-14 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden bg-white/95 border border-white/40 p-1">
                                    <img
                                        src="/assets/img/us_dept_state_official.svg"
                                        alt="United States Department of State"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div className="flex flex-col text-left min-w-0">
                                    <span className="text-white text-xs sm:text-sm font-bold leading-snug group-hover:text-amber-200 transition-colors truncate">
                                        United States
                                    </span>
                                    <span className="text-emerald-100/75 text-[11px] leading-tight truncate">
                                        Department of State
                                    </span>
                                </div>
                                <ExternalLink size={14} className="text-white/40 group-hover:text-white ml-auto flex-shrink-0 transition-colors" />
                            </a>

                            {/* 2. Japan MOFA / ODA Link (SECOND) */}
                            <a
                                href="https://www.mofa.go.jp/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 backdrop-blur-md transition-all duration-200 group"
                                title="Ministry of Foreign Affairs of Japan — From the People of Japan"
                            >
                                <div className="w-14 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden bg-white border border-black/15 p-0.5">
                                    <img
                                        src="/assets/img/japan_oda_official.jpg"
                                        alt="From the People of Japan"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div className="flex flex-col text-left min-w-0">
                                    <span className="text-white text-xs sm:text-sm font-bold leading-snug group-hover:text-amber-200 transition-colors truncate">
                                        From the People of Japan
                                    </span>
                                    <span className="text-emerald-100/75 text-[11px] leading-tight truncate">
                                        Ministry of Foreign Affairs
                                    </span>
                                </div>
                                <ExternalLink size={14} className="text-white/40 group-hover:text-white ml-auto flex-shrink-0 transition-colors" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative bg-sf-canvas">
                {/* Language Segmented Pill */}
                <div className="absolute top-6 right-6 z-20">
                    <div className="flex items-center bg-sf-surface rounded-full p-1 shadow-sm border border-sf-divider">
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
                                            ? 'bg-sf-primary text-sf-on-primary shadow-sm'
                                            : 'text-sf-muted hover:text-sf-text'
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
                        <img src="/assets/img/soilfer-logo.png" alt="SoilFER" className="h-12 w-auto object-contain" />
                        <h1 className="text-2xl font-bold text-sf-primary -mt-1">LIMS</h1>
                        <div className="w-12 h-1 bg-amber-500 rounded-full mt-2"></div>
                    </div>

                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-sf-text mb-2">{t('login.title') || 'Welcome Back'}</h2>
                        <p className="text-sf-muted font-medium">{t('login.subtitle') || 'Enter your credentials to access the laboratory workspace.'}</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-rose-500/10 border-l-4 border-rose-500 text-rose-600 dark:text-rose-400 text-sm rounded-r-lg flex items-center shadow-sm animate-in fade-in slide-in-from-top-2">
                            <svg className="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6" data-tour="login-form">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-sf-text ml-1" htmlFor="username">
                                {t('login.username') || 'Username or ID'}
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 w-14 flex items-center justify-center pointer-events-none z-10 border-r border-sf-divider my-2.5">
                                    <User className="h-5 w-5 text-sf-muted group-focus-within:text-sf-primary transition-colors" />
                                </div>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    autoComplete="username"
                                    className="w-full pl-16 pr-4 py-4 bg-sf-surface border-2 border-sf-divider focus:border-sf-primary focus:ring-4 focus:ring-sf-primary/10 rounded-2xl outline-none transition-all font-semibold text-sf-text placeholder:text-sf-muted shadow-sm"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-sm font-bold text-sf-text" htmlFor="password">
                                    {t('login.password') || 'Password'}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowForgotPassword(true)}
                                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 w-14 flex items-center justify-center pointer-events-none z-10 border-r border-sf-divider my-2.5">
                                    <Lock className="h-5 w-5 text-sf-muted group-focus-within:text-sf-primary transition-colors" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    className="w-full pl-16 pr-12 py-4 bg-sf-surface border-2 border-sf-divider focus:border-sf-primary focus:ring-4 focus:ring-sf-primary/10 rounded-2xl outline-none transition-all font-semibold text-sf-text placeholder:text-sf-muted shadow-sm"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-sf-muted hover:text-sf-text focus:outline-none"
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
                                    "w-full flex items-center justify-center py-4 px-4 rounded-2xl text-sf-on-primary font-bold text-lg shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0",
                                    isLoading
                                        ? "bg-sf-primary/60 cursor-not-allowed"
                                        : "bg-sf-primary hover:bg-sf-primary-hover shadow-sf-primary/20"
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

                    <div className="mt-10 pt-6 border-t border-sf-divider text-center">
                        <p className="text-sf-muted text-[11px] font-medium tracking-wide inline-flex items-center gap-1.5 justify-center">
                            <img src="/assets/img/soilfer-logo.png" alt="SoilFER" className="h-4 w-auto object-contain inline-block" />
                            <span className="text-sf-text font-bold">LIMS</span>
                            {' · '}v{__APP_VERSION__}{' · '}build {__BUILD_DATE__}
                        </p>
                        <div className="mt-3">
                            <a href="mailto:GLOSOLAN@fao.org" className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline transition-colors">
                                Support: GLOSOLAN@fao.org
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Forgot Password Modal */}
            {showForgotPassword && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 text-left font-sans">
                    <div className="bg-sf-surface rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in-95 duration-200 border border-sf-divider">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-sf-primary/10 text-sf-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <Lock size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-sf-text leading-tight">Password Reset Instructions</h3>
                            <p className="text-sf-muted mt-2 font-medium">Internal Security Protocol</p>
                        </div>

                        <div className="space-y-6 mb-8 text-sm text-sf-text text-left">
                            <div className="p-5 bg-sf-raised/50 rounded-2xl border border-sf-divider shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-sf-primary"></div>
                                <h4 className="font-bold text-sf-text mb-2 underline decoration-sf-primary/30">Technicians & Staff</h4>
                                <p className="leading-relaxed text-sf-muted">Contact your <span className="text-sf-primary font-bold">Laboratory Manager</span> to reset your access directly from the management console.</p>
                            </div>

                            <div className="p-5 bg-sf-raised/50 rounded-2xl border border-sf-divider shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                                <h4 className="font-bold text-sf-text mb-2 underline decoration-amber-500/30">Managers & Admins</h4>
                                <p className="leading-relaxed text-sf-muted">Please email the global GLOSOLAN support desk for system-level overrides:</p>
                                <a href="mailto:GLOSOLAN@fao.org" className="text-sf-primary font-black mt-2 inline-block hover:underline">GLOSOLAN@fao.org</a>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowForgotPassword(false)}
                            className="w-full py-4 bg-sf-primary hover:bg-sf-primary-hover text-sf-on-primary rounded-2xl font-bold transition-all shadow-lg active:scale-95 shadow-sf-primary/20"
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
