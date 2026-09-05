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
const inputBinding=`  const {propHandIsClose,tapProp,releaseAllPropGrips,throwHeldProp,handlePropInput} = propInputSystem;\n`;
const specialSetup=`  const specialItemSystem = window.PuppetalkSpecialItems?.create?.({\n    specialItems,props,puppets,conns,send,makeProp,grabWorldPoint,clamp,\n    getDimensions:()=>({W,H})\n  });\n  if(!specialItemSystem) throw new Error('Puppetalk special items failed to load.');\n  const {specialItemLabel,specialItemType,specialItemStillOut,bringOutSpecialItem,handleSpecialItemInput} = specialItemSystem;\n`;
if(!build.includes('window.PuppetalkSpecialItems?.create?.')) build=insertAfter(build,'special item setup',inputBinding,specialSetup);

const oldPropInputExtraction=`removeBetweenOnce(\n  'embedded prop input',\n  \`  function propHandIsClose(slot,hand,prop){\`,\n  \`  function specialItemLabel(type){\`\n);\n\n`;
if(build.includes(oldPropInputExtraction)){
  build=replaceOnce(build,'old prop input extraction',oldPropInputExtraction,'');
}

const constantsExtraction=`replaceOnce('embedded special item constants',\`  const SPECIAL_ITEM_TYPES = ['frisbee','pump','ball','dart'];\n  const SPECIAL_ITEM_BY_SLOT = ['frisbee','pump','ball','dart','frisbee','pump'];\n\`,\`\`);\n\n`;
const combinedExtraction=`removeBetweenOnce(\n  'embedded prop input and special items',\n  \`  function propHandIsClose(slot,hand,prop){\`,\n  \`  function tagHiddenSegment(body,slot,part,segment){\`\n);\n\n`;
const rigMarker="removeBetweenOnce(\n  'embedded rig construction',";
if(!build.includes("'embedded special item constants'")){
  build=insertBefore(build,'special item constants extraction',rigMarker,constantsExtraction);
}
if(!build.includes("'embedded prop input and special items'")){
  build=insertBefore(build,'combined prop/special extraction',rigMarker,combinedExtraction);
}
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const inputModuleAssert="assert.match(actual,/PuppetalkPropInput/,'Translated runtime is not connected to extracted prop input.');\n";
const specialModuleAssert="assert.match(actual,/PuppetalkSpecialItems/,'Translated runtime is not connected to extracted special items.');\n";
if(!parity.includes(specialModuleAssert.trim())) parity=insertAfter(parity,'special item module assertion',inputModuleAssert,specialModuleAssert);

const inputNegative="assert.doesNotMatch(actual,/function handlePropInput\\(slot,msg\\)/,'Embedded handlePropInput survived prop-input extraction.');\n";
const specialNegatives="assert.doesNotMatch(actual,/const SPECIAL_ITEM_TYPES =/,'Embedded SPECIAL_ITEM_TYPES survived special-item extraction.');\nassert.doesNotMatch(actual,/const SPECIAL_ITEM_BY_SLOT =/,'Embedded SPECIAL_ITEM_BY_SLOT survived special-item extraction.');\nassert.doesNotMatch(actual,/function specialItemLabel\\(type\\)/,'Embedded specialItemLabel survived special-item extraction.');\nassert.doesNotMatch(actual,/function specialItemType\\(slot,requested\\)/,'Embedded specialItemType survived special-item extraction.');\nassert.doesNotMatch(actual,/function specialItemStillOut\\(slot\\)/,'Embedded specialItemStillOut survived special-item extraction.');\nassert.doesNotMatch(actual,/function bringOutSpecialItem\\(slot,requested\\)/,'Embedded bringOutSpecialItem survived special-item extraction.');\nassert.doesNotMatch(actual,/function handleSpecialItemInput\\(slot,msg\\)/,'Embedded handleSpecialItemInput survived special-item extraction.');\n";
if(!parity.includes('Embedded handleSpecialItemInput survived special-item extraction.')) parity=insertAfter(parity,'special item negative assertions',inputNegative,specialNegatives);

const inputBindingAssert="assert.match(actual,/const \\{propHandIsClose,tapProp,releaseAllPropGrips,throwHeldProp,handlePropInput\\} = propInputSystem;/,'Runtime is not bound to extracted prop input.');\n";
const specialBindingAssert="assert.match(actual,/const \\{specialItemLabel,specialItemType,specialItemStillOut,bringOutSpecialItem,handleSpecialItemInput\\} = specialItemSystem;/,'Runtime is not bound to extracted special items.');\n";
if(!parity.includes(specialBindingAssert.trim())) parity=insertAfter(parity,'special item binding assertion',inputBindingAssert,specialBindingAssert);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const inputScript='  <script src="./translation/props/prop-input.js?v=1"></script>\n';
const specialScript='  <script src="./translation/props/special-items.js?v=1"></script>\n';
if(!html.includes(specialScript.trim())) html=insertAfter(html,'special item script',inputScript,specialScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedInput="expectedRuntime.push('./translation/props/prop-input.js?v=1');\n";
const expectedSpecial="expectedRuntime.push('./translation/props/special-items.js?v=1');\n";
if(!entry.includes(expectedSpecial.trim())) entry=insertAfter(entry,'expected special item module',expectedInput,expectedSpecial);
const actualInput="assert.ok(actualScripts.includes('./translation/props/prop-input.js?v=1'),'Extracted prop input is missing.');\n";
const actualSpecial="assert.ok(actualScripts.includes('./translation/props/special-items.js?v=1'),'Extracted special item module is missing.');\n";
if(!entry.includes(actualSpecial.trim())) entry=insertAfter(entry,'special item entry assertion',actualInput,actualSpecial);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared special-item extraction against the current translated prop stack.');
