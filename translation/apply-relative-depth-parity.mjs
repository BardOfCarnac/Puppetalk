import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const start='async function exerciseDepthGestures(controller,stage,label){';
const end='\nasync function exerciseCoreControls(controller,label){';
const a=source.indexOf(start);
const b=source.indexOf(end,a);
if(a<0||b<0) throw new Error('Could not locate depth gesture parity seam.');
if(source.indexOf(start,a+start.length)>=0) throw new Error('Depth gesture parity seam is ambiguous.');

const replacement=[
"async function exerciseDepthGestures(controller,stage,label){",
"  await waitEval(controller,`(document.querySelector('.depth-gesture-guide')?.textContent||'').includes('3 quick taps')`,`${label} depth gesture guide`);",
"  const guide=await evaluate(controller,`(document.querySelector('.depth-gesture-guide')?.textContent||'').trim()`);",
"  const startState=await evaluate(stage,`(()=>{",
"    const api=window.PuppetalkDepthState;",
"    const tuning=window.PuppetalkForegroundTuning;",
"    if(!api||!Array.isArray(tuning?.planes))return null;",
"    const plane=api.getPlaneForSlot(0);",
"    return {plane,depth:api.getDepthForSlot(0),planes:[...tuning.planes]};",
"  })()`);",
"  if(!startState||!Number.isInteger(startState.plane))throw new Error(`${label} could not resolve starting depth plane.`);",
"  const expectedCloserPlane=Math.min(startState.plane+1,startState.planes.length-1);",
"  if(expectedCloserPlane===startState.plane)throw new Error(`${label} depth parity began at the closest plane; cannot verify +1 gesture.`);",
"  const expectedCloserDepth=startState.planes[expectedCloserPlane];",
"  const expectedAwayPlane=startState.plane;",
"  const expectedAwayDepth=startState.planes[expectedAwayPlane];",
"",
"  let point=await latestTorsoScreenPoint(controller);",
"  if(!point)throw new Error(`${label} could not resolve torso screen point for depth gesture.`);",
"",
"  const closerStart=await traceLength(controller);",
"  for(let i=0;i<3;i++){",
"    await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});",
"    await sleep(35);",
"    await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});",
"    await sleep(45);",
"  }",
"  await waitEval(controller,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart}).some(e=>e.event==='send'&&e.type==='depth-step'&&e.direction===1)`,`${label} closer depth-step`);",
"  const stageCloser=await waitEval(stage,`(()=>{",
"    const api=window.PuppetalkDepthState;",
"    if(!api)return null;",
"    const plane=api.getPlaneForSlot(0);",
"    const depth=api.getDepthForSlot(0);",
"    return plane===${expectedCloserPlane}&&Math.abs(depth-${expectedCloserDepth})<.02?{plane,depth}:null;",
"  })()`,`${label} stage one-plane closer state`,5000);",
"  const closer=await waitDepthScene(controller,closerStart,expectedCloserPlane,`Math.abs(Number(p.depth)-${expectedCloserDepth})<.02`,`${label} one-plane closer scene`,5000);",
"",
"  point=await latestTorsoScreenPoint(controller);",
"  if(!point)throw new Error(`${label} could not resolve torso screen point after moving closer.`);",
"  const awayStart=await traceLength(controller);",
"  await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});",
"  await sleep(300);",
"  await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});",
"  await waitEval(controller,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${awayStart}).some(e=>e.event==='send'&&e.type==='depth-step'&&e.direction===-1)`,`${label} away depth-step`);",
"  const stageAway=await waitEval(stage,`(()=>{",
"    const api=window.PuppetalkDepthState;",
"    if(!api)return null;",
"    const plane=api.getPlaneForSlot(0);",
"    const depth=api.getDepthForSlot(0);",
"    return plane===${expectedAwayPlane}&&Math.abs(depth-${expectedAwayDepth})<.02?{plane,depth}:null;",
"  })()`,`${label} stage one-plane away state`,5000);",
"  const away=await waitDepthScene(controller,awayStart,expectedAwayPlane,`Math.abs(Number(p.depth)-${expectedAwayDepth})<.02`,`${label} one-plane away scene`,5000);",
"",
"  return {",
"    guide,",
"    startPlane:startState.plane,",
"    closer:{direction:1,stagePlane:stageCloser.plane,plane:closer.depthPlane,step:stageCloser.plane-startState.plane,settled:Math.abs(closer.depth-expectedCloserDepth)<.02},",
"    away:{direction:-1,stagePlane:stageAway.plane,plane:away.depthPlane,step:stageAway.plane-stageCloser.plane,returned:stageAway.plane===startState.plane,settled:Math.abs(away.depth-expectedAwayDepth)<.02}",
"  };",
"}"
].join('\n');

source=source.slice(0,a)+replacement+source.slice(b);
fs.writeFileSync(path,source);
console.log('Updated depth browser parity to assert relative one-plane movement.');
