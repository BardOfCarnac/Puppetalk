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
function insertBefore(text,label,marker,addition){
  if(text.includes(addition.trim())) return text;
  return replaceOnce(text,label,marker,addition+marker);
}

let build=read('translation/build-runtime.mjs');
const runtimeTail=`replaceOnce('prop collision setup point',`;
const controllerExtraction=`removeBetweenOnce(\n  'embedded controller throw gesture',\n  \`  const throwGestures = new Map();\`,\n  \`  document.querySelector('#poses').addEventListener('click',event=>{\`\n);\n\nreplaceOnce(\n  'controller throw gesture setup point',\n  \`  document.querySelector('#poses').addEventListener('click',event=>{\`,\n  \`  const controllerThrowGesture = window.PuppetalkControllerThrowGesture?.create?.({\n    canvas,activePointers,heldProp,pointerToWorld,\n    getConn:()=>conn,getSlot:()=>slot,send,\n    now:()=>performance.now(),queueTask:callback=>queueMicrotask(callback)\n  });\n  if(!controllerThrowGesture) throw new Error('Puppetalk controller throw gesture failed to load.');\n  controllerThrowGesture.install();\n\n  document.querySelector('#poses').addEventListener('click',event=>{\`\n);\n\n`;
if(!build.includes("'embedded controller throw gesture'")) build=insertBefore(build,'controller throw extraction',runtimeTail,controllerExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const contactModule="assert.match(actual,/PuppetalkPropContactPhysics/,'Translated runtime is not connected to extracted prop contact physics.');\n";
const controllerModule="assert.match(actual,/PuppetalkControllerThrowGesture/,'Translated runtime is not connected to extracted controller throw gesture.');\n";
if(!parity.includes(controllerModule.trim())) parity=insertAfter(parity,'controller throw module assertion',contactModule,controllerModule);

const contactNegative="assert.doesNotMatch(actual,/function installPropContactPhysics\\(\\)/,'Embedded installPropContactPhysics survived prop-contact extraction.');\n";
const controllerNegatives="assert.doesNotMatch(actual,/const throwGestures = new Map\\(\\);/,'Embedded throwGestures state survived controller throw extraction.');\nassert.doesNotMatch(actual,/function sampleThrowGesture\\(gesture,x,y,now\\)/,'Embedded sampleThrowGesture survived controller throw extraction.');\nassert.doesNotMatch(actual,/function releaseVector\\(gesture,x,y,now\\)/,'Embedded releaseVector survived controller throw extraction.');\nassert.doesNotMatch(actual,/function finishThrow\\(event\\)/,'Embedded finishThrow survived controller throw extraction.');\n";
if(!parity.includes('Embedded finishThrow survived controller throw extraction.')) parity=insertAfter(parity,'controller throw negative assertions',contactNegative,controllerNegatives);

const contactBinding="assert.match(actual,/const \\{installPropContactPhysics\\} = propContactPhysics;/,'Runtime is not bound to the extracted prop contact physics.');\n";
const controllerBinding="assert.match(actual,/const controllerThrowGesture = window\\.PuppetalkControllerThrowGesture\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted controller throw gesture.');\nassert.match(actual,/controllerThrowGesture\\.install\\(\\);/,'Extracted controller throw gesture is not installed.');\n";
if(!parity.includes('Extracted controller throw gesture is not installed.')) parity=insertAfter(parity,'controller throw binding assertion',contactBinding,controllerBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const bootstrapScript='  <script src="./translation/bootstrap.js?v=2"></script>\n';
const controllerScript='  <script src="./translation/controller/throw-gesture.js?v=1"></script>\n';
if(!html.includes(controllerScript.trim())) html=insertBefore(html,'controller throw script',bootstrapScript,controllerScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedBootstrap="expectedRuntime.push('./translation/bootstrap.js?v=2');\n";
const expectedController="expectedRuntime.push('./translation/controller/throw-gesture.js?v=1');\n";
if(!entry.includes(expectedController.trim())) entry=insertBefore(entry,'expected controller throw module',expectedBootstrap,expectedController);
const actualBootstrap="assert.ok(actualScripts.includes('./translation/bootstrap.js?v=2'),'Translated bootstrap is missing.');\n";
const actualController="assert.ok(actualScripts.includes('./translation/controller/throw-gesture.js?v=1'),'Extracted controller throw gesture is missing.');\n";
if(!entry.includes(actualController.trim())) entry=insertBefore(entry,'controller throw entry assertion',actualBootstrap,actualController);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared controller throw-gesture extraction against the current translated runtime.');
