import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s.endsWith('\n')?s:`${s}\n`,'utf8');

function replaceOnce(text,label,from,to){
  const i=text.indexOf(from);
  if(i<0) throw new Error(`Missing ${label} marker.`);
  if(text.indexOf(from,i+from.length)>=0) throw new Error(`${label} marker matched more than once.`);
  return text.slice(0,i)+to+text.slice(i+from.length);
}
function insertAfter(text,label,marker,addition){
  if(text.includes(addition.trim())) return text;
  return replaceOnce(text,label,marker,marker+addition);
}

let build=read('translation/build-runtime.mjs');
const oldSetup=`replaceOnce(\n  'seat projection setup point',\n  \`function startController(room){\`,\n  \`const seatProjection = window.PuppetalkSeatProjection?.create?.({\n  getDepthState:()=>window.PuppetalkDepthState,\n  getForegroundTuning:()=>window.PuppetalkForegroundTuning\n});\nif(!seatProjection) throw new Error('Puppetalk seat projection failed to load.');\nconst {puppetalkSeatProjection} = seatProjection;\n\nfunction startController(room){\`\n);`;
const fixedSetup=`replaceOnce(\n  'seat projection setup point',\n  \`if(mode === 'controller') startController(room);\`,\n  \`const seatProjection = window.PuppetalkSeatProjection?.create?.({\n  getDepthState:()=>window.PuppetalkDepthState,\n  getForegroundTuning:()=>window.PuppetalkForegroundTuning\n});\nif(!seatProjection) throw new Error('Puppetalk seat projection failed to load.');\nconst {puppetalkSeatProjection} = seatProjection;\n\nif(mode === 'controller') startController(room);\`\n);`;
if(build.includes(oldSetup)) build=replaceOnce(build,'seat projection bootstrap setup',oldSetup,fixedSetup);
else if(!build.includes(fixedSetup)) throw new Error('Missing seat projection setup block.');
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const projectionBinding="assert.match(actual,/const \\{puppetalkSeatProjection\\} = seatProjection;/,'Runtime callers are not bound to extracted seat projection.');\n";
const ordering="const seatProjectionBindingIndex=actual.indexOf('const seatProjection = window.PuppetalkSeatProjection');\nconst controllerDispatchIndex=actual.indexOf(\"if(mode === 'controller') startController(room);\");\nassert.ok(seatProjectionBindingIndex>=0 && controllerDispatchIndex>=0 && seatProjectionBindingIndex<controllerDispatchIndex,'Seat projection must be initialized before early controller dispatch.');\n";
if(!parity.includes('Seat projection must be initialized before early controller dispatch.')) parity=insertAfter(parity,'seat projection bootstrap ordering assertion',projectionBinding,ordering);
write('translation/runtime-parity-smoke.mjs',parity);

console.log('Prepared seat projection bootstrap-order correction.');
