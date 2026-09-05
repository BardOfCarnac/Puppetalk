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
const creatorExtraction=`removeBetweenOnce(\n  'embedded character creator controller',`;
const itemExtraction=`removeBetweenOnce(\n  'embedded controller special-item helpers',\n  \`  function controllerSpecialType(){\`,\n  \`  function transmit(force=false){\`\n);\n\nreplaceOnce(\n  'controller item interactions setup point',\n  \`  function transmit(force=false){\`,\n  \`  const itemInteraction = window.PuppetalkControllerItems?.create?.({\n    document,canvas,send,\n    getConn:()=>conn,getSlot:()=>slot,getPropScene:()=>propScene,getScene:()=>scene,\n    getDimensions:()=>({cw,ch}),getMyPuppet:()=>scene.find(p=>p.slot === slot),\n    seatProjection:puppetalkSeatProjection,\n    displayPoint:typeof displayPoint === 'function' ? displayPoint : null,\n    storage:localStorage\n  });\n  if(!itemInteraction) throw new Error('Puppetalk controller item interactions failed to load.');\n  const {\n    controllerSpecialType,controllerSpecialLabel,updateSpecialItemButton,bringOutMySpecialItem,\n    heldProp,updateGripButtons,toggleGrip,propDisplayPoint,pickTappedProp,nearestPropHand\n  } = itemInteraction;\n\n  function transmit(force=false){\`\n);\n\nremoveBetweenOnce(\n  'embedded controller grip helpers',\n  \`  function heldProp(hand){ return propScene.find(prop=>prop?.heldBy?.slot === slot && prop?.heldBy?.hand === hand); }\`,\n  \`  function connect(){\`\n);\n\nremoveBetweenOnce(\n  'embedded controller prop tap interactions',\n  \`  function propDisplayPoint(q){\`,\n  \`  function sendLook(){\`\n);\n\nreplaceOnce(\n  'controller prop tap install point',\n  \`  function sendLook(){\`,\n  \`  itemInteraction.installPropTap();\n\n  function sendLook(){\`\n);\n\nreplaceOnce(\n  'controller item buttons',\n  \`  document.querySelector('#special-item')?.addEventListener('click',bringOutMySpecialItem);\n  updateSpecialItemButton(false);\n  document.querySelector('#grip-left')?.addEventListener('click',()=>toggleGrip('left'));\n  document.querySelector('#grip-right')?.addEventListener('click',()=>toggleGrip('right'));\`,\n  \`  itemInteraction.installButtons();\n  updateSpecialItemButton(false);\`\n);\n\n`;
if(!build.includes("'embedded controller special-item helpers'")) build=insertBefore(build,'controller item extraction',creatorExtraction,itemExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const creatorModule="assert.match(actual,/PuppetalkCharacterCreator/,'Translated runtime is not connected to extracted character creator controller.');\n";
const itemModule="assert.match(actual,/PuppetalkControllerItems/,'Translated runtime is not connected to extracted controller item interactions.');\n";
if(!parity.includes(itemModule.trim())) parity=insertBefore(parity,'controller item module assertion',creatorModule,itemModule);

const creatorNegative="assert.doesNotMatch(actual,/function sendLook\\(\\)/,'Embedded sendLook survived character-creator extraction.');\n";
const itemNegatives="assert.doesNotMatch(actual,/function controllerSpecialType\\(\\)/,'Embedded controllerSpecialType survived item-interaction extraction.');\nassert.doesNotMatch(actual,/function updateSpecialItemButton\\(isOut=false\\)/,'Embedded updateSpecialItemButton survived item-interaction extraction.');\nassert.doesNotMatch(actual,/function heldProp\\(hand\\)/,'Embedded heldProp survived item-interaction extraction.');\nassert.doesNotMatch(actual,/function pickTappedProp\\(event\\)/,'Embedded pickTappedProp survived item-interaction extraction.');\nassert.doesNotMatch(actual,/function nearestPropHand\\(prop\\)/,'Embedded nearestPropHand survived item-interaction extraction.');\n";
if(!parity.includes('Embedded nearestPropHand survived item-interaction extraction.')) parity=insertBefore(parity,'controller item negative assertions',creatorNegative,itemNegatives);

const creatorBinding="assert.match(actual,/const characterCreator = window\\.PuppetalkCharacterCreator\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted character creator controller.');\n";
const itemBinding="assert.match(actual,/const itemInteraction = window\\.PuppetalkControllerItems\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted controller item interactions.');\nassert.match(actual,/itemInteraction\\.installPropTap\\(\\);/,'Extracted controller prop-tap interactions are not installed.');\nassert.match(actual,/itemInteraction\\.installButtons\\(\\);/,'Extracted controller item buttons are not installed.');\n";
if(!parity.includes('Extracted controller item buttons are not installed.')) parity=insertBefore(parity,'controller item binding assertions',creatorBinding,itemBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const creatorScript='  <script src="./translation/controller/character-creator.js?v=1"></script>\n';
const itemScript='  <script src="./translation/controller/item-interactions.js?v=1"></script>\n';
if(!html.includes(itemScript.trim())) html=insertBefore(html,'controller item script',creatorScript,itemScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedCreator="expectedRuntime.push('./translation/controller/character-creator.js?v=1');\n";
const expectedItem="expectedRuntime.push('./translation/controller/item-interactions.js?v=1');\n";
if(!entry.includes(expectedItem.trim())) entry=insertBefore(entry,'expected controller item module',expectedCreator,expectedItem);
const actualCreator="assert.ok(actualScripts.includes('./translation/controller/character-creator.js?v=1'),'Extracted character creator controller is missing.');\n";
const actualItem="assert.ok(actualScripts.includes('./translation/controller/item-interactions.js?v=1'),'Extracted controller item interactions are missing.');\n";
if(!entry.includes(actualItem.trim())) entry=insertBefore(entry,'controller item entry assertion',actualCreator,actualItem);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared controller item interactions extraction against the current translated runtime.');
