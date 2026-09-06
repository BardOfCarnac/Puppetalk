import fs from 'node:fs';
const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const oldLine="  const closer=await waitDepthScene(controller,closerStart,stageCloser.plane,`Math.abs(Number(p.depth)-${stageCloser.target})<.02`,`${label} mature closer scene`,5000);";
const replacement=[
"  let closer;",
"  try{",
"    closer=await waitDepthScene(controller,closerStart,stageCloser.plane,`Math.abs(Number(p.depth)-${stageCloser.target})<.02`,`${label} mature closer scene`,5000);",
"  }catch(error){",
"    const recent=await evaluate(controller,`(()=>{",
"      const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart}).filter(e=>e.event==='recv'&&e.type==='scene'&&e.scene);",
"      return entries.slice(-20).map(e=>({at:e.at,puppet:e.scene.puppets?.find(p=>p.slot===0)||null}));",
"    })()`);",
"    throw new Error(`${error.message}\\n${label} mature closer scene diagnostics: ${JSON.stringify({stageCloser,recent},null,2)}`);",
"  }"
].join('\n');
const at=source.indexOf(oldLine);
if(at<0) throw new Error('Missing mature closer scene anchor.');
if(source.indexOf(oldLine,at+oldLine.length)>=0) throw new Error('Ambiguous mature closer scene anchor.');
source=source.slice(0,at)+replacement+source.slice(at+oldLine.length);
fs.writeFileSync(path,source);
console.log('Instrumented mature depth scene packets for this runner.');
