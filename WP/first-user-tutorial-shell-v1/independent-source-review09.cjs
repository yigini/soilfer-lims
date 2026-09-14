// Focused execution of the current source's configuration and translator functions.
// No application edits/build, DOM, API, network, database or production access.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const base=path.resolve(__dirname,'../../client/src/tutorial');
const config=fs.readFileSync(path.join(base,'tutorialConfig.js'),'utf8');
const shell=fs.readFileSync(path.join(base,'TutorialShell.jsx'),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const result={time:new Date().toISOString(),scope:'Uncommitted source after 2a07e37. Function execution with synthetic dictionaries; not rendered UI or deployed acceptance.',sourceHashes:{config:hash(config),shell:hash(shell)},availability:[],translation:{}};
for(const [name,env,expected] of [['absent',{},false],['explicit true',{VITE_TUTORIAL_ENABLED:'true'},true],['explicit false',{VITE_TUTORIAL_ENABLED:'false'},false]]) {
  const c={env}; vm.createContext(c);
  vm.runInContext(config.replaceAll('import.meta.env','env').replace('export const TUTORIAL_CONFIG','globalThis.TUTORIAL_CONFIG').replace('export function isTutorialAvailable','function isTutorialAvailable'),c);
  assert.equal(c.TUTORIAL_CONFIG.enabled,expected);
  result.availability.push({name,enabled:c.TUTORIAL_CONFIG.enabled,pass:true});
}
const begin=shell.indexOf('const t = useMemo(() => {');
const marker='}, [dict, state?.language]);';
const end=shell.indexOf(marker,begin);
assert(begin>=0&&end>begin,'Translator source boundaries must be found');
const translator=shell.slice(begin,end+marker.length).replace('const t =','globalThis.t =');
const en=JSON.parse(fs.readFileSync(path.join(base,'locales/en.json'),'utf8'));
const fr=JSON.parse(fs.readFileSync(path.join(base,'locales/fr.json'),'utf8'));
let fallback=false;
const ctx={dict:fr,LOCALES:{en,fr},state:{language:'fr'},fallbackSeenRef:{current:new Set()},setFallbackOccurred:v=>fallback=v,setTimeout:fn=>fn(),useMemo:fn=>fn()};
vm.createContext(ctx);vm.runInContext(translator,ctx);
assert.equal(ctx.t('language'),fr.common.language);assert.equal(fallback,false);
delete fr.common.language;
const commonFallback=ctx.t('language');assert.equal(commonFallback,en.common.language);assert.equal(fallback,true);
// Injecting only into these isolated dictionaries exercises a root-key miss too.
en.syntheticRoot='English root fallback';fallback=false;
assert.equal(ctx.t('syntheticRoot'),'English root fallback');assert.equal(fallback,true);
result.translation={presentFrenchCommon:true,missingFrenchCommon:commonFallback,missingFrenchRoot:'English root fallback',noticeCallbackRaised:true,pass:true};
fs.writeFileSync(path.join(__dirname,'independent-source-review09.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
