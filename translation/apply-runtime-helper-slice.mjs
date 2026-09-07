import fs from 'node:fs';

function replaceOnce(source,label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label}.`);
  if(source.indexOf(from,first+1)>=0) throw new Error(`${label} matched more than once.`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const buildPath='translation/build-runtime.mjs';
let build=fs.readFileSync(buildPath,'utf8');

const setupAnchor="replaceOnce('pose/grab constants',`const POSES = {";
const setup =
"replaceOnce(\n"+
"  'runtime helper setup point',\n"+
"  `function savedLook(){try{return cleanLook(JSON.parse(localStorage.getItem('puppetalk-look')||'null'));}catch{return defaultLook();}}\n"+
"function saveLook(look){try{localStorage.setItem('puppetalk-look',JSON.stringify(cleanLook(look)));}catch{}}`,\n"+
"  `const runtimeHelpers = window.PuppetalkRuntimeHelpers?.create?.({\n"+
"  cleanLook,defaultLook,getStorage:()=>localStorage,random:()=>Math.random()\n"+
"});\n"+
"if(!runtimeHelpers) throw new Error('Puppetalk runtime helpers failed to load.');\n"+
"const {clamp,clean,peerId,send,cleanPlayerName,savedPlayerName,savedLook,saveLook,roomCode,angleDelta} = runtimeHelpers;`\n"+
");\n\n";
if(!build.includes(setupAnchor)) throw new Error('Missing pose/grab transform anchor.');
build=build.replace(setupAnchor,setup+setupAnchor);

const poseEnd="});\n\nreplaceOnce('character helper factory point'";
const utilityRemovals =
"});\n\n"+
"replaceOnce(\n"+
"  'embedded shared runtime helpers',\n"+
"  `const clamp = (v,a,b) => Math.max(a,Math.min(b,v));\n"+
"const clean = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);\n"+
"const peerId = r => `puppetalk-${r.toLowerCase()}`;\n"+
"const send = (conn,msg) => { if(conn?.open) conn.send(msg); };\n"+
"const cleanPlayerName = v => String(v || '').trim().replace(/\\s+/g,' ').slice(0,24);\n"+
"function savedPlayerName(){ try{return cleanPlayerName(localStorage.getItem('puppetalk-name'));}catch{return '';} }\n"+
"`,\n"+
"  ``\n"+
");\n\n"+
"replaceOnce(\n"+
"  'embedded room and angle helpers',\n"+
"  `function roomCode(){\n"+
"  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';\n"+
"  return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join('');\n"+
"}\n"+
"function angleDelta(target,current){\n"+
"  let d = target-current;\n"+
"  while(d > Math.PI) d -= Math.PI*2;\n"+
"  while(d < -Math.PI) d += Math.PI*2;\n"+
"  return d;\n"+
"}\n"+
"`,\n"+
"  ``\n"+
");\n\n"+
"replaceOnce('character helper factory point'";
if(!build.includes(poseEnd)) throw new Error('Missing character helper transform anchor.');
build=build.replace(poseEnd,utilityRemovals);
fs.writeFileSync(buildPath,build);

const indexPath='translation/index.html';
let index=fs.readFileSync(indexPath,'utf8');
index=replaceOnce(index,'look-model script',
  '  <script src="./translation/character/look-model.js?v=1"></script>\n',
  '  <script src="./translation/character/look-model.js?v=1"></script>\n  <script src="./translation/core/runtime-helpers.js?v=1"></script>\n'
);
fs.writeFileSync(indexPath,index);

const smokePath='translation/entry-smoke.mjs';
let smoke=fs.readFileSync(smokePath,'utf8');
smoke=replaceOnce(smoke,'expected runtime helper script',
  "expectedRuntime.push('./translation/character/look-model.js?v=1');\n",
  "expectedRuntime.push('./translation/character/look-model.js?v=1');\nexpectedRuntime.push('./translation/core/runtime-helpers.js?v=1');\n"
);
smoke=replaceOnce(smoke,'runtime helper assertion anchor',
  "assert.ok(actualScripts.includes('./translation/character/look-model.js?v=1'),'Extracted character look model is missing.');\n",
  "assert.ok(actualScripts.includes('./translation/character/look-model.js?v=1'),'Extracted character look model is missing.');\nassert.ok(actualScripts.includes('./translation/core/runtime-helpers.js?v=1'),'Extracted frozen runtime helpers are missing.');\n"
);
fs.writeFileSync(smokePath,smoke);

console.log('Wired frozen runtime helpers into the translated runtime build.');
