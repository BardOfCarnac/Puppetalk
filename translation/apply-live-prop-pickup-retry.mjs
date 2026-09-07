import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const from=`  await waitPropScene(controller,0,propId,"!p.heldBy&&p.type==='frisbee'",\`\${label} frisbee scene\`);
  const geometry=await latestPropAndCanvas(controller,propId);
  if(!geometry)throw new Error(\`\${label} could not resolve frisbee/canvas geometry.\`);
  const px=geometry.rect.left+geometry.prop.x*geometry.rect.width;
  const py=geometry.rect.top+geometry.prop.y*geometry.rect.height;

  const pickupStart=await traceLength(controller);
  await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:px,y:py,button:'left',buttons:1,clickCount:1});
  const pickupSend=await waitEval(controller,\`(()=>{
    const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(\${pickupStart});
    const e=entries.find(e=>e.event==='send'&&e.type==='prop'&&e.action==='tap'&&e.propId===\${JSON.stringify(propId)});
    return e?{action:e.action,propId:e.propId,hand:e.hand}:null;
  })()\`,\`\${label} frisbee pickup command\`);
  await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:px,y:py,button:'left',buttons:0,clickCount:1});
`;
const to=`  await waitPropScene(controller,0,propId,"!p.heldBy&&p.type==='frisbee'",\`\${label} frisbee scene\`);

  const pickupStart=await traceLength(controller);
  let pickupSend=null;
  for(let attempt=0;attempt<4&&!pickupSend;attempt++){
    const geometry=await latestPropAndCanvas(controller,propId);
    if(!geometry)throw new Error(\`\${label} could not resolve frisbee/canvas geometry.\`);
    const px=geometry.rect.left+geometry.prop.x*geometry.rect.width;
    const py=geometry.rect.top+geometry.prop.y*geometry.rect.height;
    await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:px,y:py,button:'left',buttons:1,clickCount:1});
    await sleep(18);
    await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:px,y:py,button:'left',buttons:0,clickCount:1});
    await sleep(70);
    pickupSend=await evaluate(controller,\`(()=>{
      const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(\${pickupStart});
      const e=entries.find(e=>e.event==='send'&&e.type==='prop'&&e.action==='tap'&&e.propId===\${JSON.stringify(propId)});
      return e?{action:e.action,propId:e.propId,hand:e.hand}:null;
    })()\`);
  }
  if(!pickupSend)throw new Error(\`\${label} frisbee pickup command was not emitted after refreshed moving-prop clicks.\`);
`;
if(!source.includes(from))throw new Error('Missing single-sample frisbee pickup block.');
source=source.replace(from,to);
fs.writeFileSync(path,source);
console.log('Made live frisbee pickup parity refresh the moving prop position before retry clicks.');
