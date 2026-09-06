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
`  const note=(event,extra={})=>trace.push({event,...extra});`,
`  const note=(event,extra={})=>trace.push({at:performance.now(),event,...extra});`,
'fake transport timestamps'
);

replaceOnce(
`  await waitEval(controller,\`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart}).some(e=>e.event==='send'&&e.type==='depth-step'&&e.direction===1)\`,\`${label} closer depth-step\`);
  const closer=await waitDepthScene(controller,closerStart,5,\`Number(p.depth)>.005&&Number(p.visualScale)>1\`,\`${label} closer depth plane\`);`,
`  try{
    await waitEval(controller,\`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart}).some(e=>e.event==='send'&&e.type==='depth-step'&&e.direction===1)\`,\`${label} closer depth-step\`);
  }catch(error){
    const diagnostic=await evaluate(controller,\`(()=>{
      const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart});
      return entries.filter(e=>
        e.event==='send'&&(e.type==='input'||e.type==='depth-step')
      ).map(e=>({at:e.at,type:e.type,direction:e.direction,input:e.input}));
    })()\`);
    throw new Error(\`${error.message}\\n${label} depth tap diagnostics: ${JSON.stringify({point,diagnostic},null,2)}\`);
  }
  const closer=await waitDepthScene(controller,closerStart,5,\`Number(p.depth)>.005&&Number(p.visualScale)>1\`,\`${label} closer depth plane\`);`,
'closer depth diagnostics'
);

fs.writeFileSync(path,source);
console.log('Instrumented depth parity with transport timing and input diagnostics.');
