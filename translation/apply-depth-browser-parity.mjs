import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(from,to,label){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} anchor.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} anchor.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

replaceOnce(
  'async function exerciseDepthGestures(controller,label){',
  'async function exerciseDepthGestures(controller,stage,label){',
  'depth function signature'
);

const closerAnchor='  const closer=await waitDepthScene(controller,closerStart,5,`Number(p.depth)>.005&&Number(p.visualScale)>1`,`${label} closer depth plane`);';
const closerReplacement=[
  '  const stageCloser=await waitEval(stage,`(()=>{',
  '    const api=window.PuppetalkDepthState;',
  '    if(!api)return null;',
  '    const plane=api.getPlaneForSlot(0);',
  '    const depth=api.getDepthForSlot(0);',
  '    return plane===5&&depth>.005?{plane,depth}:null;',
  '  })()`,`${label} stage closer depth state`);',
  '  let closer;',
  '  try{',
  '    closer=await waitDepthScene(controller,closerStart,5,`Number(p.depth)>.005&&Number(p.visualScale)>1`,`${label} closer depth plane`);',
  '  }catch(error){',
  '    const recentScenes=await evaluate(controller,`(()=>{',
  '      const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart}).filter(e=>e.event===\'recv\'&&e.type===\'scene\'&&e.scene);',
  '      return entries.slice(-8).map(e=>({at:e.at,puppet:e.scene.puppets?.find(p=>p.slot===0)||null}));',
  '    })()`);',
  '    throw new Error(`${error.message}\\n${label} closer scene diagnostics: ${JSON.stringify({stageCloser,recentScenes},null,2)}`);',
  '  }'
].join('\n');
replaceOnce(closerAnchor,closerReplacement,'closer stage diagnostics');

const awayAnchor='  const away=await waitDepthScene(controller,awayStart,4,`Math.abs(Number(p.depth))<.02&&Math.abs(Number(p.visualScale)-1)<.04`,`${label} neutral depth plane return`,5000);';
const awayReplacement=[
  '  const stageAway=await waitEval(stage,`(()=>{',
  '    const api=window.PuppetalkDepthState;',
  '    if(!api)return null;',
  '    const plane=api.getPlaneForSlot(0);',
  '    const depth=api.getDepthForSlot(0);',
  '    return plane===4&&Math.abs(depth)<.02?{plane,depth}:null;',
  '  })()`,`${label} stage neutral depth state`,5000);',
  '  const away=await waitDepthScene(controller,awayStart,4,`Math.abs(Number(p.depth))<.02&&Math.abs(Number(p.visualScale)-1)<.04`,`${label} neutral depth plane return`,5000);'
].join('\n');
replaceOnce(awayAnchor,awayReplacement,'away stage verification');

replaceOnce(
  '    closer:{direction:1,plane:closer.depthPlane,depthPositive:closer.depth>0,scaleAboveOne:closer.visualScale>1},\n    away:{direction:-1,plane:away.depthPlane,nearNeutral:Math.abs(away.depth)<.02,scaleNearOne:Math.abs(away.visualScale-1)<.04}',
  '    closer:{direction:1,stagePlane:stageCloser.plane,plane:closer.depthPlane,depthPositive:closer.depth>0,scaleAboveOne:closer.visualScale>1},\n    away:{direction:-1,stagePlane:stageAway.plane,plane:away.depthPlane,nearNeutral:Math.abs(away.depth)<.02,scaleNearOne:Math.abs(away.visualScale-1)<.04}',
  'depth result stage planes'
);

replaceOnce(
  '  const depth=await exerciseDepthGestures(controller,label);',
  '  const depth=await exerciseDepthGestures(controller,stage,label);',
  'depth call stage argument'
);

fs.writeFileSync(path,source);
console.log('Instrumented depth parity with stage-side plane state and controller tuned-scene diagnostics.');
