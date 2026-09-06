import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const from="  const controls=await exerciseCoreControls(controller,label);\n  const depth=await exerciseDepthGestures(controller,stage,label);";
const to="  // Run depth first on a fresh connected puppet. The mature controller's torso\n  // interactions can leave gesture-derived sends in flight, so ordering this\n  // contract first prevents cross-test contamination without changing behavior.\n  const depth=await exerciseDepthGestures(controller,stage,label);\n  const controls=await exerciseCoreControls(controller,label);";
const first=source.indexOf(from);
if(first<0) throw new Error('Missing live-session depth/core ordering anchor.');
if(source.indexOf(from,first+from.length)>=0) throw new Error('Ambiguous live-session depth/core ordering anchor.');
source=source.slice(0,first)+to+source.slice(first+from.length);
fs.writeFileSync(path,source);
console.log('Moved depth parity ahead of torso-control parity to isolate gesture state.');
