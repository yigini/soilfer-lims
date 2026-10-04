import {useEffect,useState} from 'react';
import axios from 'axios';
import {draftScope} from './intakeForm';

export default function useIntakeForm({user,mode,projectId,sampleId,matrix='SOIL'}) {
    const [state,setState] = useState({form:null,error:null,cached:false});
    const origin = mode === 'WALK_IN' ? 'DESK_WALKIN' : 'PROJECT_SAMPLE';
    useEffect(() => {
        if (!mode || !user?.id) {setState({form:null,error:null,cached:false});return;}
        let active = true;
        const cacheKey = 'limsi_intake_form:' + draftScope(user,{projectId:projectId||null,origin,matrix},sampleId||'new',null);
        setState({form:null,error:null,cached:false});
        const load = async () => {
            try {
                const {data} = await axios.get('/api/reception/sample-context',{params:sampleId ? {id:sampleId} : {projectId:projectId||undefined,origin,matrix}});
                if (!active) return;
                setState({form:data.intakeTemplate,error:null,cached:false});
                try {localStorage.setItem(cacheKey,JSON.stringify({ownerId:String(user.id),labId:user.labId,form:data.intakeTemplate}));} catch { /* A storage error must not block online work. */ }
            } catch (err) {
                if (!active) return;
                // A real server refusal always wins over an older cached decision.
                if (!err.response) {
                    try {
                        const cached = JSON.parse(localStorage.getItem(cacheKey));
                        if (cached?.ownerId === String(user.id) && cached.labId === user.labId) {
                            setState({form:cached.form,error:null,cached:true});return;
                        }
                    } catch { /* No usable owned form. Keep input and require an online review. */ }
                }
                setState({form:null,error:err.response?.data?.code || err.response?.data?.error || 'INTAKE_TEMPLATE_UNAVAILABLE',cached:false});
            }
        };
        load();
        return () => {active=false;};
    },[user?.id,user?.labId,mode,projectId,sampleId,matrix,origin]);
    return state;
}
