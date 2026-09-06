import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} marker.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} marker.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

const tickProbe=[
  '',
  "const stageTickProbeSource=String.raw`(()=>{",
  "  if(window.__PUPPETALK_PARITY_STAGE_TICK_PROBE__)return;",
  "  window.__PUPPETALK_PARITY_STAGE_TICK_PROBE__=true;",
  "  const raw=requestAnimationFrame.bind(window);",
  "  window.requestAnimationFrame=function(callback){",
  "    if(typeof callback==='function'&&callback.name==='tick') window.__PUPPETALK_PARITY_STAGE_TICK__=callback;",
  "    return raw(callback);",
  "  };",
  "})();`;"
].join('\n');
replaceOnce(
  'stage tick probe declaration',
  '\nclass Cdp{',
  tickProbe+'\n\nclass Cdp{'
);

replaceOnce(
  'stage probe injection',
  "  if(stageProbe)await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:stageWalkingProbeSource});",
  [
    "  if(stageProbe){",
    "    await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:stageWalkingProbeSource});",
    "    await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:stageTickProbeSource});",
    "  }"
  ].join('\n')
);

replaceOnce(
  'walking probe readiness',
  "async function installStageWalkingProbe(stage,label){\n  await waitEval(stage,`!!window.__PUPPETALK_PARITY_ENGINE__`,`${label} stage walking engine`,4000);\n}",
  [
    'async function installStageWalkingProbe(stage,label){',
    "  await waitEval(stage,`!!window.__PUPPETALK_PARITY_ENGINE__&&typeof window.__PUPPETALK_PARITY_STAGE_TICK__==='function'`,`${label} stage walking frame`,4000);",
    '}',
    'async function advanceStageFrame(stage){',
    "  return evaluate(stage,`(()=>{const tick=window.__PUPPETALK_PARITY_STAGE_TICK__;if(typeof tick!=='function')return false;tick(performance.now());return true;})()`);",
    '}'
  ].join('\n')
);

replaceOnce(
  'walking press frame',
  [
    "  await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:sx,y:sy,button:'left',buttons:1,clickCount:1});",
    "  const down=await waitInput(controller,traceStart,\"e.input.grabs?.some(g=>g.part==='torso')\",`${label} walking torso press`);",
    "  const downGrab=(down.grabs||[]).find(g=>g.part==='torso');"
  ].join('\n'),
  [
    '  const stageDownStart=await traceLength(stage);',
    "  await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:sx,y:sy,button:'left',buttons:1,clickCount:1});",
    "  const down=await waitInput(controller,traceStart,\"e.input.grabs?.some(g=>g.part==='torso')\",`${label} walking torso press`);",
    "  await waitEval(stage,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${stageDownStart}).some(e=>e.event==='recv'&&e.type==='input'&&e.input?.grabs?.some(g=>g.part==='torso'))`,`${label} walking torso press at stage`);",
    '  await advanceStageFrame(stage);',
    "  const downGrab=(down.grabs||[]).find(g=>g.part==='torso');"
  ].join('\n')
);

replaceOnce(
  'walking move loop',
  [
    '    const moveStart=await traceLength(controller);',
    "    await controller.call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y:sy,button:'left',buttons:1});",
    "    const moved=await waitInput(controller,moveStart,\"e.input.grabs?.some(g=>g.part==='torso')\",`${label} walking torso move ${i}`);",
    "    moveGrab=(moved.grabs||[]).find(g=>g.part==='torso');",
    '    await sleep(65);',
    '    const sample=await stageWalkingState(stage);'
  ].join('\n'),
  [
    '    const moveStart=await traceLength(controller);',
    '    const stageMoveStart=await traceLength(stage);',
    "    await controller.call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y:sy,button:'left',buttons:1});",
    "    const moved=await waitInput(controller,moveStart,\"e.input.grabs?.some(g=>g.part==='torso')\",`${label} walking torso move ${i}`);",
    "    await waitEval(stage,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${stageMoveStart}).some(e=>e.event==='recv'&&e.type==='input'&&e.input?.grabs?.some(g=>g.part==='torso'))`,`${label} walking torso move ${i} at stage`);",
    "    moveGrab=(moved.grabs||[]).find(g=>g.part==='torso');",
    '    await advanceStageFrame(stage);',
    '    await sleep(65);',
    '    await advanceStageFrame(stage);',
    '    const sample=await stageWalkingState(stage);'
  ].join('\n')
);

replaceOnce(
  'walking held settle loop',
  [
    '  for(let i=0;i<9;i++){',
    '    await sleep(60);',
    '    const sample=await stageWalkingState(stage);',
    '    if(sample)samples.push(sample);',
    '  }',
    '  const releaseStart=await traceLength(controller);'
  ].join('\n'),
  [
    '  for(let i=0;i<9;i++){',
    '    await advanceStageFrame(stage);',
    '    await sleep(60);',
    '    await advanceStageFrame(stage);',
    '    const sample=await stageWalkingState(stage);',
    '    if(sample)samples.push(sample);',
    '  }',
    '  const releaseStart=await traceLength(controller);',
    '  const stageReleaseStart=await traceLength(stage);'
  ].join('\n')
);

replaceOnce(
  'walking release frames',
  [
    "  await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:targetX,y:sy,button:'left',buttons:0,clickCount:1});",
    "  await waitInput(controller,releaseStart,\"e.input.grabs?.length===0\",`${label} walking torso release`);",
    '  for(let i=0;i<5;i++){',
    '    await sleep(60);',
    '    const sample=await stageWalkingState(stage);'
  ].join('\n'),
  [
    "  await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:targetX,y:sy,button:'left',buttons:0,clickCount:1});",
    "  await waitInput(controller,releaseStart,\"e.input.grabs?.length===0\",`${label} walking torso release`);",
    "  await waitEval(stage,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${stageReleaseStart}).some(e=>e.event==='recv'&&e.type==='input'&&e.input?.grabs?.length===0)`,`${label} walking torso release at stage`);",
    '  for(let i=0;i<5;i++){',
    '    await advanceStageFrame(stage);',
    '    await sleep(60);',
    '    await advanceStageFrame(stage);',
    '    const sample=await stageWalkingState(stage);'
  ].join('\n')
);

fs.writeFileSync(path,source);
console.log('Walking parity now advances complete Puppetalk stage frames deterministically.');
