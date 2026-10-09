const prisma = require('../prisma');
const scopeGuard = require('../utils/scopeGuard');
const { hasPermission } = require('../config/roles');
const { measuredValue } = require('../services/reportedValueService');
const { readSampleReportedValues, reportedValueText } = require('../services/reportedValueReadService');

const EXCLUDED_ANALYSES = new Set(['DRYING', 'PREPARATION', 'ARCHIVING', 'DISPOSAL', 'ARCH', 'DISP', 'DISPOSAL_PENDING']);
const SPECTRAL_ANALYSES = new Set(['SPEC_VIS_NIR', 'SPEC_MIR', 'Vis-NIR Soil Spectra', 'MIR Soil Spectra']);
const parseJson = value => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch (_) { return null; } };

exports.getAnalyticalResults = async (req, res) => {
    try {
        const { project, country, startDate, endDate, analysisType } = req.query;
        if (!hasPermission(req.user, 'VIEW_ANALYTICAL_RESULTS')) {
            return res.status(403).json({ error: 'Access denied: Analytical results are outside your permissions.', code: 'PERMISSION_DENIED', data: [], columns: [] });
        }
        const filters = { status: { notIn: ['EXPECTED', 'RECEIVED', 'DRAFT', 'RECEIVED_REJECTED'] } };
        if (project) filters.projectCode = { in: project.toUpperCase().split(',') };
        if (country) filters.countryName = country;
        if (startDate || endDate) {
            filters.receptionDate = {};
            if (startDate) filters.receptionDate.gte = new Date(startDate);
            if (endDate) filters.receptionDate.lte = new Date(endDate);
            if (Object.values(filters.receptionDate).some(date => Number.isNaN(date.getTime()))) {
                return res.status(400).json({ error: 'Invalid reception date filter.', code: 'INVALID_DATE_FILTER' });
            }
        }
        const samples = await prisma.sample.findMany({
            where: scopeGuard.buildScopedWhere(req.user, filters, { labField: 'labId', altLabField: 'assignedLab' }),
            include: { workItems: true },
            orderBy: { receptionDate: 'desc' }, take: 500
        });
        const spectralIndex = await prisma.spectralData.findMany({
            where: { sampleId: { in: samples.map(sample => sample.id) }, isCurrent: true },
            select: { sampleId: true, modality: true }
        });
        const definitions = await prisma.analysis.findMany({ select: { code: true, name: true, units: true } });
        const defMap = Object.fromEntries(definitions.map(definition => [definition.code, definition]));
        const included = code => {
            if (EXCLUDED_ANALYSES.has(code)) return false;
            if (!analysisType || analysisType === 'ALL') return true;
            if (analysisType === 'SPECTRAL') return SPECTRAL_ANALYSES.has(code);
            if (analysisType === 'WET_CHEM') return !SPECTRAL_ANALYSES.has(code);
            if (analysisType === 'TEXTURE') return ['SAND', 'SILT', 'CLAY', 'TEXTURE'].includes(code);
            return code === analysisType;
        };
        const analysisKeys = new Set();
        const reportedBySample = new Map();
        for(const sample of samples) reportedBySample.set(sample.id,await readSampleReportedValues(prisma,sample,{partial:true}));
        const data = samples.flatMap(sample => {
            const reported = reportedBySample.get(sample.id).values;
            const codes = [...new Set([...(parseJson(sample.requiredAnalyses) || []),
                ...sample.workItems.map(item => item.analysis), ...reported.map(result => result.param)])].filter(included);
            codes.forEach(code => analysisKeys.add(code));
            const base = {
                id: sample.id, sampleId: sample.id, labId: sample.labId || sample.originalId || 'N/A', originalId: sample.originalId,
                project: sample.projectCode, country: sample.countryName, status: sample.status,
                submitter: sample.submitter || parseJson(sample.metadata)?.submitterName || '',
                collectionDate: sample.collectionDate, receptionDate: sample.receptionDate, latitude: '', longitude: '',
                reportedValueErrors:reportedBySample.get(sample.id).errors.filter(error=>included(error.analysisCode))
            };
            const pending = {};
            for (const code of codes) {
                const refusal=base.reportedValueErrors.find(error=>error.analysisCode===code);
                if(refusal) {pending[code]={status:'UNAVAILABLE',code:refusal.code,workItemId:refusal.workItemId};continue;}
                const items = sample.workItems.filter(item => item.analysis === code);
                const item = items[0];
                const modality = ['SPEC_MIR', 'MIR Soil Spectra'].includes(code) ? 'MIR' : 'NIR';
                const spectralExists = SPECTRAL_ANALYSES.has(code) && spectralIndex.some(scan => scan.sampleId === sample.id && scan.modality === modality);
                if (spectralExists && items.some(item => ['ACCEPTED', 'COMPLETED', 'APPROVED', 'SUBMITTED', 'SUBMITTED_PARTIAL'].includes(item.status))) {
                    pending[code] = 'Spectrum Uploaded';
                } else if (item && ['CANCELLED', 'N/A'].includes(item.status)) pending[code] = 'N/A';
                else pending[code] = { status: 'PENDING', assignedTo: item?.assignedTo || 'Pending Intake', lastUpdated: item?.updatedAt,
                    ...(spectralExists ? { note: 'Spectrum uploaded, awaiting review' } : {}) };
            }
            const results = reported.filter(result => included(result.param));
            if (!results.length) return [{ ...base, ...pending }];
            return results.map(result => {
                const value = measuredValue(result, defMap[result.param]?.units || '');
                const pLower = result.param.toLowerCase();
                const notReportable=result.mode==='NOT_REPORTABLE', text=reportedValueText(result,req.user.language);
                const row = { ...base, id: `${sample.id}:${result.selectionId}`, reportedValueSelectionId:result.selectionId,
                    sourceResultIds:result.sourceResultIds, attemptIds:result.attemptIds,
                    methodologyId: result.methodologyId,
                    [result.param]:notReportable?text:value.value,
                    [`${pLower}_as_measured`]:notReportable?text:value.asMeasured, [`${pLower}_unit`]:notReportable?'':value.unit,
                    [`${pLower}_normalized`]:notReportable?text:value.normalizedValue, [`${pLower}_controlled_unit`]:notReportable?'':value.controlledUnit };
                for (const code of codes.filter(code => SPECTRAL_ANALYSES.has(code))) row[code] = pending[code];
                return row;
            });
        });
        const { getAnalysisName } = require('../services/analysisService');
        const resultColumns = await Promise.all([...analysisKeys].sort().map(async code => {
            const definition = defMap[code], name = definition?.name || await getAnalysisName(code);
            return { key: code, label: `${name}${definition?.units ? ` (${definition.units})` : ''}`,
                shortLabel: name, unit: definition?.units || null, isResult: true };
        }));
        res.json({ data, reportedValueErrors:[...reportedBySample.values()].flatMap(proof=>proof.errors).filter(error=>included(error.analysisCode)), columns: [
            { key: 'labId', label: 'Lab ID', frozen: true }, { key: 'originalId', label: 'Original ID' },
            { key: 'project', label: 'Project' }, { key: 'country', label: 'Country' }, { key: 'status', label: 'Status' },
            { key: 'collectionDate', label: 'Collected' }, { key: 'receptionDate', label: 'Received' },
            ...resultColumns
        ] });
    } catch (error) {
        if(error.statusCode) return res.status(error.statusCode).json({error:error.message,code:error.code});
        console.error('Data Results Error:', error);
        res.status(500).json({ error: 'Failed to load analytical results.' });
    }
};
