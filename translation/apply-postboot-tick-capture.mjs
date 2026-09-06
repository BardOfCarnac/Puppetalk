import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} marker.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} marker.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

const tickStart='const stageTickProbeSource=String.raw`(()=>{';
const tickEnd='\n\nclass Cdp{';
const a=source.indexOf(tickStart);
const b=source.indexOf(tickEnd,a);
if(a<0||b<0) throw new Error('Could not locate preboot tick probe.');
source=source.slice(0,a)+source.slice(b+2);

replaceOnce(
  'stage preboot injection',
  [
    '  if(stageProbe){',
    "    await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:stageWalkingProbeSource});",
    "    await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:stageTickProbeSource});",
    '  }'
  ].join('\n'),
  "  if(stageProbe)await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:stageWalkingProbeSource});"
);

replaceOnce(
  'walking probe install',
  [
    'async function installStageWalkingProbe(stage,label){',
    "  await waitEval(stage,`!!window.__PUPPETALK_PARITY_ENGINE__&&typeof window.__PUPPETALK_PARITY_STAGE_TICK__==='function'`,`${label} stage walking frame`,4000);",
    '}'
  ].join('\n'),
  [
    'async function installStageWalkingProbe(stage,label){',
    "  await waitEval(stage,`!!window.__PUPPETALK_PARITY_ENGINE__`,`${label} stage walking engine`,4000);",
    '  await evaluate(stage,`(()=>{',
    "    if(typeof window.__PUPPETALK_PARITY_STAGE_TICK__==='function')return true;",
    '    if(window.__PUPPETALK_PARITY_STAGE_TICK_CAPTURE__)return true;',
    '    window.__PUPPETALK_PARITY_STAGE_TICK_CAPTURE__=true;',
    '    const raw=window.requestAnimationFrame;',
    '    window.requestAnimationFrame=function(callback){',
    "      if(typeof callback==='function'&&callback.name==='tick'){",
    '        window.__PUPPETALK_PARITY_STAGE_TICK__=callback;',
    '        window.requestAnimationFrame=raw;',
    '      }',
    '      return raw.call(window,callback);',
    '    };',
    '    return true;',
    '  })()`);',
    "  await stage.call('Page.bringToFront');",
    "  await waitEval(stage,`typeof window.__PUPPETALK_PARITY_STAGE_TICK__==='function'`,`${label} stage walking frame`,4000);",
    '}'
  ].join('\n')
);

fs.writeFileSync(path,source);
console.log('Walking parity captures the stage tick only after stage boot.');
