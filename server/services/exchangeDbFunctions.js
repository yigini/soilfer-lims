/**
 * Exchange Database Functions and SQLite Hook Manager
 *
 * Re-exports the unified registerDbFunctions and installSqliteHooks from exchangeStateService.
 */

const { registerDbFunctions, installSqliteHooks } = require('./exchangeStateService');

installSqliteHooks();

module.exports = {
    registerDbFunctions,
    installSqliteHooks
};
