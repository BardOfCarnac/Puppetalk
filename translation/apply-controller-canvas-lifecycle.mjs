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

const stateFrom=`  let centreTimer = null;\n  let cw = 1;\n  let ch = 1;\n  const input = {pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[]};`;
const stateTo=`  let centreTimer = null;\n  const input = {pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[]};`;
const setupFrom=`  input.look = savedLook();\n\n  const controllerSession = window.PuppetalkControllerSession?.create?.({`;
const setupTo=`  input.look = savedLook();\n\n  const controllerCanvas = window.PuppetalkControllerCanvas?.create?.({\n    canvas,stageBox,ctx,\n    getDevicePixelRatio:()=>devicePixelRatio || 1,\n    addEventListenerFn:(type,handler,opts)=>addEventListener(type,handler,opts)\n  });\n  if(!controllerCanvas) throw new Error('Puppetalk controller canvas lifecycle failed to load.');\n  const {getDimensions:getCanvasDimensions} = controllerCanvas;\n\n  const controllerSession = window.PuppetalkControllerSession?.create?.({`;
const puppetDimsFrom=`    getScene,getPropScene,getSlot,getDimensions:()=>({cw,ch}),`;
const puppetDimsTo=`    getScene,getPropScene,getSlot,getDimensions:getCanvasDimensions,`;
const resizeFrom=`  function resizeCanvas(){\n    const rect = stageBox.getBoundingClientRect();\n    cw = Math.max(280,rect.width);\n    ch = Math.max(250,Math.min(cw*.8,430));\n    const dpr = Math.min(devicePixelRatio || 1,2);\n    canvas.width = Math.round(cw*dpr);\n    canvas.height = Math.round(ch*dpr);\n    canvas.style.width = \`${'${cw}'}px\`;\n    canvas.style.height = \`${'${ch}'}px\`;\n    stageBox.style.minHeight = \`${'${ch}'}px\`;\n    ctx.setTransform(dpr,0,0,dpr,0,0);\n    renderPersonalScene();\n  }\n\n`;
const itemDimsFrom=`    getDimensions:()=>({cw,ch}),getMyPuppet:()=>getScene().find(p=>p.slot === getSlot()),`;
const itemDimsTo=`    getDimensions:getCanvasDimensions,getMyPuppet:()=>getScene().find(p=>p.slot === getSlot()),`;
const renderHookFrom=`  } = puppetInteraction;\n\n  const itemInteraction = window.PuppetalkControllerItems?.create?.({`;
const renderHookTo=`  } = puppetInteraction;\n  controllerCanvas.setRender(renderPersonalScene);\n\n  const itemInteraction = window.PuppetalkControllerItems?.create?.({`;
const startupFrom=`  addEventListener('resize',resizeCanvas,{passive:true});\n  resizeCanvas();\n  connect();`;
const startupTo=`  controllerCanvas.start();\n  connect();`;

const transforms=[
  ['embedded controller canvas state',stateFrom,stateTo],
  ['controller canvas setup point',setupFrom,setupTo],
  ['controller puppet dimensions',puppetDimsFrom,puppetDimsTo],
  ['embedded controller canvas resize',resizeFrom,''],
  ['controller item dimensions',itemDimsFrom,itemDimsTo],
  ['controller canvas render hook',renderHookFrom,renderHookTo],
  ['controller canvas startup',startupFrom,startupTo]
].map(([label,from,to])=>`replaceOnce(${JSON.stringify(label)},${JSON.stringify(from)},${JSON.stringify(to)});`).join('\n\n');
build=replaceOnce(build,'runtime syntax-check insertion',insertion,`${transforms}\n\n${insertion}`);
fs.writeFileSync(buildPath,build);

const indexPath='translation/index.html';
let index=fs.readFileSync(indexPath,'utf8');
index=replaceOnce(index,'controller session script',
  '  <script src="./translation/controller/session.js?v=1"></script>\n',
  '  <script src="./translation/controller/canvas-lifecycle.js?v=1"></script>\n  <script src="./translation/controller/session.js?v=1"></script>\n'
);
fs.writeFileSync(indexPath,index);

const smokePath='translation/entry-smoke.mjs';
let smoke=fs.readFileSync(smokePath,'utf8');
smoke=replaceOnce(smoke,'expected controller session script',
  "expectedRuntime.push('./translation/controller/session.js?v=1');\n",
  "expectedRuntime.push('./translation/controller/canvas-lifecycle.js?v=1');\nexpectedRuntime.push('./translation/controller/session.js?v=1');\n"
);
smoke=replaceOnce(smoke,'controller session assertion',
  "assert.ok(actualScripts.includes('./translation/controller/session.js?v=1'),'Extracted controller session is missing.');\n",
  "assert.ok(actualScripts.includes('./translation/controller/canvas-lifecycle.js?v=1'),'Extracted controller canvas lifecycle is missing.');\nassert.ok(actualScripts.includes('./translation/controller/session.js?v=1'),'Extracted controller session is missing.');\n"
);
fs.writeFileSync(smokePath,smoke);

console.log('Wired frozen controller canvas lifecycle into the translated runtime.');
