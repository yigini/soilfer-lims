'use strict';

// Installation policy is shared by known and unknown accounts. Laboratory
// overrides must not make account existence observable through a different rule.
function readSignInPolicy() {
    const policy = require('./policyService');
    const profile = policy.loadProfile();
    const read = key => Object.hasOwn(profile.overrides, key)
        ? profile.overrides[key] : policy.getStrict(key);
    return {
        failureThreshold: read('auth.loginFailureThreshold'),
        windowMs: read('auth.loginWindowMinutes') * 60000,
        maxDelayMs: read('auth.loginMaxDelayMinutes') * 60000,
        minPasswordLength: read('auth.passwordMinLength')
    };
}

function assertNewPassword(password, policy = readSignInPolicy()) {
    if (typeof password !== 'string' || [...password].length < policy.minPasswordLength ||
        Buffer.byteLength(password, 'utf8') > 72) {
        throw Object.assign(new Error(`Password must contain at least ${policy.minPasswordLength} characters and at most 72 UTF-8 bytes.`),
            { statusCode: 400, code: 'INVALID_PASSWORD' });
    }
}

module.exports = { readSignInPolicy, assertNewPassword };
