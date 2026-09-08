import React from 'react';
import { Building2, FolderGit2, Globe } from 'lucide-react';

/**
 * ScopeSelector
 * Enables laboratory and project switching for multi-lab roles (SUPER_ADMIN, MASTER_USER),
 * while rendering a clean, read-only scope badge for single-lab staff.
 */
export default function ScopeSelector({
    scope = {},
    userRole = '',
    labs = [], // [{ id, name, code }]
    projects = [], // [{ code, name }]
    selectedLabId = '',
    selectedProjectId = '',
    onSelectLab,
    onSelectProject
}) {
    const isMultiLab = userRole === 'SUPER_ADMIN' || userRole === 'MASTER_USER';
    const hasProjects = projects && projects.length > 0;

    return (
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
            {/* Laboratory Selector / Badge */}
            {isMultiLab && labs && labs.length > 0 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sf-surface border border-sf-divider shadow-sm">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    <label htmlFor="lab-scope-select" className="sr-only">Laboratory Scope</label>
                    <select
                        id="lab-scope-select"
                        value={selectedLabId || ''}
                        onChange={(e) => onSelectLab && onSelectLab(e.target.value)}
                        className="bg-transparent border-none text-sf-text font-semibold focus:outline-none cursor-pointer pr-2"
                    >
                        <option value="">
                            {userRole === 'SUPER_ADMIN' ? 'All Laboratories (Global)' : 'All Permitted Laboratories'}
                        </option>
                        {labs.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.name || l.code || l.id}
                            </option>
                        ))}
                    </select>
                </div>
            ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300">
                    <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold">{scope.label || 'Assigned Laboratory'}</span>
                </div>
            )}

            {/* Project Filter (if applicable) */}
            {hasProjects && onSelectProject && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sf-surface border border-sf-divider shadow-sm">
                    <FolderGit2 className="w-3.5 h-3.5 text-gray-400" />
                    <label htmlFor="project-scope-select" className="sr-only">Project Filter</label>
                    <select
                        id="project-scope-select"
                        value={selectedProjectId || ''}
                        onChange={(e) => onSelectProject(e.target.value)}
                        className="bg-transparent border-none text-sf-text font-semibold focus:outline-none cursor-pointer pr-2"
                    >
                        <option value="">All Projects</option>
                        {projects.map((p) => (
                            <option key={p.code || p.id} value={p.code || p.id}>
                                {p.name || p.code}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Timezone Context */}
            {scope.timezone && (
                <div className="hidden sm:inline-flex items-center gap-1 text-sf-muted font-normal">
                    <Globe className="w-3 h-3" />
                    <span>
                        {scope.timezone}
                        {scope.isUtcFallback && ' (UTC fallback)'}
                    </span>
                </div>
            )}
        </div>
    );
}
