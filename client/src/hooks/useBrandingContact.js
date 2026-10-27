import { useEffect, useState } from 'react';
import axios from 'axios';

export default function useBrandingContact() {
    const [contactEmail, setContactEmail] = useState('');
    useEffect(() => {
        let active = true;
        axios.get('/api/public/branding').then(({ data }) => {
            const value = data?.branding?.contactEmail;
            if (active) setContactEmail(typeof value === 'string' ? value.trim() : '');
        }).catch(() => {});
        return () => { active = false; };
    }, []);
    return contactEmail;
}
