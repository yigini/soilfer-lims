const { saveDraft } = require('./draftService');

// Receipt authority is a server option, never part of an ordinary draft body.
// The existing owner rechecks the persisted receipt, line, draft and readiness.
async function commitImportedDraft(db, actor, input, importReceiptId) {
    return saveDraft(actor, input, db, { importReceiptId });
}
module.exports = { commitImportedDraft };
