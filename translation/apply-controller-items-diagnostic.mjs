import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

const probeMarker='const stageWalkingProbeSource=';
const probe=`const controllerItemsProbeSource=String.raw\`(()=>{\n  let value;\n  Object.defineProperty(window,'PuppetalkControllerItems',{\n    configurable:true,enumerable:true,\n    get(){return value;},\n    set(next){\n      if(next?.create&&typeof next.create==='function'&&!next.create.__puppetalkParityProbe){\n        const raw=next.create;\n        const wrapped=function(...args){\n          const instance=raw.apply(this,args);\n          window.__PUPPETALK_PARITY_ITEMS__=instance;\n          return instance;\n        };\n        wrapped.__puppetalkParityProbe=true;\n        next={...next,create:wrapped};\n      }\n      value=next;\n    }\n  });\n})();\`;\n\n`;
if(!source.includes(probeMarker))throw new Error('Missing controller items probe insertion marker.');
source=source.replace(probeMarker,probe+probeMarker);

const targetFrom=`  await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:fakePeerSource});\n  if(stageProbe)await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:stageWalkingProbeSource});`;
const targetTo=`  await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:fakePeerSource});\n  await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:controllerItemsProbeSource});\n  if(stageProbe)await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:stageWalkingProbeSource});`;
if(!source.includes(targetFrom))throw new Error('Missing target injection marker.');
source=source.replace(targetFrom,targetTo);

const loopFrom=`  let pickupSend=null;\n  for(let attempt=0;attempt<4&&!pickupSend;attempt++){\n    const geometry=await latestPropAndCanvas(controller,propId);`;
const loopTo=`  let pickupSend=null;\n  let lastPickupGeometry=null;\n  for(let attempt=0;attempt<4&&!pickupSend;attempt++){\n    const geometry=await latestPropAndCanvas(controller,propId);\n    lastPickupGeometry=geometry;`;
if(!source.includes(loopFrom))throw new Error('Missing pickup retry loop marker.');
source=source.replace(loopFrom,loopTo);

const failFrom="  if(!pickupSend)throw new Error(`${label} frisbee pickup command was not emitted after refreshed moving-prop clicks.`);";
const failTo=`  if(!pickupSend){\n    const diagnostic=await evaluate(controller,\`(()=>{\n      const api=window.__PUPPETALK_PARITY_ITEMS__;\n      const event={clientX:\${Number(lastPickupGeometry?.point?.x)},clientY:\${Number(lastPickupGeometry?.point?.y)}};\n      if(!api)return {api:false,event};\n      const picked=api.pickTappedProp?.(event)||null;\n      const hand=picked?api.nearestPropHand?.(picked)||null:null;\n      return {\n        api:true,event,hand,\n        picked:picked?{id:picked.id,type:picked.type,x:Number(picked.x),y:Number(picked.y),heldBy:picked.heldBy||null}:null,\n        lastGeometry:\${JSON.stringify(lastPickupGeometry)}\n      };\n    })()\`);\n    throw new Error(\`\${label} frisbee pickup command was not emitted after refreshed moving-prop clicks. DIAGNOSTIC \${JSON.stringify(diagnostic)}\`);\n  }`;
if(!source.includes(failFrom))throw new Error('Missing pickup failure marker.');
source=source.replace(failFrom,failTo);

fs.writeFileSync(path,source);
console.log('Added non-invasive controller item hit-test diagnostics to live parity.');
