import fs from 'node:fs';
const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const oldBlock=[
"  const stageCloser=await waitEval(stage,`(()=>{",
"    const api=window.PuppetalkDepthState;",
"    if(!api)return null;",
"    const plane=api.getPlaneForSlot(0);",
"    const depth=api.getDepthForSlot(0);",
"    return plane===${expectedCloserPlane}&&Math.abs(depth-${expectedCloserDepth})<.02?{plane,depth}:null;",
"  })()`,`${label} stage one-plane closer state`,5000);"
].join('\n');
const newBlock=[
"  let stageCloser;",
"  try{",
"    stageCloser=await waitEval(stage,`(()=>{",
"      const api=window.PuppetalkDepthState;",
"      if(!api)return null;",
"      const plane=api.getPlaneForSlot(0);",
"      const depth=api.getDepthForSlot(0);",
"      return plane===${expectedCloserPlane}&&Math.abs(depth-${expectedCloserDepth})<.02?{plane,depth}:null;",
"    })()`,`${label} stage one-plane closer state`,5000);",
"  }catch(error){",
"    const actual=await evaluate(stage,`(()=>{",
"      const api=window.PuppetalkDepthState;",
"      return api?{plane:api.getPlaneForSlot(0),depth:api.getDepthForSlot(0)}:null;",
"    })()`);",
"    const stageSteps=await evaluate(stage,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart}).filter(e=>e.event==='recv'&&e.type==='depth-step').map(e=>({at:e.at,direction:e.direction,foregroundSlot:e.foregroundSlot}))`);",
"    const controllerSteps=await evaluate(controller,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart}).filter(e=>e.event==='send'&&e.type==='depth-step').map(e=>({at:e.at,direction:e.direction}))`);",
"    throw new Error(`${error.message}\\n${label} relative-depth diagnostics: ${JSON.stringify({startState,expectedCloserPlane,expectedCloserDepth,actual,controllerSteps,stageSteps},null,2)}`);",
"  }"
].join('\n');
const at=source.indexOf(oldBlock);
if(at<0) throw new Error('Missing relative depth stageCloser anchor.');
if(source.indexOf(oldBlock,at+oldBlock.length)>=0) throw new Error('Ambiguous relative depth stageCloser anchor.');
source=source.slice(0,at)+newBlock+source.slice(at+oldBlock.length);
fs.writeFileSync(path,source);
console.log('Added relative depth transition diagnostics.');
