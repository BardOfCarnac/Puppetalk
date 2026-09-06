import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const from="async function advanceStageFrame(stage){\n  return evaluate(stage,`(()=>{const tick=window.__PUPPETALK_PARITY_STAGE_TICK__;if(typeof tick!=='function')return false;tick(performance.now());return true;})()`);\n}";
const to="async function advanceStageFrame(stage){\n  return evaluate(stage,`(()=>{\n    const tick=window.__PUPPETALK_PARITY_STAGE_TICK__;\n    if(typeof tick!=='function')return false;\n    const raw=window.requestAnimationFrame;\n    window.requestAnimationFrame=()=>0;\n    try{tick(performance.now());}\n    finally{window.requestAnimationFrame=raw;}\n    return true;\n  })()`);\n}";
const first=source.indexOf(from);
if(first<0)throw new Error('Missing advanceStageFrame marker.');
if(source.indexOf(from,first+from.length)>=0)throw new Error('Ambiguous advanceStageFrame marker.');
source=source.slice(0,first)+to+source.slice(first+from.length);
fs.writeFileSync(path,source);
console.log('Forced walking frames no longer schedule duplicate stage loops.');
