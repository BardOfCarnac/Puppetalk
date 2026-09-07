import fs from 'node:fs';
const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const from=`  await sleep(120);
  const propInteraction=await exercisePropPickupThrow(controller,label,reply?.propId);
  const after=await controllerState(controller);
  const reply=await evaluate(controller,\`(()=>{
    const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(\${specialStart}).filter(e=>e.event==='recv'&&e.message==='Brought out Laser frisbee.');
    const e=entries[entries.length-1];
    return e?{type:e.type,propId:e.propId,ok:e.ok,message:e.message}:null;
  })()\`);
`;
const to=`  await sleep(120);
  const reply=await evaluate(controller,\`(()=>{
    const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(\${specialStart}).filter(e=>e.event==='recv'&&e.message==='Brought out Laser frisbee.');
    const e=entries[entries.length-1];
    return e?{type:e.type,propId:e.propId,ok:e.ok,message:e.message}:null;
  })()\`);
  const propInteraction=await exercisePropPickupThrow(controller,label,reply?.propId);
  const after=await controllerState(controller);
`;
if(!source.includes(from))throw new Error('Missing prop-flow ordering block.');
source=source.replace(from,to);
fs.writeFileSync(path,source);
console.log('Moved prop reply extraction before pickup/throw parity.');
