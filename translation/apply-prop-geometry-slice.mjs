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
function insertAfter(text,label,marker,addition){
  if(text.includes(addition.trim())) return text;
  return replaceOnce(text,label,marker,marker+addition);
}

let build=read('translation/build-runtime.mjs');
const oldSetup=`  const specialItems = new Map();\n  const propGripCore = window.PuppetalkPropGripCore?.create?.({\n    propGrips,gripKey:(slot,hand)=>String(slot)+':'+hand,\n    Composite,engine,puppets,handBody,propGripLocalPoint,Constraint\n  });`;
const newSetup=`  const specialItems = new Map();\n  const propGeometry = window.PuppetalkPropGeometry?.create?.({puppets,props,grabWorldPoint,clamp,Vector});\n  if(!propGeometry) throw new Error('Puppetalk prop geometry failed to load.');\n  const {handBody,handPoint,propGripLocalPoint,validPropEffector,gripKey,ATTACHABLE_PARTS,puppetPartForBody,propForBody,closestPointOnBody,nearestBalloonTarget,localOffset,worldOffset} = propGeometry;\n  const propGripCore = window.PuppetalkPropGripCore?.create?.({\n    propGrips,gripKey,\n    Composite,engine,puppets,handBody,propGripLocalPoint,Constraint\n  });`;
if(!build.includes('window.PuppetalkPropGeometry?.create?.')) build=replaceOnce(build,'prop geometry setup',oldSetup,newSetup);

const oldAttachment=`  const propAttachmentCore = window.PuppetalkPropAttachmentCore?.create?.({\n    Vector,Body,performance,cancelPropContest,releasePropHolder\n  });\n  if(!propAttachmentCore) throw new Error('Puppetalk prop attachment core failed to load.');\n  const {localOffset,worldOffset,attachPropToBody,detachPropAttachment,syncAttachedProp} = propAttachmentCore;`;
const newAttachment=`  const propAttachmentCore = window.PuppetalkPropAttachmentCore?.create?.({\n    Body,performance,cancelPropContest,releasePropHolder,localOffset,worldOffset\n  });\n  if(!propAttachmentCore) throw new Error('Puppetalk prop attachment core failed to load.');\n  const {attachPropToBody,detachPropAttachment,syncAttachedProp} = propAttachmentCore;`;
if(build.includes(oldAttachment)) build=replaceOnce(build,'attachment geometry ownership',oldAttachment,newAttachment);

if(!build.includes("'embedded prop geometry'")){
  const geometryRemoval=`removeBetweenOnce(\n  'embedded prop geometry',\n  \`  function handBody(p,hand){\`,\n  \`  function tieBalloonToBody(prop,target){\`\n);\n\n`;
  build=insertBefore(build,'prop geometry removal point',"removeBetweenOnce(\n  'embedded prop contact physics',",geometryRemoval);
}
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
if(!parity.includes("PuppetalkPropGeometry/,'Translated runtime is not connected to extracted prop geometry.")){
  parity=insertAfter(parity,'prop geometry module assertion',
    "assert.match(actual,/PuppetalkHostSession/,'Translated runtime is not connected to extracted host session.');\n",
    "assert.match(actual,/PuppetalkPropGeometry/,'Translated runtime is not connected to extracted prop geometry.');\n");
}
if(!parity.includes('Embedded handBody survived prop-geometry extraction.')){
  const negatives=`assert.doesNotMatch(actual,/function handBody\\(p,hand\\)/,'Embedded handBody survived prop-geometry extraction.');\nassert.doesNotMatch(actual,/function handPoint\\(p,hand\\)/,'Embedded handPoint survived prop-geometry extraction.');\nassert.doesNotMatch(actual,/function propGripLocalPoint\\(hand\\)/,'Embedded propGripLocalPoint survived prop-geometry extraction.');\nassert.doesNotMatch(actual,/function validPropEffector\\(hand\\)/,'Embedded validPropEffector survived prop-geometry extraction.');\nassert.doesNotMatch(actual,/function puppetPartForBody\\(body\\)/,'Embedded puppetPartForBody survived prop-geometry extraction.');\nassert.doesNotMatch(actual,/function propForBody\\(body\\)/,'Embedded propForBody survived prop-geometry extraction.');\nassert.doesNotMatch(actual,/function closestPointOnBody\\(body,point\\)/,'Embedded closestPointOnBody survived prop-geometry extraction.');\nassert.doesNotMatch(actual,/function nearestBalloonTarget\\(prop,slot,hand\\)/,'Embedded nearestBalloonTarget survived prop-geometry extraction.');\n`;
  parity=insertBefore(parity,'prop geometry negative assertions',
    "assert.doesNotMatch(actual,/function gripRecord\\(slot,hand\\)/,'Embedded gripRecord survived prop-grip extraction.');",negatives);
}
if(!parity.includes('Runtime is not bound to extracted prop geometry.')){
  const binding="assert.match(actual,/const \\{handBody,handPoint,propGripLocalPoint,validPropEffector,gripKey,ATTACHABLE_PARTS,puppetPartForBody,propForBody,closestPointOnBody,nearestBalloonTarget,localOffset,worldOffset\\} = propGeometry;/,'Runtime is not bound to extracted prop geometry.');\n";
  parity=insertBefore(parity,'prop geometry binding assertion',
    "assert.match(actual,/const \\{gripRecord,freePropHand,clearPropGrip,makePropGrip,cancelPropContest,promotePropContest,releasePropHolder,beginPropHold,beginPropContest\\} = propGripCore;/,'Runtime is not bound to the extracted prop grip core.');",binding);
}
const oldAttachmentBinding="assert.match(actual,/const \\{localOffset,worldOffset,attachPropToBody,detachPropAttachment,syncAttachedProp\\} = propAttachmentCore;/,'Runtime is not bound to the extracted prop attachment core.');";
const newAttachmentBinding="assert.match(actual,/const \\{attachPropToBody,detachPropAttachment,syncAttachedProp\\} = propAttachmentCore;/,'Runtime is not bound to the extracted prop attachment core.');";
if(parity.includes(oldAttachmentBinding)) parity=replaceOnce(parity,'attachment binding assertion',oldAttachmentBinding,newAttachmentBinding);
write('translation/runtime-parity-smoke.mjs',parity);

console.log('Prepared prop-geometry extraction against the current translated prop stack.');
