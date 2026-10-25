const express = require('express');

// Express 5 keeps mount matchers in closures. Record mount paths while loading
// the real app, leaving the registered handlers and their execution unchanged.
function loadRegisteredRouteInventory(loadApp, { allowedDuplicateKeys = [] } = {}) {
    const mounts = new WeakMap();
    const routerUse = express.Router.prototype.use;
    const applicationUse = express.application.use;

    function recordUse(original, stackFor) {
        return function recordedUse(...args) {
            let first = args[0];
            while (Array.isArray(first) && first.length) first = first[0];
            const path = typeof first === 'function' ? '/' : args[0];
            const stack = stackFor(this);
            const start = stack.length;
            const result = original.apply(this, args);
            for (const layer of stack.slice(start)) {
                if (Array.isArray(layer.handle?.stack)) mounts.set(layer, path);
            }
            return result;
        };
    }

    express.Router.prototype.use = recordUse(routerUse, router => router.stack);
    express.application.use = recordUse(applicationUse, app => app.router.stack);
    let app;
    try {
        app = loadApp();
    } finally {
        express.Router.prototype.use = routerUse;
        express.application.use = applicationUse;
    }

    const routes = [];
    function paths(value) {
        const entries = Array.isArray(value) ? value.flat(Infinity) : [value];
        if (!entries.length || entries.some(entry => typeof entry !== 'string')) {
            throw new Error('Route inventory needs an explicit string path for every mount and route.');
        }
        return entries;
    }
    function join(prefix, suffix) {
        return (prefix.replace(/\/$/, '') + '/' + suffix.replace(/^\//, '')).replace(/\/$/, '') || '/';
    }
    function visit(stack, prefix) {
        for (const layer of stack) {
            if (layer.route) {
                const methods = Object.entries(layer.route.methods)
                    .filter(([, enabled]) => enabled).map(([method]) => method.toUpperCase());
                for (const path of paths(layer.route.path)) {
                    for (const method of methods) {
                        const fullPath = join(prefix, path);
                        routes.push({ method, path: fullPath, key: `${method} ${fullPath}` });
                    }
                }
            } else if (Array.isArray(layer.handle?.stack)) {
                if (!mounts.has(layer)) throw new Error('A registered router was loaded without its mount path.');
                for (const mount of paths(mounts.get(layer))) visit(layer.handle.stack, join(prefix, mount));
            }
        }
    }
    visit(app.router.stack, '');
    const seen = new Map();
    const allowedDuplicates = new Set(allowedDuplicateKeys);
    for (const route of routes) {
        route.registration = (seen.get(route.key) || 0) + 1;
        seen.set(route.key, route.registration);
        if (route.registration > 1 && !allowedDuplicates.has(route.key)) {
            throw new Error(`Duplicate registered route needs explicit coverage: ${route.key}`);
        }
    }
    for (const key of allowedDuplicates) {
        if ((seen.get(key) || 0) < 2) throw new Error(`Obsolete duplicate-route declaration: ${key}`);
    }
    return { app, routes: routes.sort((a, b) => a.key.localeCompare(b.key)) };
}

module.exports = { loadRegisteredRouteInventory };
