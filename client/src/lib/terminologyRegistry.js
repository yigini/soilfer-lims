/**
 * SoilFER LIMS Authoritative Terminology Registry
 * 
 * Defines the 8 human-readable terminology groups + unclassified group.
 * Provides deterministic classification, tagging, and multi-locale metadata.
 */

const GROUP_DEFINITIONS = [
    {
        id: 'common',
        names: {
            en: 'Common interface',
            es: 'Interfaz común',
            'es-419': 'Interfaz común',
            fr: 'Interface commune',
            pt: 'Interface comum'
        },
        descriptions: {
            en: 'Navigation, buttons, shared form labels and accessibility text.',
            es: 'Navegación, botones, etiquetas de formulario compartidas y accesibilidad.',
            'es-419': 'Navegación, botones, etiquetas de formulario compartidas y accesibilidad.',
            fr: 'Navigation, boutons, étiquettes partagées et accessibilité.',
            pt: 'Navegação, botões, rótulos compartilhados e acessibilidade.'
        },
        icon: 'Layout',
        prefixes: ['nav.', 'common.', 'ui.', 'header.', 'footer.', 'modal.', 'auth.', 'login.', 'button.', 'forms.', 'table.', 'pagination.', 'dashboard.'],
        tags: ['interface', 'navigation', 'buttons', 'shared']
    },
    {
        id: 'analyses',
        names: {
            en: 'Analyses & methods',
            es: 'Análisis y métodos',
            'es-419': 'Análisis y métodos',
            fr: 'Analyses et méthodes',
            pt: 'Análises e métodos'
        },
        descriptions: {
            en: 'Scientific parameter names, descriptions, methodologies, categories, components and scientific terminology.',
            es: 'Parámetros científicos, descripciones, metodologías, categorías y terminología científica.',
            'es-419': 'Parámetros científicos, descripciones, metodologías, categorías y terminología científica.',
            fr: 'Paramètres scientifiques, descriptions, méthodologies, catégories et terminologie scientifique.',
            pt: 'Parâmetros científicos, descrições, metodologias, categorias e terminologia científica.'
        },
        icon: 'FlaskConical',
        prefixes: ['dynamic.analysis.', 'dynamic.category.', 'dynamic.methodology.', 'catalogue.', 'analysis.', 'methods.', 'texture.', 'units.', 'calculations.', 'analytical.', 'analytics.'],
        tags: ['scientific', 'parameters', 'methodology', 'texture']
    },
    {
        id: 'operations',
        names: {
            en: 'Laboratory operations',
            es: 'Operaciones de laboratorio',
            'es-419': 'Operaciones de laboratorio',
            fr: 'Opérations de laboratoire',
            pt: 'Operações laboratoriais'
        },
        descriptions: {
            en: 'Reception, samples, workbench, drying/preparation, workflow, review and approvals.',
            es: 'Recepción, muestras, mesa de trabajo, secado/preparación, flujo y revisiones.',
            'es-419': 'Recepción, muestras, mesa de trabajo, secado/preparación, flujo y revisiones.',
            fr: 'Réception, échantillons, paillasse, séchage/préparation, flux et validations.',
            pt: 'Recepção, amostras, bancada, secagem/preparação, fluxo e aprovações.'
        },
        icon: 'TestTube',
        prefixes: ['reception.', 'samples.', 'workbench.', 'drying.', 'prep.', 'dynamic.gate.', 'queue.', 'approvals.', 'dynamic.status.', 'workflow.', 'batch.', 'workOrder.', 'chainOfCustody.', 'custody.', 'sampleDetail.', 'workItems.', 'status.'],
        tags: ['operations', 'samples', 'workbench', 'intake', 'custody']
    },
    {
        id: 'reports',
        names: {
            en: 'Reports & labels',
            es: 'Informes y etiquetas',
            'es-419': 'Informes y etiquetas',
            fr: 'Rapports et étiquettes',
            pt: 'Relatórios e etiquetas'
        },
        descriptions: {
            en: 'Report templates, interpretations, print captions and export headings.',
            es: 'Plantillas de informe, interpretaciones, leyendas de impresión y encabezados de exportación.',
            'es-419': 'Plantillas de informe, interpretaciones, leyendas de impresión y encabezados de exportación.',
            fr: 'Modèles de rapport, interprétations, légendes d’impression et en-têtes d’exportation.',
            pt: 'Modelos de relatório, interpretações, legendas de impressão e cabeçalhos de exportação.'
        },
        icon: 'FileText',
        prefixes: ['reports.', 'datasheet.', 'labels.', 'certificates.', 'interpretation.', 'export.', 'summary.'],
        tags: ['reports', 'certificates', 'datasheets', 'export']
    },
    {
        id: 'equipment',
        names: {
            en: 'Equipment, inventory & quality control',
            es: 'Equipos, inventario y control de calidad',
            'es-419': 'Equipos, inventario y control de calidad',
            fr: 'Équipement, inventaire et contrôle qualité',
            pt: 'Equipamentos, inventário e controle de qualidade'
        },
        descriptions: {
            en: 'Equipment assets, calibration, reagents, inventory lots, and QC/proficiency.',
            es: 'Activos de equipo, calibración, reactivos, lotes de inventario y ensayos de aptitud/QC.',
            'es-419': 'Activos de equipo, calibración, reactivos, lotes de inventario y ensayos de aptitud/QC.',
            fr: 'Équipements, étalonnage, réactifs, lots d’inventaire et essais d’aptitude/CQ.',
            pt: 'Equipamentos, calibração, reagentes, lotes de inventário e controle de qualidade/proficiência.'
        },
        icon: 'Package',
        prefixes: ['equipment.', 'inventory.', 'dynamic.equipmentType.', 'qc.', 'qa.', 'proficiency.', 'calibration.', 'maintenance.', 'reagents.'],
        tags: ['equipment', 'calibration', 'inventory', 'qc', 'proficiency']
    },
    {
        id: 'projects',
        names: {
            en: 'Projects & integrations',
            es: 'Proyectos e integraciones',
            'es-419': 'Proyectos e integraciones',
            fr: 'Projets et intégrations',
            pt: 'Projetos e integrações'
        },
        descriptions: {
            en: 'Campaigns, client projects, KoBo Toolbox, National SIS, and spectral sensing.',
            es: 'Campañas, proyectos de clientes, KoBo Toolbox, SIS Nacional y espectroscopía.',
            'es-419': 'Campañas, proyectos de clientes, KoBo Toolbox, SIS Nacional y espectroscopía.',
            fr: 'Campagnes, projets clients, KoBo Toolbox, SIS national et spectrométrie.',
            pt: 'Campanhas, projetos de clientes, KoBo Toolbox, SIS Nacional e espectroscopia.'
        },
        icon: 'FolderGit2',
        prefixes: ['projects.', 'spectral.', 'kobo.', 'sis.', 'api.', 'external.', 'exchange.'],
        tags: ['projects', 'campaigns', 'kobo', 'sis', 'spectral']
    },
    {
        id: 'admin',
        names: {
            en: 'Administration & accounts',
            es: 'Administración y cuentas',
            'es-419': 'Administración y cuentas',
            fr: 'Administration et comptes',
            pt: 'Administração e contas'
        },
        descriptions: {
            en: 'Laboratory staff, user accounts, security roles, facility settings, and branding.',
            es: 'Personal de laboratorio, cuentas de usuario, roles de seguridad, configuración y marca.',
            'es-419': 'Personal de laboratorio, cuentas de usuario, roles de seguridad, configuración y marca.',
            fr: 'Personnel de laboratoire, comptes utilisateurs, rôles de sécurité, paramètres et identité.',
            pt: 'Equipe de laboratório, contas de usuário, papéis de segurança, configurações e identidade visual.'
        },
        icon: 'Settings',
        prefixes: ['admin.', 'users.', 'branding.', 'labs.', 'settings.', 'appearance.', 'permissions.', 'roles.', 'languages.', 'about.'],
        tags: ['admin', 'users', 'branding', 'facilities', 'security']
    },
    {
        id: 'messages',
        names: {
            en: 'System messages & notifications',
            es: 'Mensajes del sistema y notificaciones',
            'es-419': 'Mensajes del sistema y notificaciones',
            fr: 'Messages système et notifications',
            pt: 'Mensagens do sistema e notificações'
        },
        descriptions: {
            en: 'Errors, warnings, validation rules, dialogs, toasts, and event notifications.',
            es: 'Errores, advertencias, reglas de validación, cuadros de diálogo, avisos y notificaciones.',
            'es-419': 'Errores, advertencias, reglas de validación, cuadros de diálogo, avisos y notificaciones.',
            fr: 'Erreurs, avertissements, règles de validation, dialogues, toasts et notifications.',
            pt: 'Erros, avisos, regras de validação, caixas de diálogo, avisos rápidos e notificações.'
        },
        icon: 'Bell',
        prefixes: ['error.', 'errors.', 'warning.', 'warnings.', 'toast.', 'notifications.', 'dialog.', 'validation.', 'alerts.', 'messages.', 'audit.'],
        tags: ['errors', 'warnings', 'validation', 'notifications', 'dialogs']
    },
    {
        id: 'unclassified',
        names: {
            en: 'Needs classification',
            es: 'Requiere clasificación',
            'es-419': 'Requiere clasificación',
            fr: 'À classifier',
            pt: 'Requer classificação'
        },
        descriptions: {
            en: 'Unclassified terminology entries requiring group categorization.',
            es: 'Términos no clasificados que requieren asignación de grupo.',
            'es-419': 'Términos no clasificados que requieren asignación de grupo.',
            fr: 'Entrées terminologiques non classifiées nécessitant une catégorie.',
            pt: 'Entradas terminológicas não classificadas que requerem categorização.'
        },
        icon: 'HelpCircle',
        prefixes: [],
        tags: ['unclassified']
    }
];

function classifyTerminologyKey(key) {
    if (!key || typeof key !== 'string') {
        return { primaryGroup: 'unclassified', module: 'general', tags: ['unclassified'] };
    }

    for (const group of GROUP_DEFINITIONS) {
        if (group.prefixes.some(p => key.startsWith(p))) {
            const parts = key.split('.');
            let module = parts[0];
            if (key.startsWith('dynamic.')) {
                module = parts[1] || 'dynamic';
            }
            return {
                primaryGroup: group.id,
                module,
                tags: [...group.tags, module]
            };
        }
    }

    return {
        primaryGroup: 'unclassified',
        module: 'unclassified',
        tags: ['unclassified']
    };
}

function getGroupDefinition(groupId, locale = 'en') {
    const g = GROUP_DEFINITIONS.find(def => def.id === groupId) || GROUP_DEFINITIONS[GROUP_DEFINITIONS.length - 1];
    return {
        id: g.id,
        name: g.names[locale] || g.names['en'] || g.id,
        description: g.descriptions[locale] || g.descriptions['en'] || '',
        icon: g.icon,
        tags: g.tags
    };
}

function getAllGroupDefinitions(locale = 'en') {
    return GROUP_DEFINITIONS.map(g => ({
        id: g.id,
        name: g.names[locale] || g.names['en'] || g.id,
        description: g.descriptions[locale] || g.descriptions['en'] || '',
        icon: g.icon,
        tags: g.tags
    }));
}

export { GROUP_DEFINITIONS, classifyTerminologyKey, getGroupDefinition, getAllGroupDefinitions };
export default { GROUP_DEFINITIONS, classifyTerminologyKey, getGroupDefinition, getAllGroupDefinitions };
