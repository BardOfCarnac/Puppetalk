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
const throwExtraction=`removeBetweenOnce(\n  'embedded controller throw gesture',`;
const creatorExtraction=`removeBetweenOnce(\n  'embedded character creator controller',\n  \`  function sendLook(){\`,\n  \`  const throwGestures = new Map();\`\n);\n\nreplaceOnce(\n  'character creator controller setup point',\n  \`  const throwGestures = new Map();\`,\n  \`  const characterCreator = window.PuppetalkCharacterCreator?.create?.({\n    document,input,LOOK_PALETTE,LOOK_PARTS,cleanLook,saveLook,send,\n    getConn:()=>conn,getSlot:()=>slot,savedPlayerName,random:()=>Math.random()\n  });\n  if(!characterCreator) throw new Error('Puppetalk character creator controller failed to load.');\n  characterCreator.install();\n\n  const throwGestures = new Map();\`\n);\n\n`;
if(!build.includes("'embedded character creator controller'")) build=insertBefore(build,'character creator extraction',throwExtraction,creatorExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const throwModule="assert.match(actual,/PuppetalkControllerThrowGesture/,'Translated runtime is not connected to extracted controller throw gesture.');\n";
const creatorModule="assert.match(actual,/PuppetalkCharacterCreator/,'Translated runtime is not connected to extracted character creator controller.');\n";
if(!parity.includes(creatorModule.trim())) parity=insertBefore(parity,'character creator module assertion',throwModule,creatorModule);

const throwStateNegative="assert.doesNotMatch(actual,/const throwGestures = new Map\\(\\);/,'Embedded throwGestures state survived controller throw extraction.');\n";
const creatorNegatives="assert.doesNotMatch(actual,/function sendLook\\(\\)/,'Embedded sendLook survived character-creator extraction.');\nassert.doesNotMatch(actual,/function cycleLook\\(key\\)/,'Embedded cycleLook survived character-creator extraction.');\nassert.doesNotMatch(actual,/function renderCreator\\(\\)/,'Embedded renderCreator survived character-creator extraction.');\nassert.doesNotMatch(actual,/document\\.querySelector\\('#character-random'\\)\\?\\.addEventListener/,'Embedded character random listener survived character-creator extraction.');\n";
if(!parity.includes('Embedded renderCreator survived character-creator extraction.')) parity=insertBefore(parity,'character creator negative assertions',throwStateNegative,creatorNegatives);

const throwBinding="assert.match(actual,/const controllerThrowGesture = window\\.PuppetalkControllerThrowGesture\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted controller throw gesture.');\n";
const creatorBinding="assert.match(actual,/const characterCreator = window\\.PuppetalkCharacterCreator\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted character creator controller.');\nassert.match(actual,/characterCreator\\.install\\(\\);/,'Extracted character creator controller is not installed.');\n";
if(!parity.includes('Extracted character creator controller is not installed.')) parity=insertBefore(parity,'character creator binding assertion',throwBinding,creatorBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const throwScript='  <script src="./translation/controller/throw-gesture.js?v=1"></script>\n';
const creatorScript='  <script src="./translation/controller/character-creator.js?v=1"></script>\n';
if(!html.includes(creatorScript.trim())) html=insertBefore(html,'character creator script',throwScript,creatorScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedThrow="expectedRuntime.push('./translation/controller/throw-gesture.js?v=1');\n";
const expectedCreator="expectedRuntime.push('./translation/controller/character-creator.js?v=1');\n";
if(!entry.includes(expectedCreator.trim())) entry=insertBefore(entry,'expected character creator module',expectedThrow,expectedCreator);
const actualThrow="assert.ok(actualScripts.includes('./translation/controller/throw-gesture.js?v=1'),'Extracted controller throw gesture is missing.');\n";
const actualCreator="assert.ok(actualScripts.includes('./translation/controller/character-creator.js?v=1'),'Extracted character creator controller is missing.');\n";
if(!entry.includes(actualCreator.trim())) entry=insertBefore(entry,'character creator entry assertion',actualThrow,actualCreator);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared character creator controller extraction against the current translated runtime.');
