'use strict';
// Evaluate the ENTIRE byte-bound controller without changing its source.
// Inert non-crypto imports prevent app/Prisma/network initialization. Only the
// unpatched computeEvidenceFingerprint function is invoked, with synthetic data.
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const path = require('path');
const sourcePath = path.join(__dirname, 'application-source-fixtures/server/controllers/koboController.js');
const source = fs.readFileSync(sourcePath);
const commonModule = {exports: {}};
const context = vm.createContext({module: commonModule, exports: commonModule.exports, require: (name) => {
  if (name === 'crypto') return crypto;
  if (!['../prisma','../services/koboService','../services/projectPolicyService','../workflowContract','../services/profileIdentityService','../services/koboProfileService','../services/sampleStateService'].includes(name)) throw Error('Unexpected module initialization');
  return Object.freeze({});
}});
new vm.Script(source.toString('utf8'), {filename: sourcePath}).runInContext(context, {timeout: 5000});
const value = new vm.Script(`computeEvidenceFingerprint({lat:-1.25,lng:2.5,depth:'D1',site_id:'SYNTHETIC',collected_at:'2026-01-01'}, [], {_attachments:[]})`).runInContext(context, {timeout: 5000});
if (!/^[a-f0-9]{16}$/.test(value)) throw Error('Bound writer fingerprint format differs');
process.stdout.write(JSON.stringify({sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),function:'computeEvidenceFingerprint',fingerprint:value,sourceUnpatched:true,nonCryptoImportsInert:true})+'\n');
