import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/**
 * Bridge component connecting AuthProvider state with ThemeContext.
 * Ensures user identity and server-backed themePreference are synchronized
 * into ThemeContext without creating circular provider dependencies.
 */
export function AuthenticatedAppearanceBridge() {
    const { user } = useAuth();
    const { syncAuthUser } = useTheme();

    useEffect(() => {
        syncAuthUser(user);
    }, [user, syncAuthUser]);

    return null;
}

export default AuthenticatedAppearanceBridge;
