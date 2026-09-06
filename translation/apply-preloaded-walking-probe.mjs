import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} marker.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} marker.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

const preload=fs.readFileSync('translation/preload-stage-walking-probe.txt','utf8').trimEnd();
replaceOnce('Cdp class insertion','class Cdp{',`const stageWalkingProbeSource=${JSON.stringify(preload)};\n\nclass Cdp{`);
replaceOnce('target signature','async function target(url){','async function target(url,{stageProbe=false}={}){');
replaceOnce(
  'target preload hook',
  "  await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:fakePeerSource});\n  await cdp.call('Page.navigate',{url});",
  "  await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:fakePeerSource});\n  if(stageProbe)await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:stageWalkingProbeSource});\n  await cdp.call('Page.navigate',{url});"
);
const probeStart='async function installStageWalkingProbe(stage,label){';
const probeEnd='\nasync function stageWalkingState(stage){';
const a=source.indexOf(probeStart);
const b=source.indexOf(probeEnd,a);
if(a<0||b<0) throw new Error('Could not locate stage walking probe function.');
if(source.indexOf(probeStart,a+probeStart.length)>=0) throw new Error('Stage walking probe function is ambiguous.');
const replacement="async function installStageWalkingProbe(stage,label){\n  await waitEval(stage,`!!window.__PUPPETALK_PARITY_ENGINE__`,`${label} stage walking engine`,4000);\n}";
source=source.slice(0,a)+replacement+source.slice(b);
replaceOnce(
  'live stage target',
  "  const stage=await target(`${base}${prefix}?mode=stage&room=${room}&lobby=done&embedded=1`);",
  "  const stage=await target(`${base}${prefix}?mode=stage&room=${room}&lobby=done&embedded=1`,{stageProbe:true});"
);

fs.writeFileSync(path,source);
console.log('Preloaded stage walking engine probe before Matter initialization.');
