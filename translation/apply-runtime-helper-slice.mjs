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
const setup=`replaceOnce(
  'runtime helper setup point',
  \`function savedLook(){try{return cleanLook(JSON.parse(localStorage.getItem('puppetalk-look')||'null'));}catch{return defaultLook();}}
function saveLook(look){try{localStorage.setItem('puppetalk-look',JSON.stringify(cleanLook(look)));}catch{}}\`,
  \`const runtimeHelpers = window.PuppetalkRuntimeHelpers?.create?.({
  cleanLook,defaultLook,getStorage:()=>localStorage,random:()=>Math.random()
});
if(!runtimeHelpers) throw new Error('Puppetalk runtime helpers failed to load.');
const {clamp,clean,peerId,send,cleanPlayerName,savedPlayerName,savedLook,saveLook,roomCode,angleDelta} = runtimeHelpers;\`
);

`;
if(!build.includes(setupAnchor)) throw new Error('Missing pose/grab transform anchor.');
build=build.replace(setupAnchor,setup+setupAnchor);

const poseEnd=`});

replaceOnce('character helper factory point'`;
const utilityRemovals=`});

replaceOnce(
  'embedded shared runtime helpers',
  \`const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const clean = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const peerId = r => \\`puppetalk-\\${r.toLowerCase()}\\`;
const send = (conn,msg) => { if(conn?.open) conn.send(msg); };
const cleanPlayerName = v => String(v || '').trim().replace(/\\s+/g,' ').slice(0,24);
function savedPlayerName(){ try{return cleanPlayerName(localStorage.getItem('puppetalk-name'));}catch{return '';} }
\`,
  \`\`
);

replaceOnce(
  'embedded room and angle helpers',
  \`function roomCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}
function angleDelta(target,current){
  let d = target-current;
  while(d > Math.PI) d -= Math.PI*2;
  while(d < -Math.PI) d += Math.PI*2;
  return d;
}
\`,
  \`\`
);

replaceOnce('character helper factory point'`;
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
