import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s.endsWith('\n')?s:`${s}\n`,'utf8');

function replaceOnce(text,label,from,to){
  const i=text.indexOf(from);
  if(i<0) throw new Error(`Missing ${label} marker.`);
  if(text.indexOf(from,i+from.length)>=0) throw new Error(`${label} marker matched more than once.`);
  return text.slice(0,i)+to+text.slice(i+from.length);
}
function insertBefore(text,label,marker,addition){
  if(text.includes(addition.trim())) return text;
  return replaceOnce(text,label,marker,addition+marker);
}

let build=read('translation/build-runtime.mjs');
const propCollisionSetup=`replaceOnce('prop collision setup point',`;
const sessionExtraction=`replaceOnce(\n  'embedded controller session state',\n  \`  let peer;\n  let conn;\n  let slot = null;\n  let scene = [];\n  let propScene = [];\n  let centreTimer = null;\n  let cw = 1;\n  let ch = 1;\n  let lastSent = '';\n  let reconnectTimer = null;\n  let connectGeneration = 0;\n  const input = {pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[]};\`,\n  \`  let centreTimer = null;\n  let cw = 1;\n  let ch = 1;\n  const input = {pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[]};\`\n);\n\nreplaceOnce(\n  'controller session setup point',\n  \`  input.look = savedLook();\n\n  const puppetInteraction = window.PuppetalkControllerPuppetry?.create?.({\`,\n  \`  input.look = savedLook();\n\n  const controllerSession = window.PuppetalkControllerSession?.create?.({\n    Peer,room,peerId,NAMES,input,send,savedPlayerName,hint,youChip,status,dot,\n    setTimeoutFn:(callback,ms)=>setTimeout(callback,ms),\n    clearTimeoutFn:id=>clearTimeout(id)\n  });\n  if(!controllerSession) throw new Error('Puppetalk controller session failed to load.');\n  const {setStatus,transmit,connect,getConn,getSlot,getScene,getPropScene} = controllerSession;\n\n  const puppetInteraction = window.PuppetalkControllerPuppetry?.create?.({\`\n);\n\nreplaceOnce(\n  'controller session direct-puppetry accessors',\n  \`    getScene:()=>scene,getPropScene:()=>propScene,getSlot:()=>slot,getDimensions:()=>({cw,ch}),\`,\n  \`    getScene,getPropScene,getSlot,getDimensions:()=>({cw,ch}),\`\n);\n\nremoveBetweenOnce(\n  'embedded controller status setter',\n  \`  function setStatus(text,state=''){\`,\n  \`  function resizeCanvas(){\`\n);\n\nreplaceOnce(\n  'controller session item accessors',\n  \`    getConn:()=>conn,getSlot:()=>slot,getPropScene:()=>propScene,getScene:()=>scene,\n    getDimensions:()=>({cw,ch}),getMyPuppet:()=>scene.find(p=>p.slot === slot),\`,\n  \`    getConn,getSlot,getPropScene,getScene,\n    getDimensions:()=>({cw,ch}),getMyPuppet:()=>getScene().find(p=>p.slot === getSlot()),\`\n);\n\nreplaceOnce(\n  'controller session hook point',\n  \`  const {\n    controllerSpecialType,controllerSpecialLabel,updateSpecialItemButton,bringOutMySpecialItem,\n    heldProp,updateGripButtons,toggleGrip,propDisplayPoint,pickTappedProp,nearestPropHand\n  } = itemInteraction;\`,\n  \`  const {\n    controllerSpecialType,controllerSpecialLabel,updateSpecialItemButton,bringOutMySpecialItem,\n    heldProp,updateGripButtons,toggleGrip,propDisplayPoint,pickTappedProp,nearestPropHand\n  } = itemInteraction;\n  controllerSession.setHooks({updateSpecialItemButton,updateGripButtons,renderPersonalScene});\`\n);\n\nremoveBetweenOnce(\n  'embedded controller session operations',\n  \`  function transmit(force=false){\`,\n  \`  puppetInteraction.install();\`\n);\n\nreplaceOnce(\n  'controller session character accessors',\n  \`    getConn:()=>conn,getSlot:()=>slot,savedPlayerName,random:()=>Math.random()\`,\n  \`    getConn,getSlot,savedPlayerName,random:()=>Math.random()\`\n);\n\nreplaceOnce(\n  'controller session throw accessors',\n  \`    getConn:()=>conn,getSlot:()=>slot,send,\`,\n  \`    getConn,getSlot,send,\`\n);\n\n`;
if(!build.includes("'embedded controller session state'")) build=insertBefore(build,'controller session extraction',propCollisionSetup,sessionExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const commandModule="assert.match(actual,/PuppetalkControllerCommands/,'Translated runtime is not connected to extracted controller command panel.');\n";
const sessionModule="assert.match(actual,/PuppetalkControllerSession/,'Translated runtime is not connected to extracted controller session.');\n";
if(!parity.includes(sessionModule.trim())) parity=replaceOnce(parity,'controller session module assertion',commandModule,commandModule+sessionModule);

const commandNegative="assert.doesNotMatch(actual,/document\\.querySelector\\('#retry'\\)\\.addEventListener\\('click',connect\\)/,'Embedded retry listener survived command-panel extraction.');\n";
const sessionNegatives="assert.doesNotMatch(actual,/let connectGeneration = 0;/,'Embedded controller connect generation survived session extraction.');\nassert.doesNotMatch(actual,/let reconnectTimer = null;/,'Embedded controller reconnect timer survived session extraction.');\nassert.doesNotMatch(actual,/function setStatus\\(text,state=''\\)/,'Embedded controller setStatus survived session extraction.');\nassert.doesNotMatch(actual,/function transmit\\(force=false\\)/,'Embedded controller transmit survived session extraction.');\nassert.doesNotMatch(actual,/function connect\\(\\)/,'Embedded controller connect survived session extraction.');\nassert.doesNotMatch(actual,/getConn:\(\)=>conn/,'Controller modules still close over embedded conn state.');\nassert.doesNotMatch(actual,/getScene:\(\)=>scene/,'Controller modules still close over embedded scene state.');\n";
if(!parity.includes('Embedded controller connect survived session extraction.')) parity=replaceOnce(parity,'controller session negative assertions',commandNegative,commandNegative+sessionNegatives);

const commandBinding="assert.match(actual,/commandPanel\\.install\\(\\);/,'Extracted controller command panel is not installed.');\n";
const sessionBinding="assert.match(actual,/const controllerSession = window\\.PuppetalkControllerSession\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted controller session.');\nassert.match(actual,/const \\{setStatus,transmit,connect,getConn,getSlot,getScene,getPropScene\\} = controllerSession;/,'Controller session accessors are not bound.');\nassert.match(actual,/controllerSession\\.setHooks\\(\\{updateSpecialItemButton,updateGripButtons,renderPersonalScene\\}\\);/,'Controller session UI hooks are not installed.');\n";
if(!parity.includes('Controller session UI hooks are not installed.')) parity=replaceOnce(parity,'controller session binding assertions',commandBinding,commandBinding+sessionBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const puppetryScript='  <script src="./translation/controller/puppet-interaction.js?v=1"></script>\n';
const sessionScript='  <script src="./translation/controller/session.js?v=1"></script>\n';
if(!html.includes(sessionScript.trim())) html=replaceOnce(html,'controller session script',puppetryScript,sessionScript+puppetryScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedPuppetry="expectedRuntime.push('./translation/controller/puppet-interaction.js?v=1');\n";
const expectedSession="expectedRuntime.push('./translation/controller/session.js?v=1');\n";
if(!entry.includes(expectedSession.trim())) entry=replaceOnce(entry,'expected controller session module',expectedPuppetry,expectedSession+expectedPuppetry);
const actualPuppetry="assert.ok(actualScripts.includes('./translation/controller/puppet-interaction.js?v=1'),'Extracted direct puppet interaction is missing.');\n";
const actualSession="assert.ok(actualScripts.includes('./translation/controller/session.js?v=1'),'Extracted controller session is missing.');\n";
if(!entry.includes(actualSession.trim())) entry=replaceOnce(entry,'controller session entry assertion',actualPuppetry,actualSession+actualPuppetry);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared controller session extraction against the current translated runtime.');
