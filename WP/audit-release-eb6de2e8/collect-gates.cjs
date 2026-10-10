// Read-only GitHub/git evidence. This does not grant production authorization.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const exec = promisify(cp.execFile);
const HEAD = '042c04b54e7b3baa9f8c95e7f8d70b39daed2f91';
const PRS = [258,257,259,260,263,264,265,266,267,268,269,273,271,276,275,280,282,285,286,287];
const phrase = 'Audit passed: OK to merge and deploy';

async function main() {
  const target = process.argv[2];
  if (!target || fs.existsSync(target)) throw Error('Provide a fresh evidence filename');
  const rows = [];
  for (let offset=0; offset<PRS.length; offset+=3) {
    const batch = await Promise.allSettled(PRS.slice(offset,offset+3).map(async number => {
      const { stdout } = await exec('gh', ['pr','view',String(number),'--repo','yigini/soilfer-lims',
        '--json','number,title,state,headRefOid,mergeCommit,mergedAt,baseRefName,statusCheckRollup,comments'],
        {maxBuffer: 8*1024*1024});
      const pr = JSON.parse(stdout);
      await exec('git',['merge-base','--is-ancestor',pr.mergeCommit.oid,HEAD]);
      const passes = pr.comments.filter(comment => comment.body.includes(phrase)
        && (comment.body.includes(pr.headRefOid) || comment.body.includes(pr.headRefOid.slice(0,7))));
      const pass = passes.at(-1);
      const laterFailure = pass && pr.comments.some(comment => comment.createdAt > pass.createdAt
        && comment.body.includes('Audit failed'));
      const checks = pr.statusCheckRollup.filter(check => check.name === 'Test & Build');
      return {number, title:pr.title, state:pr.state, head:pr.headRefOid,
        mergeSha:pr.mergeCommit.oid, mergedAt:pr.mergedAt, base:pr.baseRefName,
        auditPass: pass ? {url:pass.url, createdAt:pass.createdAt, body:pass.body} : null,
        laterAuditFailure: Boolean(laterFailure), checks,
        gated:pr.state==='MERGED' && pr.baseRefName==='main' && Boolean(pass) && !laterFailure
          && checks.length>0 && checks.every(check=>check.conclusion==='SUCCESS')};
    }));
    for (let index=0; index<batch.length; index++) {
      const row = batch[index];
      if (row.status==='rejected') throw Error('PR '+PRS[offset+index]+': '+row.reason);
      rows.push(row.value);
    }
  }
  const {stdout} = await exec('gh',['run','list','--repo','yigini/soilfer-lims','--branch','main',
    '--commit',HEAD,'--json','databaseId,name,status,conclusion,headSha,url']);
  const evidence = {status:'READ_ONLY_GATE_SNAPSHOT_NOT_DEPLOY_AUTHORIZATION',
    head:HEAD, collectedUtc:new Date().toISOString(), prs:rows, mainCi:JSON.parse(stdout),
    includedPrCount:rows.length, ungatedPrs:rows.filter(row=>!row.gated).map(row=>row.number)};
  fs.writeFileSync(target, JSON.stringify(evidence,null,2)+'\n', {flag:'wx'});
  console.log(JSON.stringify({file:path.resolve(target), sha256:crypto.createHash('sha256')
    .update(fs.readFileSync(target)).digest('hex'), count:rows.length,
    ungatedPrs:evidence.ungatedPrs, mainCi:evidence.mainCi}));
}
main().catch(error=>{console.error(error.message); process.exitCode=1;});
