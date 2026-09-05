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
const attachmentBinding=`  const {attachPropToBody,detachPropAttachment,syncAttachedProp} = propAttachmentCore;\n`;
const inputSetup=`  const propInputSystem = window.PuppetalkPropInput?.create?.({\n    props,conns,puppets,send,validPropEffector,handPoint,freePropHand,detachPropAttachment,beginPropHold,\n    nearestBalloonTarget,tieBalloonToBody,cancelPropContest,promotePropContest,beginPropContest,\n    releasePropHolder,gripRecord,handBody,clamp,Body,inflatePumpBalloon,releasePumpBalloon,\n    getDimensions:()=>({W,H}),now:()=>performance.now(),\n    getDepthForSlot:slot=>window.PuppetalkDepthState?.getDepthForSlot?.(slot) || 0,\n    projectPropPoint:puppetalkAimProjectPropPoint\n  });\n  if(!propInputSystem) throw new Error('Puppetalk prop input failed to load.');\n  const {propHandIsClose,tapProp,releaseAllPropGrips,throwHeldProp,handlePropInput} = propInputSystem;\n`;
if(!build.includes('window.PuppetalkPropInput?.create?.')) build=insertAfter(build,'prop input setup',attachmentBinding,inputSetup);

const inputExtraction=`removeBetweenOnce(\n  'embedded prop input',\n  \`  function propHandIsClose(slot,hand,prop){\`,\n  \`  function specialItemLabel(type){\`\n);\n\n`;
if(!build.includes("'embedded prop input'")){
  build=insertBefore(build,'prop input extraction operation',"removeBetweenOnce(\n  'embedded prop geometry',",inputExtraction);
}
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const attachmentModuleAssert="assert.match(actual,/PuppetalkPropAttachmentCore/,'Translated runtime is not connected to extracted prop attachment core.');\n";
const inputModuleAssert="assert.match(actual,/PuppetalkPropInput/,'Translated runtime is not connected to extracted prop input.');\n";
if(!parity.includes(inputModuleAssert.trim())) parity=insertAfter(parity,'prop input module assertion',attachmentModuleAssert,inputModuleAssert);

const attachmentNegative="assert.doesNotMatch(actual,/function syncAttachedProp\\(prop\\)/,'Embedded syncAttachedProp survived prop-attachment extraction.');\n";
const inputNegatives="assert.doesNotMatch(actual,/function propHandIsClose\\(slot,hand,prop\\)/,'Embedded propHandIsClose survived prop-input extraction.');\nassert.doesNotMatch(actual,/function tapProp\\(slot,msg\\)/,'Embedded tapProp survived prop-input extraction.');\nassert.doesNotMatch(actual,/function releaseAllPropGrips\\(slot\\)/,'Embedded releaseAllPropGrips survived prop-input extraction.');\nassert.doesNotMatch(actual,/function throwHeldProp\\(slot,msg\\)/,'Embedded throwHeldProp survived prop-input extraction.');\nassert.doesNotMatch(actual,/function handlePropInput\\(slot,msg\\)/,'Embedded handlePropInput survived prop-input extraction.');\n";
if(!parity.includes('Embedded handlePropInput survived prop-input extraction.')) parity=insertAfter(parity,'prop input negative assertions',attachmentNegative,inputNegatives);

const attachmentBindingAssert="assert.match(actual,/const \\{attachPropToBody,detachPropAttachment,syncAttachedProp\\} = propAttachmentCore;/,'Runtime is not bound to the extracted prop attachment core.');\n";
const inputBindingAssert="assert.match(actual,/const \\{propHandIsClose,tapProp,releaseAllPropGrips,throwHeldProp,handlePropInput\\} = propInputSystem;/,'Runtime is not bound to extracted prop input.');\n";
if(!parity.includes(inputBindingAssert.trim())) parity=insertAfter(parity,'prop input binding assertion',attachmentBindingAssert,inputBindingAssert);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const attachmentScript='  <script src="./translation/props/attachment-core.js?v=1"></script>\n';
const inputScript='  <script src="./translation/props/prop-input.js?v=1"></script>\n';
if(!html.includes(inputScript.trim())) html=insertAfter(html,'prop input script',attachmentScript,inputScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedAttachment="expectedRuntime.push('./translation/props/attachment-core.js?v=1');\n";
const expectedInput="expectedRuntime.push('./translation/props/prop-input.js?v=1');\n";
if(!entry.includes(expectedInput.trim())) entry=insertAfter(entry,'expected prop input module',expectedAttachment,expectedInput);
const actualAttachment="assert.ok(actualScripts.includes('./translation/props/attachment-core.js?v=1'),'Extracted prop attachment core is missing.');\n";
const actualInput="assert.ok(actualScripts.includes('./translation/props/prop-input.js?v=1'),'Extracted prop input is missing.');\n";
if(!entry.includes(actualInput.trim())) entry=insertAfter(entry,'prop input entry assertion',actualAttachment,actualInput);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared prop-input extraction against the current translated prop stack.');
