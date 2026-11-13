import { useEffect, useState } from 'react';
import axios from 'axios';

export function useBrandingLinks() {
    const [links, setLinks] = useState({ contactEmail: '', manualUrl: '' });
    useEffect(() => {
        let active = true;
        axios.get('/api/public/branding').then(({ data }) => {
            const branding = data?.branding;
            const contactEmail = typeof branding?.contactEmail === 'string' ? branding.contactEmail.trim() : '';
            const manualUrl = typeof branding?.manualUrl === 'string' && /^https?:\/\//i.test(branding.manualUrl)
                ? branding.manualUrl : '';
            if (active) setLinks({ contactEmail, manualUrl });
        }).catch(() => {});
        return () => { active = false; };
    }, []);
    return links;
}

export default function useBrandingContact() {
    return useBrandingLinks().contactEmail;
}
