export const foundations = [
    {
        id: 'f01',
        titleKey: 'foundation.f01.title',
        copyKey: 'foundation.f01.copy',
        whyKey: 'foundation.f01.why',
        nextKey: 'foundation.f01.next',
        subtitleKey: 'foundation.f01.subtitle',
        leadKey: 'foundation.f01.lead',
        panelTitleKey: 'foundation.f01.panelTitle',
        checkQuestionKey: 'foundation.f01.question',
        options: [
            { id: 'wrong', textKey: 'common.yes', isCorrect: false },
            { id: 'correct', textKey: 'foundation.f01.optNotNecessarily', isCorrect: true }
        ],
        feedbackCorrectKey: 'foundation.f01.feedbackCorrect',
        feedbackIncorrectKey: 'foundation.f01.feedbackIncorrect'
    },
    {
        id: 'f02',
        titleKey: 'foundation.f02.title',
        copyKey: 'foundation.f02.copy',
        whyKey: 'foundation.f02.why',
        nextKey: 'foundation.f02.next',
        subtitleKey: 'foundation.f02.subtitle',
        leadKey: 'foundation.f02.lead',
        panelTitleKey: 'foundation.f02.panelTitle',
        checkQuestionKey: 'foundation.f02.question',
        options: [
            { id: 'correct', textKey: 'foundation.f02.optOneSample', isCorrect: true },
            { id: 'wrong', textKey: 'foundation.f02.optTwoSamples', isCorrect: false }
        ],
        feedbackCorrectKey: 'foundation.f02.feedbackCorrect',
        feedbackIncorrectKey: 'foundation.f02.feedbackIncorrect'
    },
    {
        id: 'f03',
        titleKey: 'foundation.f03.title',
        copyKey: 'foundation.f03.copy',
        whyKey: 'foundation.f03.why',
        nextKey: 'foundation.f03.next',
        subtitleKey: 'foundation.f03.subtitle',
        leadKey: 'foundation.f03.lead',
        panelTitleKey: 'foundation.f03.panelTitle',
        checkQuestionKey: 'foundation.f03.question',
        options: [
            { id: 'correct', textKey: 'foundation.f03.optCompleteSubmit', isCorrect: true },
            { id: 'wrong', textKey: 'foundation.f03.optReviewerApprove', isCorrect: false }
        ],
        feedbackCorrectKey: 'foundation.f03.feedbackCorrect',
        feedbackIncorrectKey: 'foundation.f03.feedbackIncorrect'
    }
];

export const f03PracticeSamples = [
    { id: 'TRAIN-US-001', fieldId: 'GTM-DEMO-101', state: 'Received', stateKey: 'foundation.f03.filterReceived' },
    { id: 'TRAIN-US-002', fieldId: 'GTM-DEMO-102', state: 'Expected', stateKey: 'foundation.f03.filterExpected' },
    { id: 'TRAIN-US-003', fieldId: 'GTM-DEMO-103', state: 'Received', stateKey: 'foundation.f03.filterReceived' }
];

export const glossaryEntriesByChapter = {
    0: [
        { term: 'LIMS', termKey: 'glossary.termLims', meaningKey: 'glossary.lims' },
        { term: 'Sample', termKey: 'glossary.termSample', meaningKey: 'glossary.sample' },
        { term: 'Project', termKey: 'glossary.termProject', meaningKey: 'glossary.project' }
    ],
    7: [
        { term: 'Spectrum', termKey: 'glossary.termSpectrum', meaningKey: 'glossary.spectrum' },
        { term: 'MIR / NIR', termKey: 'glossary.termMirNir', meaningKey: 'glossary.mir_nir' },
        { term: 'QC', termKey: 'glossary.termQc', meaningKey: 'glossary.qc' }
    ],
    10: [
        { term: 'Kobo', termKey: 'glossary.termKobo', meaningKey: 'glossary.kobo' },
        { term: 'SIS', termKey: 'glossary.termSis', meaningKey: 'glossary.sis' },
        { term: 'Lot', termKey: 'glossary.termLot', meaningKey: 'glossary.lot' }
    ],
    default: [
        { term: 'Workbench', termKey: 'glossary.termWorkbench', meaningKey: 'glossary.workbench' },
        { term: 'Draft', termKey: 'glossary.termDraft', meaningKey: 'glossary.draft' },
        { term: 'Submit', termKey: 'glossary.termSubmit', meaningKey: 'glossary.submit' },
        { term: 'Audit history', termKey: 'glossary.termAuditHistory', meaningKey: 'glossary.auditHistory' }
    ]
};
