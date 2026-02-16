import React from 'react';
import { BarChart3, UserCheck, Loader2, AlertTriangle, RotateCcw, CheckCircle2 } from 'lucide-react';

const CARDS = [
    { key: 'total', label: 'workflow.kpi.total', icon: BarChart3, color: 'from-slate-500 to-slate-600', textColor: 'text-white' },
    { key: 'assigned', label: 'workflow.kpi.assigned', icon: UserCheck, color: 'from-blue-500 to-blue-600', textColor: 'text-white' },
    { key: 'inProgress', label: 'workflow.kpi.inProgress', icon: Loader2, color: 'from-amber-500 to-amber-600', textColor: 'text-white' },
    { key: 'blocked', label: 'workflow.kpi.blocked', icon: AlertTriangle, color: 'from-red-500 to-red-600', textColor: 'text-white' },
    { key: 'reanalysis', label: 'workflow.kpi.reanalysis', icon: RotateCcw, color: 'from-orange-500 to-orange-600', textColor: 'text-white' },
    { key: 'completed', label: 'workflow.kpi.completed', icon: CheckCircle2, color: 'from-emerald-500 to-emerald-600', textColor: 'text-white' },
];

export default function WorkflowKPICards({ kpis, onFilterByStatus, t }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CARDS.map(card => {
                const Icon = card.icon;
                const value = kpis?.[card.key] ?? 0;
                return (
                    <button
                        key={card.key}
                        onClick={() => onFilterByStatus?.(card.key)}
                        className={`
              relative overflow-hidden rounded-xl bg-gradient-to-br ${card.color}
              p-4 text-left transition-all duration-200 hover:scale-105 hover:shadow-lg
              group cursor-pointer
            `}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <Icon size={18} className="text-white/80 group-hover:text-white transition-colors" />
                            <span className="text-2xl font-black text-white">{value}</span>
                        </div>
                        <p className="text-xs font-medium text-white/80 group-hover:text-white truncate">
                            {t ? t(card.label) : card.key}
                        </p>
                        {/* Glow effect */}
                        <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10 blur-xl" />
                    </button>
                );
            })}
        </div>
    );
}
