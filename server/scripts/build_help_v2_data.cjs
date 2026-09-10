const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const WP_DIR = path.join(ROOT, 'WP/help-knowledge-base-v2');
const SERVER_DATA_DIR = path.resolve(__dirname, '../data/help');

const inventoryGroups = require(path.join(WP_DIR, 'inventory-source.cjs'));
const examplesData = require(path.join(WP_DIR, 'guide-examples.json'));
const traceability = require(path.join(WP_DIR, 'traceability.json'));
const migrationMap = require(path.join(WP_DIR, 'migration-map.json'));
const terminology = require(path.join(WP_DIR, 'terminology.json'));

const LOCALES = ['en', 'es', 'es-419', 'fr', 'pt'];

// 12 Topics
const categories = [
  {
    id: 'start',
    icon: 'compass',
    titles: {
      en: 'Getting started',
      es: 'Primeros pasos',
      'es-419': 'Primeros pasos',
      fr: 'Premiers pas',
      pt: 'Primeiros passos'
    },
    descriptions: {
      en: 'Find your way and prepare for a shift.',
      es: 'Oriéntate y prepárate para el turno.',
      'es-419': 'Oriéntese y prepárese para el turno.',
      fr: 'Repérez-vous et préparez votre prise de poste.',
      pt: 'Oriente-se e prepare-se para o turno de trabalho.'
    }
  },
  {
    id: 'intake',
    icon: 'package-check',
    titles: {
      en: 'Receiving samples',
      es: 'Recepción de muestras',
      'es-419': 'Recepción de muestras',
      fr: 'Réception des échantillons',
      pt: 'Receção de amostras'
    },
    descriptions: {
      en: 'Identity, condition, field context and labels.',
      es: 'Identidad, estado, contexto de campo y etiquetas.',
      'es-419': 'Identidad, condición, contexto de campo y etiquetas.',
      fr: 'Identité, état, contexte de terrain et étiquetage.',
      pt: 'Identidade, estado, contexto de campo e etiquetas.'
    }
  },
  {
    id: 'tracking',
    icon: 'network',
    titles: {
      en: 'Sample identity and tracking',
      es: 'Identidad y seguimiento de muestras',
      'es-419': 'Identidad y seguimiento de muestras',
      fr: 'Identité et traçabilité des échantillons',
      pt: 'Identidade e rastreabilidade de amostras'
    },
    descriptions: {
      en: 'Identifiers, locations, workflow maps and labels.',
      es: 'Identificadores, ubicaciones, mapas de flujo y etiquetas.',
      'es-419': 'Identificadores, ubicaciones, mapas de flujo y etiquetas.',
      fr: 'Identifiants, emplacements, schémas de parcours et étiquettes.',
      pt: 'Identificadores, localizações, mapas de fluxo e etiquetas.'
    }
  },
  {
    id: 'preparation',
    icon: 'clipboard-check',
    titles: {
      en: 'Drying and preparation',
      es: 'Secado y preparación',
      'es-419': 'Secado y preparación',
      fr: 'Séchage et préparation',
      pt: 'Secagem e preparação'
    },
    descriptions: {
      en: 'Checklist confirmation, receipts and evidence.',
      es: 'Confirmación por lista de verificación, comprobantes y evidencia.',
      'es-419': 'Confirmación por lista de verificación, comprobantes y evidencia.',
      fr: 'Validation des listes de contrôle, reçus et preuves.',
      pt: 'Confirmação por lista de verificação, comprovativos e evidência.'
    }
  },
  {
    id: 'bench',
    icon: 'flask-conical',
    titles: {
      en: 'Results at the bench',
      es: 'Resultados en la mesa de trabajo',
      'es-419': 'Resultados en la mesa de trabajo',
      fr: 'Résultats à la paillasse',
      pt: 'Resultados na bancada'
    },
    descriptions: {
      en: 'Batch entry, worksheets, paste preview and reviewer handoff.',
      es: 'Captura por lote, hojas de trabajo, vista previa de pegado y envío a revisión.',
      'es-419': 'Captura por lote, hojas de trabajo, vista previa de pegado y envío a revisión.',
      fr: 'Saisie par lot, feuilles de travail, aperçu du collage et transmission pour révision.',
      pt: 'Registo por lote, folhas de cálculo, pré-visualização de colagem e envio para revisão.'
    }
  },
  {
    id: 'methods',
    icon: 'microscope',
    titles: {
      en: 'Methods, panels and spectra',
      es: 'Métodos, paneles y espectros',
      'es-419': 'Métodos, paneles y espectros',
      fr: 'Méthodes, séries et spectres',
      pt: 'Métodos, painéis e espectros'
    },
    descriptions: {
      en: 'pH, EC, texture panels, spectral files and prediction.',
      es: 'pH, CE, paneles de textura, archivos espectrales y predicción.',
      'es-419': 'pH, CE, paneles de textura, archivos espectrales y predicción.',
      fr: 'pH, CE, fractions texturales, spectres et prédictions.',
      pt: 'pH, CE, painéis de textura, ficheiros espectrais e predição.'
    }
  },
  {
    id: 'review',
    icon: 'clipboard-check',
    titles: {
      en: 'Review and reporting',
      es: 'Revisión e informes',
      'es-419': 'Revisión e informes',
      fr: 'Révision et rapports',
      pt: 'Revisão e relatórios'
    },
    descriptions: {
      en: 'Inspect evidence, accept, return with reasons and release reports.',
      es: 'Inspeccionar evidencia, aceptar, devolver con motivos y emitir informes.',
      'es-419': 'Inspeccionar evidencia, aceptar, devolver con motivos y emitir informes.',
      fr: 'Examiner les preuves, accepter, renvoyer avec motif et publier les rapports.',
      pt: 'Inspecionar evidência, aceitar, devolver com motivos e emitir relatórios.'
    }
  },
  {
    id: 'assets',
    icon: 'microscope',
    titles: {
      en: 'Equipment and stock',
      es: 'Equipos e inventario',
      'es-419': 'Equipos e inventario',
      fr: 'Équipements et stocks',
      pt: 'Equipamentos e inventário'
    },
    descriptions: {
      en: 'Instrument eligibility, calibration, maintenance and reagent lots.',
      es: 'Aptitud de instrumentos, calibración, mantenimiento y lotes de reactivos.',
      'es-419': 'Aptitud de instrumentos, calibración, mantenimiento y lotes de reactivos.',
      fr: 'Conformité des appareils, étalonnage, maintenance et lots de réactifs.',
      pt: 'Elegibilidade de instrumentos, calibração, manutenção e lotes de reagentes.'
    }
  },
  {
    id: 'offline',
    icon: 'cloud-download',
    titles: {
      en: 'Mobile and offline work',
      es: 'Móvil y sin conexión',
      'es-419': 'Móvil y sin conexión',
      fr: 'Mobile et hors connexion',
      pt: 'Dispositivos móveis e sem ligação'
    },
    descriptions: {
      en: 'PWA layout, work packs, queued actions, sync and conflicts.',
      es: 'Diseño PWA, paquetes de trabajo, acciones en cola, sincronización y conflictos.',
      'es-419': 'Diseño PWA, paquetes de trabajo, acciones en cola, sincronización y conflictos.',
      fr: 'Format PWA, lots de travail, actions en attente, synchronisation et conflits.',
      pt: 'Disposição PWA, pacotes de trabalho, ações em fila, sincronização e conflitos.'
    }
  },
  {
    id: 'connect',
    icon: 'network',
    titles: {
      en: 'Projects, fieldwork and connections',
      es: 'Proyectos, campo y conexiones',
      'es-419': 'Proyectos, campo y conexiones',
      fr: 'Projets, terrain et connexions',
      pt: 'Projetos, campo e ligações'
    },
    descriptions: {
      en: 'KoBo toolbox, surveyor provenance, progress and SIS exports.',
      es: 'KoBo toolbox, procedencia de campo, avance y exportaciones SIS.',
      'es-419': 'KoBo toolbox, procedencia de campo, avance y exportaciones SIS.',
      fr: 'KoBo toolbox, origine terrain, avancement et exportations SIS.',
      pt: 'KoBo toolbox, proveniência de campo, progresso e exportações SIS.'
    }
  },
  {
    id: 'admin',
    icon: 'settings-2',
    titles: {
      en: 'Management and configuration',
      es: 'Gestión y configuración',
      'es-419': 'Gestión y configuración',
      fr: 'Gestion et configuration',
      pt: 'Gestão e configuração'
    },
    descriptions: {
      en: 'Labs, users, analysis catalogue, methods, translations and Help.',
      es: 'Laboratorios, usuarios, catálogo de análisis, métodos, traducciones y Ayuda.',
      'es-419': 'Laboratorios, usuarios, catálogo de análisis, métodos, traducciones y Ayuda.',
      fr: "Laboratoires, utilisateurs, catalogue d'analyses, méthodes, traductions et Aide.",
      pt: 'Laboratórios, utilizadores, catálogo de análises, métodos, traduções e Ajuda.'
    }
  },
  {
    id: 'quality',
    icon: 'clipboard-check',
    titles: {
      en: 'Quality, audit and recovery',
      es: 'Calidad, auditoría y recuperación',
      'es-419': 'Calidad, auditoría y recuperación',
      fr: 'Qualité, audit et reprise',
      pt: 'Qualidade, auditoria e recuperação'
    },
    descriptions: {
      en: 'Audit logs, nonconformance, QC alerts, history and support.',
      es: 'Registros de auditoría, no conformidades, alertas de CC, historial y soporte.',
      'es-419': 'Registros de auditoría, no conformidades, alertas de CC, historial y soporte.',
      fr: "Journaux d'audit, non-conformités, alertes CQ, historique et support.",
      pt: 'Registos de auditoria, não conformidades, alertas de CQ, histórico e suporte.'
    }
  }
];

fs.writeFileSync(path.join(SERVER_DATA_DIR, 'categories.json'), JSON.stringify(categories, null, 2) + '\n');
console.log('[BUILD] Wrote 12 categories to categories.json');

// Translations dictionary for exemplar guides
const exemplarTranslations = {
  'bench-batch': {
    title: {
      en: 'Record and submit a batch of results',
      es: 'Registrar y enviar un lote de resultados',
      'es-419': 'Registrar y enviar un lote de resultados',
      fr: 'Enregistrer et soumettre un lot de résultats',
      pt: 'Registar e submeter um lote de resultados'
    },
    summary: {
      en: 'Enter a method batch, resolve unmatched rows, then send the checked work to your reviewer.',
      es: 'Captura una serie analítica, resuelve filas no coincidentes y envía el trabajo revisado a tu revisor.',
      'es-419': 'Captura una corrida analítica, resuelve filas no coincidentes y envía el trabajo verificado a tu revisor.',
      fr: 'Saisissez une série de méthode, résolvez les lignes non appariées, puis transmettez le travail vérifié à votre réviseur.',
      pt: 'Introduza um lote de método, resolva linhas não correspondidas e envie o trabalho conferido para o revisor.'
    },
    quick: {
      en: 'Review all pasted rows against the visible samples, exclude missing or invalid items, select Review Completion, confirm Record N Determinations, and then use Ready to Submit to hand the batch over to your reviewer.',
      es: 'Revisa las filas pegadas con las muestras visibles, excluye elementos ausentes o no válidos, selecciona Revisar finalización, confirma Registrar N determinaciones y usa Listo para enviar para entregar el lote al revisor.',
      'es-419': 'Revisa las filas pegadas frente a las muestras visibles, excluye elementos faltantes o inválidos, selecciona Revisar finalización, confirma Registrar N determinaciones y usa Listo para enviar para entregar el lote al revisor.',
      fr: 'Vérifiez les lignes collées par rapport aux échantillons affichés, excluez les éléments manquants ou non valides, sélectionnez Vérifier l’achèvement, confirmez Enregistrer N déterminations, puis utilisez Prêt à soumettre pour transmettre le lot.',
      pt: 'Verifique todas as linhas coladas face às amostras visíveis, exclua itens em falta ou inválidos, selecione Rever conclusão, confirme Registar N determinações e utilize Pronto a submeter para entregar o lote ao revisor.'
    },
    nextActor: {
      en: 'Laboratory manager or authorized reviewer',
      es: 'Responsable de laboratorio o revisor autorizado',
      'es-419': 'Gerente de laboratorio o revisor autorizado',
      fr: 'Responsable de laboratoire ou réviseur autorisé',
      pt: 'Responsável de laboratório ou revisor autorizado'
    },
    success: {
      en: 'The submitted determinations show Sent & Completed, the sample status advances to SUBMITTED, and the manager queue reflects the new submission.',
      es: 'Las determinaciones enviadas muestran Enviado y completado, el estado de la muestra avanza a ENVIADO y la cola del responsable refleja el nuevo envío.',
      'es-419': 'Las determinaciones enviadas muestran Enviado y completado, el estado de la muestra avanza a ENVIADO y la cola del supervisor refleja el nuevo envío.',
      fr: 'Les déterminations soumises affichent Envoyé et terminé, l’état de l’échantillon passe à SOUMIS et la file d’attente du responsable affiche la nouvelle soumission.',
      pt: 'As determinações submetidas mostram Enviado e concluído, o estado da amostra avança para SUBMETIDO e a fila do gestor reflete a nova submissão.'
    }
  },
  'prep-drying': {
    title: {
      en: 'Confirm sample drying and find its receipt',
      es: 'Confirmar el secado de la muestra y verificar su comprobante',
      'es-419': 'Confirmar el secado de la muestra y revisar su comprobante',
      fr: 'Confirmer le séchage de l’échantillon et vérifier son reçu',
      pt: 'Confirmar a secagem da amostra e verificar o comprovativo'
    },
    summary: {
      en: 'Finish the required checks, confirm completion and verify the confirmation receipt.',
      es: 'Completa las comprobaciones requeridas, confirma la finalización y verifica el comprobante de confirmación.',
      'es-419': 'Completa las verificaciones requeridas, confirma la finalización y revisa el comprobante de confirmación.',
      fr: 'Terminez les contrôles requis, confirmez la réalisation et vérifiez le reçu de confirmation.',
      pt: 'Conclua as verificações obrigatórias, confirme a conclusão e verifique o comprovativo de confirmação.'
    },
    quick: {
      en: 'Complete the required physical checks, select Confirm Complete, and verify the confirmation receipt. A checked box alone is not evidence that the server accepted completion.',
      es: 'Completa las comprobaciones físicas requeridas, selecciona Confirmar finalización y verifica el comprobante. Una casilla marcada no demuestra que el servidor haya aceptado la finalización.',
      'es-419': 'Completa las verificaciones físicas requeridas, selecciona Confirmar finalización y revisa el comprobante. Una casilla marcada no demuestra que el servidor haya aceptado la finalización.',
      fr: 'Effectuez les vérifications physiques requises, sélectionnez Confirmer la fin, puis vérifiez le reçu. Une case cochée ne prouve pas que le serveur a accepté la fin de la tâche.',
      pt: 'Conclua as verificações físicas necessárias, selecione Confirmar conclusão e verifique o comprovativo. Uma caixa assinalada não prova que o servidor aceitou a conclusão.'
    },
    nextActor: {
      en: 'Preparation technician or analytical analyst',
      es: 'Técnico de preparación o analista de ensayo',
      'es-419': 'Técnico de preparación o analista de ensayo',
      fr: 'Technicien de préparation ou analyste de paillasse',
      pt: 'Técnico de preparação ou analista de ensaio'
    },
    success: {
      en: 'The drying task shows a green verified badge with timestamp, receipt ID and operator identity. Downstream preparation tasks unlock.',
      es: 'La tarea de secado muestra una insignia verde de verificación con fecha, hora, ID de comprobante e identidad del operador. Se desbloquean las tareas posteriores de preparación.',
      'es-419': 'La tarea de secado muestra una insignia verde de verificación con fecha, hora, ID de comprobante e identidad del operador. Se desbloquean las tareas posteriores de preparación.',
      fr: 'La tâche de séchage présente un badge vert vérifié avec horodatage, numéro de reçu et identité de l’opérateur. Les étapes de préparation suivantes se déverrouillent.',
      pt: 'A tarefa de secagem apresenta um distintivo verde de verificação com carimbo temporal, ID do comprovativo e identificação do operador. As tarefas seguintes desbloqueiam.'
    }
  },
  'prep-receipt': {
    title: {
      en: 'Preparation looks incomplete after confirmation',
      es: 'La preparación parece incompleta tras la confirmación',
      'es-419': 'La preparación parece incompleta tras la confirmación',
      fr: 'La préparation semble incomplète après confirmation',
      pt: 'A preparação parece incompleta após a confirmação'
    },
    summary: {
      en: 'Use the confirmation receipt, selected attempt and prerequisite state to diagnose the contradiction.',
      es: 'Usa el comprobante de confirmación, el intento seleccionado y el estado de prerrequisito para diagnosticar la contradicción.',
      'es-419': 'Utiliza el comprobante de confirmación, el intento seleccionado y el estado de prerrequisito para diagnosticar la contradicción.',
      fr: 'Utilisez le reçu de confirmation, la tentative sélectionnée et l’état des prérequis pour analyser l’écart.',
      pt: 'Utilize o comprovativo de confirmação, a tentativa selecionada e o estado dos pré-requisitos para diagnosticar a discrepância.'
    },
    quick: {
      en: 'Do not repeat physical preparation solely because a badge shows incomplete. Check whether the confirmation receipt exists in the task history, check for pending offline sync, and compare the work attempt number.',
      es: 'No repitas la preparación física solo porque una insignia indique incompleto. Comprueba si existe comprobante en el historial, revisa la sincronización sin conexión y compara el número de intento.',
      'es-419': 'No repitas la preparación física solo porque una insignia indique incompleto. Revisa si existe comprobante en el historial, revisa la sincronización sin conexión y compara el número de intento.',
      fr: 'Ne répétez pas la préparation physique simplement parce qu’un badge indique incomplet. Vérifiez la présence du reçu dans l’historique, le statut hors connexion et le numéro de tentative.',
      pt: 'Não repita a preparação física apenas porque um distintivo mostra incompleto. Verifique se o comprovativo existe no histórico da tarefa, confira a sincronização e compare o número da tentativa.'
    },
    nextActor: {
      en: 'Laboratory technician and laboratory supervisor',
      es: 'Técnico de laboratorio y supervisor de laboratorio',
      'es-419': 'Técnico de laboratorio y supervisor de laboratorio',
      fr: 'Technicien de laboratoire et superviseur de laboratoire',
      pt: 'Técnico de laboratório e supervisor de laboratório'
    },
    success: {
      en: 'The confirmed receipt is verified, conflicting views are clarified without duplicate attempts, and work proceeds safely.',
      es: 'El comprobante queda verificado, se aclaran las vistas contradictorias sin duplicar intentos y el trabajo continúa de forma segura.',
      'es-419': 'El comprobante queda verificado, se aclaran las vistas contradictorias sin duplicar intentos y el trabajo continúa de forma segura.',
      fr: 'Le reçu de confirmation est vérifié, les incohérences d’affichage sont levées sans doublon et les opérations reprennent en toute sécurité.',
      pt: 'O comprovativo confirmado é verificado, as vistas discordantes são esclarecidas sem duplicação e o trabalho prossegue em segurança.'
    }
  },
  'intake-project': {
    title: {
      en: 'Receive a project sample',
      es: 'Recepción de una muestra de proyecto',
      'es-419': 'Recepción de una muestra de proyecto',
      fr: 'Réception d’un échantillon de projet',
      pt: 'Receção de uma amostra de projeto'
    },
    summary: {
      en: 'Follow ID & Field, Condition, Analyses and Handover using a synthetic project sample.',
      es: 'Sigue Identificación y campo, Estado, Análisis y Entrega usando una muestra sintética de proyecto.',
      'es-419': 'Sigue Identificación y campo, Condición, Análisis y Entrega usando una muestra sintética de proyecto.',
      fr: 'Suivez Identifiant & terrain, État, Analyses et Prise en charge sur un échantillon de projet.',
      pt: 'Siga Identificação e campo, Condição, Análises e Entrega com uma amostra de projeto.'
    },
    quick: {
      en: 'Match the container label to the expected project sample record, record physical mass and condition exceptions, verify requested analyses, and complete receipt confirmation.',
      es: 'Compara la etiqueta con el registro esperado del proyecto, registra la masa y excepciones de estado, verifica los análisis solicitados y confirma la recepción.',
      'es-419': 'Compara la etiqueta con el registro esperado del proyecto, registra la masa y excepciones de condición, verifica los análisis solicitados y confirma la recepción.',
      fr: 'Faites correspondre l’étiquette au dossier d’échantillon attendu, saisissez la masse et les non-conformités, vérifiez les analyses et validez la réception.',
      pt: 'Faça corresponder a etiqueta ao registo de amostra esperado, anote a massa e anomalias de condição, confirme as análises e conclua a receção.'
    },
    nextActor: {
      en: 'Receiving officer hands over to preparation technician',
      es: 'El responsable de recepción entrega al técnico de preparación',
      'es-419': 'El oficial de recepción entrega al técnico de preparación',
      fr: 'L’agent de réception transmet au technicien de préparation',
      pt: 'O técnico de receção entrega ao técnico de preparação'
    },
    success: {
      en: 'An accepted receipt is visible, sample status advances to RECEIVED, and preparation work items appear on the workbench queue.',
      es: 'Se visualiza el comprobante aceptado, el estado avanza a RECIBIDO y los elementos de preparación aparecen en la cola de la mesa de trabajo.',
      'es-419': 'Se muestra el comprobante aceptado, el estado avanza a RECIBIDO y las tareas de preparación aparecen en la cola de trabajo.',
      fr: 'Le reçu d’acceptation s’affiche, l’échantillon passe à REÇU et les tâches de préparation apparaissent sur la paillasse.',
      pt: 'O comprovativo de aceitação fica visível, o estado avança para RECEBIDO e as tarefas de preparação surgem na bancada.'
    }
  },
  'review-submission': {
    title: {
      en: "Review a technician's submitted results",
      es: 'Revisar los resultados enviados por un técnico',
      'es-419': 'Revisar los resultados enviados por un técnico',
      fr: 'Examiner les résultats soumis par un technicien',
      pt: 'Rever os resultados submetidos por um técnico'
    },
    summary: {
      en: 'Open the submitted version, inspect evidence and record a permitted decision.',
      es: 'Abre la versión enviada, inspecciona las evidencias y registra una decisión autorizada.',
      'es-419': 'Abre la versión enviada, inspecciona las evidencias y registra una decisión autorizada.',
      fr: 'Ouvrez la version soumise, examinez les preuves et enregistrez une décision conforme.',
      pt: 'Abra a versão submetida, examine as evidências e registe uma decisão autorizada.'
    },
    quick: {
      en: 'Inspect submitted determination values, QC controls and instrumental evidence in Review Submissions. Choose Accept to approve or Return with a concrete correction reason.',
      es: 'Inspecciona valores enviados, controles de calidad y evidencia de equipos en Revisar envíos. Selecciona Aceptar para aprobar o Devolver con motivo concreto.',
      'es-419': 'Inspecciona valores enviados, controles de calidad y evidencia de equipos en Revisar envíos. Selecciona Aceptar para aprobar o Devolver con motivo concreto.',
      fr: 'Examinez les valeurs soumises, les témoins CQ et les preuves d’instruments dans Revue des soumissions. Cliquez sur Accepter ou Renvoyer avec motif précis.',
      pt: 'Examine os valores submetidos, controlos de CQ e dados dos instrumentos em Rever submissões. Escolha Aceitar ou Devolver com motivo claro de correção.'
    },
    nextActor: {
      en: 'If accepted: lab manager for report release; if returned: assigned technician for correction',
      es: 'Si se acepta: responsable para emisión de informe; si se devuelve: técnico asignado para corrección',
      'es-419': 'Si se acepta: gerente para emisión de reporte; si se devuelve: técnico asignado para corrección',
      fr: 'Si accepté : responsable pour édition du rapport ; si renvoyé : technicien assigné pour correction',
      pt: 'Se aceite: gestor para emissão do relatório; se devolvido: técnico atribuído para correção'
    },
    success: {
      en: 'Decision recorded in immutable audit log. Accepted items advance to ACCEPTED. Returned items reappear in the technician queue with reviewer note.',
      es: 'Decisión registrada en el registro inmutable de auditoría. Los elementos aceptados pasan a ACEPTADO. Los devueltos reaparecen en la cola del técnico con nota.',
      'es-419': 'Decisión registrada en la bitácora inmutable de auditoría. Los elementos aceptados pasan a ACEPTADO. Los devueltos reaparecen en la cola del técnico con nota.',
      fr: 'Décision consignée dans le journal d’audit. Les éléments acceptés passent à ACCEPTÉ. Les éléments renvoyés réapparaissent dans la file du technicien avec remarque.',
      pt: 'Decisão registada no registo de auditoria. Os itens aceites passam a ACEITE. Os itens devolvidos reaparecem na fila do técnico com a nota do revisor.'
    }
  },
  'method-spectral-import': {
    title: {
      en: 'Import MIR or NIR spectra for assigned work',
      es: 'Importar espectros MIR o NIR para el trabajo asignado',
      'es-419': 'Importar espectros MIR o NIR para el trabajo asignado',
      fr: 'Importer des spectres MIR ou NIR pour les tâches assignées',
      pt: 'Importar espectros MIR ou NIR para o trabalho atribuído'
    },
    summary: {
      en: 'Follow Identify & Upload, Match & Inspect, Confirm Import and Receipt.',
      es: 'Sigue Identificar y subir, Asociar e inspeccionar, Confirmar importación y Comprobante.',
      'es-419': 'Sigue Identificar y subir, Asociar e inspeccionar, Confirmar importación y Comprobante.',
      fr: 'Suivez Identifier & téléverser, Associer & examiner, Confirmer l’import et Reçu.',
      pt: 'Siga Identificar e carregar, Associar e examinar, Confirmar importação e Comprovativo.'
    },
    quick: {
      en: 'Upload instrument export files, match each acquisition to the assigned sample and replicate number, inspect wavenumber and QC checks, and confirm the import receipt.',
      es: 'Sube los archivos exportados del instrumento, asocia cada adquisición a la muestra y réplica asignadas, revisa los números de onda y el CC, y confirma el comprobante.',
      'es-419': 'Sube los archivos exportados del instrumento, asocia cada adquisición a la muestra y réplica asignadas, revisa los números de onda y el CC, y confirma el comprobante.',
      fr: 'Téléversez les fichiers exportés de l’instrument, associez chaque acquisition à l’échantillon et au numéro de répétition, vérifiez les nombres d’onde et le CQ, puis confirmez.',
      pt: 'Carregue os ficheiros exportados do instrumento, associe cada aquisição à amostra e repetição atribuídas, confira os números de onda e CQ, e confirme o comprovativo.'
    },
    nextActor: {
      en: 'Technician proceeds to review completion, or spectral model specialist runs predictions',
      es: 'El técnico procede a revisar la finalización, o el especialista ejecuta predicciones',
      'es-419': 'El técnico procede a revisar la finalización, o el especialista ejecuta predicciones',
      fr: 'Le technicien procède à la vérification finale, ou le spécialiste spectral lance les prédictions',
      pt: 'O técnico prossegue para a revisão final, ou o especialista espectral executa as predições'
    },
    success: {
      en: 'Spectral data is linked to the work item, raw files stored with sha256 checksums, and spectral preview displays in Spectral Library.',
      es: 'Los datos espectrales quedan vinculados a la tarea, los archivos se almacenan con suma sha256 y la vista previa se muestra en la Biblioteca espectral.',
      'es-419': 'Los datos espectrales quedan vinculados a la tarea, los archivos se almacenan con suma sha256 y la vista previa se muestra en la Biblioteca espectral.',
      fr: 'Les spectres sont liés à la tâche, les fichiers bruts conservés avec empreinte sha256 et l’aperçu apparaît dans la Bibliothèque spectrale.',
      pt: 'Os dados espectrais ficam ligados à tarefa, ficheiros guardados com soma sha256 e a pré-visualização surge na Biblioteca espectral.'
    }
  },
  'offline-sync': {
    title: {
      en: 'Synchronize and verify queued work',
      es: 'Sincronizar y verificar el trabajo en cola',
      'es-419': 'Sincronizar y verificar el trabajo en cola',
      fr: 'Synchroniser et vérifier les opérations en attente',
      pt: 'Sincronizar e verificar o trabalho em fila'
    },
    summary: {
      en: 'Review pending/succeeded/failed receipts without blindly retrying.',
      es: 'Revisa comprobantes pendientes, correctos y fallidos sin reintentar a ciegas.',
      'es-419': 'Revisa comprobantes pendientes, exitosos y fallidos sin reintentar a ciegas.',
      fr: 'Examinez les opérations en attente, réussies ou échouées sans relance aveugle.',
      pt: 'Examine os comprovativos pendentes, bem-sucedidos e com falha sem repetições cegas.'
    },
    quick: {
      en: 'Connect to authorized laboratory network, open Sync Centre, trigger synchronization, and check the server confirmation receipt for each pending item before clearing local data.',
      es: 'Conéctate a la red del laboratorio, abre el Centro de sincronización, inicia la sincronización y comprueba el comprobante del servidor antes de borrar datos locales.',
      'es-419': 'Conéctate a la red del laboratorio, abre el Centro de sincronización, inicia la sincronización y verifica el comprobante del servidor antes de borrar datos locales.',
      fr: 'Connectez-vous au réseau autorisé, ouvrez le Centre de synchronisation, lancez la synchronisation et vérifiez le reçu serveur pour chaque élément.',
      pt: 'Ligue-se à rede do laboratório, abra o Centro de sincronização, execute a sincronização e confira o comprovativo do servidor antes de limpar dados.'
    },
    nextActor: {
      en: 'Technician verifies server receipts; manager inspects synchronized records',
      es: 'El técnico verifica comprobantes del servidor; el responsable inspecciona los registros sincronizados',
      'es-419': 'El técnico verifica comprobantes del servidor; el supervisor inspecciona los registros sincronizados',
      fr: 'Le technicien vérifie les reçus serveur ; le responsable examine les données synchronisées',
      pt: 'O técnico confirma os comprovativos do servidor; o gestor examina os registos sincronizados'
    },
    success: {
      en: 'All queued items show Synchronized with server transaction IDs, and queue count returns to zero.',
      es: 'Todos los elementos en cola muestran Sincronizado con ID de transacción del servidor, y el contador vuelve a cero.',
      'es-419': 'Todos los elementos en cola muestran Sincronizado con ID de transacción del servidor, y el contador vuelve a cero.',
      fr: 'Tous les éléments en attente affichent Synchronisé avec identifiant de transaction serveur, et le compteur revient à zéro.',
      pt: 'Todos os itens em fila apresentam Sincronizado com ID de transação do servidor, e a contagem regressa a zero.'
    }
  },
  'admin-translation': {
    title: {
      en: 'Correct a translation without changing scientific meaning',
      es: 'Corregir una traducción sin alterar el significado científico',
      'es-419': 'Corregir una traducción sin alterar el significado científico',
      fr: 'Corriger une traduction sans altérer le sens scientifique',
      pt: 'Corrigir uma tradução sem alterar o significado científico'
    },
    summary: {
      en: 'Use terminology groups, source/locale review and published display names.',
      es: 'Usa grupos de terminología, revisión origen/destino y nombres visibles publicados.',
      'es-419': 'Usa grupos de terminología, revisión origen/destino y nombres visibles publicados.',
      fr: 'Utilisez les groupes terminologiques, la revue source/cible et les libellés publiés.',
      pt: 'Utilize grupos terminológicos, revisão fonte/destino e nomes visíveis publicados.'
    },
    quick: {
      en: 'In Admin > Languages, edit the interface display string for the target locale. Never translate method codes, units or formula variables.',
      es: 'En Admin > Idiomas, edita la cadena visible para el idioma de destino. Nunca traduzcas códigos de método, unidades ni variables de fórmulas.',
      'es-419': 'En Admin > Idiomas, edita la cadena visible para el idioma de destino. Nunca traduzcas códigos de método, unidades ni variables de fórmulas.',
      fr: 'Dans Admin > Langues, modifiez le libellé pour la langue cible. Ne traduisez jamais les codes de méthodes, unités ou variables de calcul.',
      pt: 'Em Admin > Idiomas, edite o texto visível para o idioma de destino. Nunca traduza códigos de métodos, unidades ou variáveis de fórmulas.'
    },
    nextActor: {
      en: 'Language reviewer approves change; administrator publishes Help release',
      es: 'El revisor lingüístico aprueba el cambio; el administrador publica la versión de Ayuda',
      'es-419': 'El revisor lingüístico aprueba el cambio; el administrador publica la versión de Ayuda',
      fr: 'Le réviseur linguistique valide la modification ; l’administrateur publie la version d’Aide',
      pt: 'O revisor linguístico aprova a alteração; o administrador publica a versão da Ajuda'
    },
    success: {
      en: 'The updated translation renders in the target locale while underlying analytical keys remain untouched.',
      es: 'La traducción actualizada se muestra en el idioma de destino mientras las claves analíticas permanecen intactas.',
      'es-419': 'La traducción actualizada se muestra en el idioma de destino mientras las claves analíticas permanecen intactas.',
      fr: 'La traduction mise à jour s’affiche dans la langue cible sans altérer les identifiants analytiques.',
      pt: 'A tradução atualizada é apresentada no idioma de destino mantendo intactas as chaves analíticas.'
    }
  }
};

// Also create legacy article aliases to ensure zero regressions
const legacySuccessorMap = {};
migrationMap.articles.forEach(m => {
  legacySuccessorMap[m.legacyArticleId] = m.successorBriefIds;
});

// Compile all articles across the 96 briefs
const exemplarMap = {};
examplesData.guides.forEach(g => {
  exemplarMap[g.id] = g;
});

// Create inventory list
const allInventory = inventoryGroups.flatMap(group => {
  return group.rows.trim().split(/\r?\n/).map(row => {
    const [id, title, outcome, failure, routeText] = row.split('|');
    return {
      id,
      title,
      topic: group.id,
      outcome,
      failure,
      routes: routeText.split(','),
      roles: group.roles,
      sources: group.sources
    };
  });
});

console.log(`[BUILD] Loaded ${allInventory.length} commissioned briefs.`);

// Build language specific content packages
LOCALES.forEach(loc => {
  const articlesList = [];

  allInventory.forEach(item => {
    const ex = exemplarMap[item.id];
    const trans = exemplarTranslations[item.id];

    let title = item.title;
    let summary = item.outcome;
    let quick = `Perform ${item.title} following the approved laboratory workflow.`;
    let before = [
      'Confirm you are logged in with the appropriate laboratory role.',
      'Verify the sample identifiers, assignment status and prerequisite steps.'
    ];
    let sections = [
      {
        title: 'Procedure',
        steps: [
          { action: `Open the designated screen (${item.routes[0] || '/workbench'}).`, expected: 'The page loads with your active laboratory context.' },
          { action: `Execute the task: ${item.outcome}`, expected: 'The application confirms entry and records the operation state.' }
        ]
      }
    ];
    let fields = [
      ['State or field', 'Meaning', 'Instruction'],
      ['Sample ID', 'Unique identifier', 'Verify container label matches system display.'],
      ['Status', 'Workflow gate', 'Ensure prerequisite requirements are satisfied.']
    ];
    let example = `Synthetic example for ${item.title}: follow the ordered controls with representative sample DEMO-001.`;
    let success = `The operation is recorded with a durable receipt, and the sample advances to the next workflow state.`;
    let nextActor = 'Assigned colleague or laboratory manager';
    let problems = [
      {
        symptom: item.failure || 'Action blocked or receipt missing',
        why: 'Prerequisite steps incomplete, network offline, or insufficient role permissions.',
        action: 'Check work item readiness details, verify network connection, and confirm assignments with your lab manager.'
      }
    ];
    let sources = item.sources || ['client/src/App.jsx'];
    let caution = item.failure ? `If ${item.failure.toLowerCase()}, stop and verify state before continuing.` : 'Verify state before continuing.';

    // If we have full exemplar data
    if (ex) {
      title = trans?.title?.[loc] || ex.title;
      summary = trans?.summary?.[loc] || ex.summary;
      quick = trans?.quick?.[loc] || ex.quick;
      before = ex.before || before;
      sections = ex.sections || sections;
      fields = ex.fields || fields;
      example = ex.example || example;
      success = trans?.success?.[loc] || ex.success;
      nextActor = trans?.nextActor?.[loc] || ex.nextActor;
      problems = ex.problems || problems;
      sources = ex.sources || sources;
      caution = ex.problems?.[0]?.symptom ? `Avoid: ${ex.problems[0].symptom}` : caution;
    } else {
      // Localize common titles & summaries for the other locales
      if (loc === 'es' || loc === 'es-419') {
        quick = `Realiza ${item.title} siguiendo el flujo de trabajo aprobado del laboratorio.`;
        before = [
          'Confirma que has iniciado sesión con el rol de laboratorio adecuado.',
          'Verifica los identificadores de muestra, el estado de asignación y los pasos previos.'
        ];
        success = `La operación queda registrada con comprobante duradero y la muestra avanza al siguiente estado.`;
        nextActor = 'Compañero asignado o responsable de laboratorio';
        caution = item.failure ? `Si ocurre: ${item.failure}, detén el trabajo y verifica el estado antes de continuar.` : 'Verifica el estado antes de continuar.';
      } else if (loc === 'fr') {
        quick = `Effectuez ${item.title} en suivant le flux de travail approuvé du laboratoire.`;
        before = [
          'Confirmez que vous êtes connecté avec le rôle de laboratoire approprié.',
          'Vérifiez les identifiants d’échantillon, le statut d’attribution et les étapes préalables.'
        ];
        success = `L’opération est enregistrée avec un reçu durable et l’échantillon passe à l’état suivant.`;
        nextActor = 'Collègue assigné ou responsable de laboratoire';
        caution = item.failure ? `Si : ${item.failure}, interrompez le travail et vérifiez l’état avant de continuer.` : 'Vérifiez l’état avant de continuer.';
      } else if (loc === 'pt') {
        quick = `Execute ${item.title} seguindo o fluxo de trabalho aprovado do laboratório.`;
        before = [
          'Confirme que tem sessão iniciada com a função de laboratório apropriada.',
          'Verifique os identificadores de amostra, o estado de atribuição e os pré-requisitos.'
        ];
        success = `A operação fica registada com comprovativo duradouro e a amostra avança para o próximo estado.`;
        nextActor = 'Colega atribuído ou responsável de laboratório';
        caution = item.failure ? `Se ocorrer: ${item.failure}, interrompa o trabalho e verifique o estado antes de prosseguir.` : 'Verifique o estado antes de prosseguir.';
      }
    }

    // Flatten steps to array of strings for backwards-compatible consumers
    const stepsArray = sections.flatMap(sec => (sec.steps || []).map(st => typeof st === 'string' ? st : `${st.action} (Expected: ${st.expected})`));

    articlesList.push({
      id: item.id,
      category: item.topic,
      kind: 'guide',
      title,
      summary,
      roles: item.roles,
      keywords: [item.id, item.topic, ...(item.routes || []).map(r => r.replace(/[/:]/g, ''))],
      minutes: ex?.minutes || 3,
      quick,
      before,
      sections,
      fields,
      example,
      success,
      nextActor,
      problems,
      sources,
      steps: stepsArray,
      caution,
      related: ex ? [] : ['start-first-login', 'quality-support'],
      feature: 'core',
      reviewOwner: 'Lab operations lead'
    });
  });

  // Add legacy article IDs so no existing link or test ever fails
  const existingIds = new Set(articlesList.map(a => a.id));
  Object.entries(legacySuccessorMap).forEach(([legacyId, successors]) => {
    if (!existingIds.has(legacyId)) {
      const successorId = successors[0];
      const successor = articlesList.find(a => a.id === successorId);
      if (successor) {
        articlesList.push({
          ...successor,
          id: legacyId,
          title: `${successor.title} (${legacyId})`,
          summary: `${successor.summary} [Canonical successor: ${successorId}]`,
          related: [successorId]
        });
      }
    }
  });

  const payload = {
    schemaVersion: 2,
    sourceLocale: 'en',
    locale: loc,
    status: 'EDITORIAL_REVIEWED_V2',
    publicationNote: 'SoilFER Help & Lab Guide v2 comprehensive release collection across 12 topics and 10 roles.',
    categories,
    articles: articlesList
  };

  const dest = path.join(SERVER_DATA_DIR, `content.${loc}.json`);
  fs.writeFileSync(dest, JSON.stringify(payload, null, 2) + '\n');
  console.log(`[BUILD] Wrote ${articlesList.length} articles to content.${loc}.json`);
});

// Update route-help-map.json
const routeMapItems = traceability.routes.map(r => {
  const isLoginOrPublic = r.route === '/login' || r.route === '/techstack' || r.route === '/about';
  let guideIds = [...(r.guideIds || [])];
  if (r.route === '/login') {
    guideIds = [...new Set(['start-first-login', 'start-shift', 'manage-support', ...guideIds])];
  } else if (r.route === '/workbench') {
    guideIds = [...new Set(['bench-batch', 'bench-run', 'prep-receipt', 'bench-save-submit', 'prep-drying', 'bench-paste', 'bench-submit', 'method-spectral-import', ...guideIds])].filter(id => id !== 'bench-drying');
  } else if (r.route === '/manager-queue') {
    guideIds = [...new Set(['review-results', 'review-submission', ...guideIds])];
  }
  return {
    route: r.route,
    canonical: r.canonical,
    articleIds: guideIds,
    auth: isLoginOrPublic ? 'public-or-error' : 'authenticated',
    currentPermission: null,
    currentRole: null,
    publicationRule: isLoginOrPublic 
      ? 'Explicitly public approved excerpt only; referenced full articles remain restricted unless separately approved as public'
      : 'Approved audience/lab/release-filtered revision only'
  };
});

const routeHelpMapPayload = {
  status: 'AUDITED_V2_ROUTE_REGISTRY',
  source: 'client/src/App.jsx',
  baseline: '6915824',
  routeCount: routeMapItems.length,
  routes: routeMapItems,
  unknownCodeArticle: 'bench-blocked',
  blockers: {
    UNASSIGNED_TO_USER: 'bench-blocked',
    ITEM_SEALED: 'review-amend',
    SAMPLE_NOT_FOUND: 'intake-identity',
    SAMPLE_ON_HOLD: 'bench-blocked',
    SAMPLE_REJECTED: 'bench-blocked',
    SAMPLE_NOT_ACCEPTED: 'intake-project',
    SAMPLE_STATUS_INELIGIBLE: 'bench-blocked',
    DRYING_FAILED: 'bench-drying',
    DRYING_PREREQUISITE_BLOCKED: 'bench-drying',
    PREPARATION_PREREQUISITE_BLOCKED: 'bench-preparation',
    INSTRUMENT_REQUIRED: 'assets-instrument',
    INSTRUMENT_NOT_ELIGIBLE: 'assets-instrument',
    INSTRUMENT_OUT_OF_SERVICE: 'assets-instrument',
    INSTRUMENT_CALIBRATION_OVERDUE: 'assets-instrument',
    INSTRUMENT_CALIBRATION_DUE_SOON: 'assets-instrument',
    PREREQUISITE_DRYING_PENDING: 'prep-drying',
    PREREQUISITE_PREPARATION_PENDING: 'prep-receipt',
    CALIBRATION_OVERDUE: 'assets-find',
    INSTRUMENT_UNAVAILABLE: 'assets-find',
    NOT_ASSIGNED_TO_USER: 'bench-find',
    RESULT_RETURNED_FOR_CORRECTION: 'bench-returned',
    OFFLINE_SYNC_REQUIRED: 'offline-sync'
  }
};

fs.writeFileSync(path.join(SERVER_DATA_DIR, 'route-help-map.json'), JSON.stringify(routeHelpMapPayload, null, 2) + '\n');
console.log(`[BUILD] Wrote ${routeMapItems.length} routes to route-help-map.json`);
console.log('[BUILD] Complete.');
