// #202 B14: an expired session re-authenticates in place, so typed work
// survives. The axios interceptor asks the mounted SessionKeeper for a fresh
// token; concurrent 401s share one prompt. Without a keeper, callers fall
// back to the existing sign-in redirect.
let handler = null;
let pending = null;

export function registerReloginHandler(fn) {
    handler = fn;
    return () => { if (handler === fn) handler = null; };
}

export function requestRelogin() {
    if (!handler) return null;
    if (!pending) pending = Promise.resolve().then(handler).finally(() => { pending = null; });
    return pending;
}

// Retries a request rejected with TOKEN_EXPIRED once, with the fresh token and
// the original body, so the typed values reach the server. Returns null when
// the caller should use its existing handling.
export function retryAfterRelogin(error, send) {
    if (error?.response?.status !== 401 || error.response.data?.code !== 'TOKEN_EXPIRED' || error.config?._sfRelogin) return null;
    const relogin = requestRelogin();
    if (!relogin) return null;
    return relogin.then(token => send({ ...error.config, _sfRelogin: true, headers: { ...error.config.headers, Authorization: `Bearer ${token}` } }),
        () => Promise.reject(error));
}

// Reads exp/iat from a JWT without verifying it; the server stays the authority.
export function tokenTimes(token) {
    try {
        const payload = JSON.parse(atob(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return Number.isFinite(payload.exp) && Number.isFinite(payload.iat) ? { iat: payload.iat * 1000, exp: payload.exp * 1000 } : null;
    } catch {
        return null;
    }
}
