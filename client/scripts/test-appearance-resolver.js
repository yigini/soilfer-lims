/**
 * Unit Test Runner for client/src/lib/appearance.js
 */

import assert from 'node:assert';
import {
    resolveAppearance,
    isValidAppearance,
    getStoredSessionOverride,
    setStoredSessionOverride,
    clearStoredSessionOverride,
    STORAGE_KEY_SESSION_V1
} from '../src/lib/appearance.js';

console.log('🧪 Running Appearance Resolver & Storage Lifecycle Tests...');

// 1. Validation
assert.strictEqual(isValidAppearance('light'), true);
assert.strictEqual(isValidAppearance('dark'), true);
assert.strictEqual(isValidAppearance('system'), false);
assert.strictEqual(isValidAppearance(''), false);
assert.strictEqual(isValidAppearance(null), false);
assert.strictEqual(isValidAppearance(undefined), false);
console.log('  ✓ isValidAppearance validates strictly light and dark only.');

// 2. Precedence: Default is light
{
    const res = resolveAppearance();
    assert.strictEqual(res.appearance, 'light');
    assert.strictEqual(res.source, 'default');
}
{
    const res = resolveAppearance({ authenticated: false, savedPreference: null, sessionOverride: null });
    assert.strictEqual(res.appearance, 'light');
    assert.strictEqual(res.source, 'default');
}
console.log('  ✓ Default everywhere is light.');

// 3. Precedence: Anonymous session override
{
    const res = resolveAppearance({ authenticated: false, savedPreference: null, sessionOverride: 'dark' });
    assert.strictEqual(res.appearance, 'dark');
    assert.strictEqual(res.source, 'session');
}
console.log('  ✓ Anonymous session override works.');

// 4. Precedence: Authenticated saved preference applies when no session override
{
    const res = resolveAppearance({ authenticated: true, savedPreference: 'dark', sessionOverride: null });
    assert.strictEqual(res.appearance, 'dark');
    assert.strictEqual(res.source, 'saved');
}
console.log('  ✓ Authenticated saved preference applies without session override.');

// 5. Precedence: Session override beats saved preference
{
    const res = resolveAppearance({ authenticated: true, savedPreference: 'dark', sessionOverride: 'light' });
    assert.strictEqual(res.appearance, 'light');
    assert.strictEqual(res.source, 'session');
}
{
    const res = resolveAppearance({ authenticated: true, savedPreference: 'light', sessionOverride: 'dark' });
    assert.strictEqual(res.appearance, 'dark');
    assert.strictEqual(res.source, 'session');
}
console.log('  ✓ Session override beats saved preference for current tab.');

// 6. Precedence: Unauthenticated cannot use savedPreference
{
    const res = resolveAppearance({ authenticated: false, savedPreference: 'dark', sessionOverride: null });
    assert.strictEqual(res.appearance, 'light');
    assert.strictEqual(res.source, 'default');
}
console.log('  ✓ Unauthenticated requests cannot inherit saved preferences.');

// 7. Precedence: Invalid / legacy values fallback safely to light
{
    const res = resolveAppearance({ authenticated: true, savedPreference: 'system', sessionOverride: 'blue' });
    assert.strictEqual(res.appearance, 'light');
    assert.strictEqual(res.source, 'default');
}
console.log('  ✓ Invalid / legacy values safely resolve to default light.');

// 8. Memory Storage Fallback Lifecycle
{
    // Test memory storage when window.sessionStorage is undefined (Node environment)
    clearStoredSessionOverride();
    assert.strictEqual(getStoredSessionOverride('user-1'), null);

    setStoredSessionOverride('user-1', 'dark');
    assert.strictEqual(getStoredSessionOverride('user-1'), 'dark');

    // Mismatched user should get null and purge
    assert.strictEqual(getStoredSessionOverride('user-2'), null);
    assert.strictEqual(getStoredSessionOverride('user-1'), null);

    // Re-set and clear
    setStoredSessionOverride('user-1', 'light');
    assert.strictEqual(getStoredSessionOverride('user-1'), 'light');
    clearStoredSessionOverride();
    assert.strictEqual(getStoredSessionOverride('user-1'), null);
}
console.log('  ✓ In-memory session override storage lifecycle and subject-id scoping verified.');

console.log('🎉 All 8 appearance resolver test cases passed successfully!\n');
