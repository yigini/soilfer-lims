// Read-only evidence collection. This never invokes the production coordinator.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto');
const [rootArg, reviewId] = process.argv.slice(2);
if (!rootArg || !/^\d+$/.test(reviewId || '')) throw Error('Require frozen kit root and exact Claudio review comment id');
const root = path.resolve(rootArg), repo = 'yigini/soilfer-lims';
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'prepared-manifest.json'), 'utf8'));
if (manifest.status !== 'PREPARED_ONLY_NOT_EXECUTED') throw Error('Kit is not prepared');
for (const [name, expected] of Object.entries(manifest.files)) {
  const file = path.join(root, name);
  if (path.basename(name) !== name || fs.lstatSync(file).isSymbolicLink() || digest(file) !== expected) {
    throw Error('Prepared file changed: ' + name);
  }
}
const api = args => JSON.parse(cp.execFileSync('gh', args, {encoding:'utf8', maxBuffer:16*1024*1024}));
const issue = api(['api', `repos/${repo}/issues/162`]);
const comments = [];
for (let page=1; comments.length < issue.comments; page++) {
  const batch = api(['api', `repos/${repo}/issues/162/comments?per_page=100&page=${page}`]);
  if (!batch.length) break;
  comments.push(...batch);
}
const review = comments.find(row => String(row.id) === reviewId);
const hashes = [digest(path.join(root,'prepared-manifest.json')),
  manifest.files['release-forward.py'], manifest.files['rehearsal-receipt.json']];
const phrase = 'Audit passed: OK to merge and deploy';
if (!review || !review.body.includes(phrase) || !review.body.includes(manifest.head)
    || !hashes.every(value => review.body.includes(value))
    || !review.body.includes(manifest.attemptPlanSha256)) throw Error('No exact-head/hash/row-plan kit pass');
if (comments.some(row => row.created_at > review.created_at && row.body.includes('Audit failed')
    && row.body.includes(manifest.head))) throw Error('A later kit audit failed');
// Require an explicit current-kit workload pin rather than infer a new quiet window.
if (!review.body.includes('labAndHubBuildsOwnedByYY=true')
    || !review.body.includes('RELEASE_DAY_DISK_ABORTS_ACCEPTED')) throw Error('Current-kit workload pin is missing');
const target = path.join(root, 'production-gate.json');
const snapshot = path.join(root, 'pr-gates-fresh-' + Date.now() + '.json');
if (fs.existsSync(target)) throw Error('Never replace an execution gate');
cp.execFileSync(process.execPath, [path.join(root,'collect-gates.cjs'), snapshot], {stdio:'pipe'});
const prGates = JSON.parse(fs.readFileSync(snapshot,'utf8'));
if (prGates.head !== manifest.head || prGates.ungatedPrs.length
    || prGates.includedPrCount !== 20) throw Error('PR gate refused');
const evidenceSha = manifest.files['yy-authorization-evidence.md'];
const gate = {head:manifest.head, image:manifest.image, manifestSha256:hashes[0],
  coordinatorSha256:hashes[1], rehearsalReceiptSha256:hashes[2],
  verifiedUtc:prGates.collectedUtc, prGates,
  kitReview:{issue:162, reviewedBy:'Claudio', url:review.html_url, body:review.body,
    timeUtc:review.created_at, approvedAttemptPlanSha256:manifest.attemptPlanSha256},
  yyGo:{confirmedByYY:true, source:'CLAUDE_LIMS_AUDIT_THREAD', authorizationMode:'AUTO_AFTER_REVIEW',
    text:'Auto after review', timeUtc:'2026-10-10T15:55:35Z', evidenceSha256:evidenceSha,
    scopeDecision:'Main now', scopeHead:manifest.head, scopeEvidenceSha256:evidenceSha},
  workloadControl:{labAndHubBuildsOwnedByYY:true, releaseWindowControl:'RELEASE_DAY_DISK_ABORTS_ACCEPTED',
    commentId:review.id, sourceUrl:review.html_url}};
fs.writeFileSync(target, JSON.stringify(gate,null,2)+'\n', {flag:'wx', mode:0o400});
console.log(JSON.stringify({status:'EVIDENCE_ONLY_NOT_EXECUTED', head:gate.head,
  gateSha256:digest(target), file:target, reviewUrl:review.html_url}));
