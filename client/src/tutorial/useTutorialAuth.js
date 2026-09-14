import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export const TUTORIAL_PERMISSIONS = {
    'VIEW_SAMPLES': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR', 'AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'],
    'CREATE_SAMPLE': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'SURVEYOR'],
    'RECEIVE_SAMPLE': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'],
    'ASSIGN_LAB_ID': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'],
    'CHANGE_STATUS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN'],
    'EDIT_ANALYSES': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'],
    'ENTER_RESULTS': ['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN'],
    'APPROVE_RESULTS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],
    'BATCH_APPROVAL': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],
    'VIEW_INVENTORY': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'],
    'CONSUME_INVENTORY': ['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN'],
    'MANAGE_INVENTORY': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],
    'VIEW_EQUIPMENT': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'AUDIT_USER', 'VIEWER'],
    'MANAGE_EQUIPMENT': ['SUPER_ADMIN', 'LAB_MANAGER'],
    'VIEW_PROJECTS': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR', 'AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'],
    'MANAGE_PROJECTS': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER'],
    'ARCHIVE_PROJECTS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],
    'MANAGE_USERS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],
    'VIEW_AUDIT': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'AUDIT_USER'],
    'GENERATE_REPORT': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'AUDIT_USER'],
    'MANAGE_ANALYSES': ['SUPER_ADMIN', 'LAB_MANAGER', 'MASTER_USER'],
    'MANAGE_BRANDING': ['SUPER_ADMIN', 'LAB_MANAGER', 'MASTER_USER']
};

/**
 * useTutorialAuth
 * Reactive auth bridge for tutorial overlay.
 * Uses existing AuthContext and verifies live credentials against /api/auth/me.
 * Discards stale requests with AbortController.
 * Fails closed on network/500 errors (authStatus === 'unavailable').
 */
export function useTutorialAuth() {
    const { user: authContextUser, token } = useAuth();
    const [authStatus, setAuthStatus] = useState('verifying'); // 'verifying' | 'verified' | 'anonymous' | 'unavailable'
    const [verifiedUser, setVerifiedUser] = useState(null);
    const priorActorRef = useRef(null);
    const [identityChanged, setIdentityChanged] = useState(false);

    useEffect(() => {
        if (!token) {
            setVerifiedUser(null);
            setAuthStatus('anonymous');
            if (priorActorRef.current !== null) {
                setIdentityChanged(true);
                priorActorRef.current = null;
            }
            return;
        }

        // Clear previous verified identity at the start of a new verification
        setVerifiedUser(null);
        setAuthStatus('verifying');
        const controller = new AbortController();

        axios.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
        })
        .then(res => {
            const user = res.data?.data || res.data;
            if (user && user.id) {
                const actorKey = `${user.id}:${user.labId || ''}`;
                if (priorActorRef.current && priorActorRef.current !== actorKey) {
                    setIdentityChanged(true);
                }
                priorActorRef.current = actorKey;
                setVerifiedUser(user);
                setAuthStatus('verified');
            } else {
                setVerifiedUser(null);
                setAuthStatus('anonymous');
                if (priorActorRef.current !== null) {
                    setIdentityChanged(true);
                    priorActorRef.current = null;
                }
            }
        })
        .catch(err => {
            if (axios.isCancel(err) || err.name === 'CanceledError') {
                return; // Stale request cancelled
            }
            if (err.response?.status === 401 || err.response?.status === 403) {
                setVerifiedUser(null);
                setAuthStatus('anonymous');
            } else {
                // Network / 500 failure fails closed as 'unavailable'
                setVerifiedUser(null);
                setAuthStatus('unavailable');
            }
        });

        return () => {
            controller.abort();
        };
    }, [token, authContextUser?.id, authContextUser?.role, authContextUser?.labId, authContextUser?.mustChangePassword, JSON.stringify(authContextUser?.permissions)]);

    const acknowledgeIdentityChange = useCallback(() => {
        setIdentityChanged(false);
    }, []);

    const effectiveUser = authStatus === 'verified' ? verifiedUser : null;
    const mustChangePassword = Boolean(verifiedUser?.mustChangePassword || authContextUser?.mustChangePassword);

    const checkPermission = useCallback((perm) => {
        if (authStatus !== 'verified' || !verifiedUser || !verifiedUser.role) return false;
        if (verifiedUser.role === 'SUPER_ADMIN') return true;
        const allowedRoles = TUTORIAL_PERMISSIONS[perm] || [];
        return allowedRoles.includes(verifiedUser.role);
    }, [authStatus, verifiedUser]);

    return {
        token,
        authStatus,
        verifiedUser: effectiveUser,
        isAuthenticated: authStatus === 'verified' && Boolean(effectiveUser),
        mustChangePassword,
        identityChanged,
        acknowledgeIdentityChange,
        hasPermission: checkPermission
    };
}
