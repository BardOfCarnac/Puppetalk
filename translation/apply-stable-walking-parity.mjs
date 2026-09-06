import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} marker.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} marker.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

replaceOnce(
  'Chrome background throttle flags',
  "  '--headless','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,",
  "  '--headless','--no-sandbox','--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',`--remote-debugging-port=${port}`,"
);
replaceOnce(
  'walking down raw grab',
  "  const downGrab=normalizeInput(down).grabs.find(g=>g.part==='torso');",
  "  const downGrab=(down.grabs||[]).find(g=>g.part==='torso');"
);
replaceOnce(
  'walking move raw grab',
  "    moveGrab=normalizeInput(moved).grabs.find(g=>g.part==='torso');",
  "    moveGrab=(moved.grabs||[]).find(g=>g.part==='torso');"
);
replaceOnce(
  'walking comparable normalization',
  "  const gesture=copy.controls?.pointerGrab;\n  if(gesture?.move){",
  "  const walking=copy.walking;\n  if(walking?.input) walking.input.dx=Number(Number(walking.input.dx).toFixed(2));\n  if(walking) delete walking.sample;\n  const gesture=copy.controls?.pointerGrab;\n  if(gesture?.move){"
);
replaceOnce(
  'walking behavior assertion point',
  "  if(original.reply?.type!=='frisbee'||original.reply?.ok!==true){\n    throw new Error(`Frozen V1 special-item reply shape changed unexpectedly: ${JSON.stringify(original.reply)}`);\n  }",
  "  for(const [label,state] of [['original',original],['translated',translated]]){\n    const walk=state.walking;\n    if(walk?.input?.part!=='torso'||walk.input.screenY!==true||Math.abs(Number(walk.input.dx))<.15||!walk.observed?.torsoRight||!walk.observed?.footTravel||!walk.observed?.footLift){\n      throw new Error(`${label} body-drag walking behavior was not observed: ${JSON.stringify(walk)}`);\n    }\n  }\n  if(original.reply?.type!=='frisbee'||original.reply?.ok!==true){\n    throw new Error(`Frozen V1 special-item reply shape changed unexpectedly: ${JSON.stringify(original.reply)}`);\n  }"
);

fs.writeFileSync(path,source);
console.log('Stabilized body-drag walking browser parity against background-frame throttling.');
