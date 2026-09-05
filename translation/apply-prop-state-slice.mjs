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

let build=read('translation/build-runtime.mjs');
const geometryBinding=`  const {handBody,handPoint,propGripLocalPoint,validPropEffector,gripKey,ATTACHABLE_PARTS,puppetPartForBody,propForBody,closestPointOnBody,nearestBalloonTarget,localOffset,worldOffset} = propGeometry;\n`;
const stateSetup=`  const propStateSystem = window.PuppetalkPropState?.create?.({\n    getDimensions:()=>({W,H}),worldOffset,clamp\n  });\n  if(!propStateSystem) throw new Error('Puppetalk prop state failed to load.');\n  const {balloonAttachmentState,propState} = propStateSystem;\n`;
if(!build.includes('window.PuppetalkPropState?.create?.')) build=insertAfter(build,'prop state setup',geometryBinding,stateSetup);

const balloonAttachmentState=`  function balloonAttachmentState(prop){\n    const a = prop?.attachedTo;\n    if(!a) return null;\n    const anchor = a.body ? worldOffset(a.body,a.offset) : null;\n    return {\n      slot:a.slot,\n      part:a.part,\n      mode:a.mode || 'embedded',\n      anchor:anchor ? {x:anchor.x/W,y:anchor.y/H} : null\n    };\n  }\n`;
if(build.includes(balloonAttachmentState)) build=replaceOnce(build,'embedded balloon attachment state',balloonAttachmentState,'');

const propState=`  function propState(prop){\n    const b = prop.body;\n    return {\n      id:prop.id,\n      type:prop.type,\n      depth:Number.isFinite(prop._depth) ? prop._depth : undefined,\n      throwerSlot:Number.isInteger(prop._throwerSlot) ? prop._throwerSlot : undefined,\n      armed:prop.type === 'frisbee' ? !!prop._cutArmed : undefined,\n      inflation:prop.type === 'balloon' ? (prop._inflation||0) : undefined,\n      scale:prop.type === 'balloon' ? (prop._renderScale||1) : undefined,\n      pumpBalloon:prop.type === 'pump' ? (prop._balloonId||null) : undefined,\n      x:b.position.x/W,\n      y:b.position.y/H,\n      a:b.angle || 0,\n      heldBy:prop.heldBy ? {slot:prop.heldBy.slot,hand:prop.heldBy.hand} : null,\n      contestedBy:prop.contest ? {slot:prop.contest.slot,hand:prop.contest.hand} : null,\n      tug:prop.contest ? clamp(prop.contest.score,0,1) : 0,\n      attachedTo:balloonAttachmentState(prop)\n    };\n  }\n`;
if(build.includes(propState)) build=replaceOnce(build,'embedded prop state serializer',propState,'');
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const geometryModuleAssert="assert.match(actual,/PuppetalkPropGeometry/,'Translated runtime is not connected to extracted prop geometry.');\n";
const stateModuleAssert="assert.match(actual,/PuppetalkPropState/,'Translated runtime is not connected to extracted prop state.');\n";
if(!parity.includes(stateModuleAssert.trim())) parity=insertAfter(parity,'prop state module assertion',geometryModuleAssert,stateModuleAssert);

const geometryNegative="assert.doesNotMatch(actual,/function nearestBalloonTarget\\(prop,slot,hand\\)/,'Embedded nearestBalloonTarget survived prop-geometry extraction.');\n";
const stateNegatives="assert.doesNotMatch(actual,/function balloonAttachmentState\\(prop\\)/,'Embedded balloonAttachmentState survived prop-state extraction.');\nassert.doesNotMatch(actual,/function propState\\(prop\\)/,'Embedded propState survived prop-state extraction.');\n";
if(!parity.includes('Embedded propState survived prop-state extraction.')) parity=insertAfter(parity,'prop state negative assertions',geometryNegative,stateNegatives);

const geometryBindingAssert="assert.match(actual,/const \\{handBody,handPoint,propGripLocalPoint,validPropEffector,gripKey,ATTACHABLE_PARTS,puppetPartForBody,propForBody,closestPointOnBody,nearestBalloonTarget,localOffset,worldOffset\\} = propGeometry;/,'Runtime is not bound to extracted prop geometry.');\n";
const stateBindingAssert="assert.match(actual,/const \\{balloonAttachmentState,propState\\} = propStateSystem;/,'Runtime is not bound to extracted prop state.');\n";
if(!parity.includes(stateBindingAssert.trim())) parity=insertAfter(parity,'prop state binding assertion',geometryBindingAssert,stateBindingAssert);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const geometryScript='  <script src="./translation/props/prop-geometry.js?v=1"></script>\n';
const stateScript='  <script src="./translation/props/prop-state.js?v=1"></script>\n';
if(!html.includes(stateScript.trim())) html=insertAfter(html,'prop state script',geometryScript,stateScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedGeometry="expectedRuntime.push('./translation/props/prop-geometry.js?v=1');\n";
const expectedState="expectedRuntime.push('./translation/props/prop-state.js?v=1');\n";
if(!entry.includes(expectedState.trim())) entry=insertAfter(entry,'expected prop state module',expectedGeometry,expectedState);
const actualGeometry="assert.ok(actualScripts.includes('./translation/props/prop-geometry.js?v=1'),'Extracted prop geometry is missing.');\n";
const actualState="assert.ok(actualScripts.includes('./translation/props/prop-state.js?v=1'),'Extracted prop state serializer is missing.');\n";
if(!entry.includes(actualState.trim())) entry=insertAfter(entry,'prop state entry assertion',actualGeometry,actualState);
write('translation/entry-smoke.mjs',entry);

let workflow=read('.github/workflows/translation-props.yml');
const geometrySmoke='      - run: node translation/props/prop-geometry-smoke.mjs\n';
const stateChecks='      - run: node --check translation/props/prop-state.js\n      - run: node translation/props/prop-state-smoke.mjs\n';
if(!workflow.includes('translation/props/prop-state-smoke.mjs')) workflow=insertAfter(workflow,'prop state CI checks',geometrySmoke,stateChecks);
write('.github/workflows/translation-props.yml',workflow);

console.log('Prepared prop-state extraction against the current translated prop stack.');
