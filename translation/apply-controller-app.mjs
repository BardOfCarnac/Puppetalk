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

console.log('Wired frozen controller app composition into the translated runtime.');
