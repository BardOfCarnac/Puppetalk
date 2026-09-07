import fs from 'node:fs';

function replaceOnce(source,label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label}.`);
  if(source.indexOf(from,first+1)>=0) throw new Error(`${label} matched more than once.`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const buildPath='translation/build-runtime.mjs';
let build=fs.readFileSync(buildPath,'utf8');
const insertion='new Function(source);';
if(!build.includes(insertion)) throw new Error('Missing runtime syntax-check anchor.');

const dispatchFrom=`if(mode === 'controller') startController(room);\nelse startStage(room || roomCode());`;
const dispatchTo=`const controllerApp = window.PuppetalkControllerApp?.create?.({\n  app,document,POSES,LOOK_PALETTE,LOOK_PARTS,cleanLook,saveLook,savedLook,\n  peerId,NAMES,send,savedPlayerName,clamp,drawBackdrop,puppetalkSeatProjection,\n  drawProp,drawAnatomy,incompleteInviteShell,controllerShell\n});\nif(!controllerApp) throw new Error('Puppetalk controller app failed to load.');\nconst {startController} = controllerApp;\n\nif(mode === 'controller') startController(room);\nelse startStage(room || roomCode());`;
const transforms=`replaceOnce('controller app setup',${JSON.stringify(dispatchFrom)},${JSON.stringify(dispatchTo)});\n\nremoveBetweenOnce('embedded controller app composition','function startController(room){','\\n\\n})();');`;
build=replaceOnce(build,'runtime syntax-check insertion',insertion,`${transforms}\n\n${insertion}`);
fs.writeFileSync(buildPath,build);

const indexPath='translation/index.html';
let index=fs.readFileSync(indexPath,'utf8');
index=replaceOnce(index,'controller command script',
  '  <script src="./translation/controller/command-panel.js?v=1"></script>\n',
  '  <script src="./translation/controller/command-panel.js?v=1"></script>\n  <script src="./translation/controller/app.js?v=1"></script>\n'
);
fs.writeFileSync(indexPath,index);

const smokePath='translation/entry-smoke.mjs';
let smoke=fs.readFileSync(smokePath,'utf8');
smoke=replaceOnce(smoke,'expected controller command script',
  "expectedRuntime.push('./translation/controller/command-panel.js?v=1');\n",
  "expectedRuntime.push('./translation/controller/command-panel.js?v=1');\nexpectedRuntime.push('./translation/controller/app.js?v=1');\n"
);
smoke=replaceOnce(smoke,'controller command assertion',
  "assert.ok(actualScripts.includes('./translation/controller/command-panel.js?v=1'),'Extracted controller command panel is missing.');\n",
  "assert.ok(actualScripts.includes('./translation/controller/command-panel.js?v=1'),'Extracted controller command panel is missing.');\nassert.ok(actualScripts.includes('./translation/controller/app.js?v=1'),'Extracted controller app composition is missing.');\n"
);
fs.writeFileSync(smokePath,smoke);

const parityPath='translation/runtime-parity-smoke.mjs';
let parity=fs.readFileSync(parityPath,'utf8');
const oldControllerChecks=`assert.match(actual,/PuppetalkControllerPuppetry/,'Translated runtime is not connected to extracted direct puppet interaction.');\nassert.match(actual,/PuppetalkControllerItems/,'Translated runtime is not connected to extracted controller item interactions.');\nassert.match(actual,/PuppetalkCharacterCreator/,'Translated runtime is not connected to extracted character creator controller.');\nassert.match(actual,/PuppetalkControllerThrowGesture/,'Translated runtime is not connected to extracted controller throw gesture.');\nassert.match(actual,/PuppetalkControllerAudio/,'Translated runtime is not connected to extracted controller audio system.');\nassert.match(actual,/PuppetalkControllerCommands/,'Translated runtime is not connected to extracted controller command panel.');\nassert.match(actual,/PuppetalkControllerSession/,'Translated runtime is not connected to extracted controller session.');`;
const newControllerChecks=`assert.match(actual,/PuppetalkControllerApp/,'Translated runtime is not connected to extracted controller app composition.');\nconst controllerAppSource=fs.readFileSync('translation/controller/app.js','utf8');\nassert.match(controllerAppSource,/PuppetalkControllerPuppetry/,'Controller app is not connected to extracted direct puppet interaction.');\nassert.match(controllerAppSource,/PuppetalkControllerItems/,'Controller app is not connected to extracted controller item interactions.');\nassert.match(controllerAppSource,/PuppetalkCharacterCreator/,'Controller app is not connected to extracted character creator controller.');\nassert.match(controllerAppSource,/PuppetalkControllerThrowGesture/,'Controller app is not connected to extracted controller throw gesture.');\nassert.match(controllerAppSource,/PuppetalkControllerAudio/,'Controller app is not connected to extracted controller audio system.');\nassert.match(controllerAppSource,/PuppetalkControllerCommands/,'Controller app is not connected to extracted controller command panel.');\nassert.match(controllerAppSource,/PuppetalkControllerSession/,'Controller app is not connected to extracted controller session.');\nassert.doesNotMatch(actual,/function startController\\(room\\)/,'Embedded startController survived controller-app extraction.');`;
parity=replaceOnce(parity,'controller parity boundary',oldControllerChecks,newControllerChecks);
const oldShellChecks=`assert.match(actual,/app\\.innerHTML = stageShell\\(room,joinUrl\\.href\\);/,'Stage does not render through extracted view shell.');\nassert.match(actual,/app\\.innerHTML = controllerShell\\(room,POSES\\);/,'Controller does not render through extracted view shell.');\nassert.match(actual,/app\\.innerHTML = incompleteInviteShell\\(\\);/,'Incomplete controller invite does not render through extracted view shell.');`;
const newShellChecks=`assert.match(actual,/app\\.innerHTML = stageShell\\(room,joinUrl\\.href\\);/,'Stage does not render through extracted view shell.');\nassert.match(controllerAppSource,/app\\.innerHTML = controllerShell\\(room,POSES\\);/,'Controller app does not render through extracted view shell.');\nassert.match(controllerAppSource,/app\\.innerHTML = incompleteInviteShell\\(\\);/,'Controller app incomplete invite does not render through extracted view shell.');`;
parity=replaceOnce(parity,'controller view-shell parity boundary',oldShellChecks,newShellChecks);
fs.writeFileSync(parityPath,parity);

console.log('Wired frozen controller app composition into the translated runtime.');
