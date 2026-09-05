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
const geometryBinding=`  const {handBody,handPoint,propGripLocalPoint,validPropEffector,gripKey,ATTACHABLE_PARTS,puppetPartForBody,propForBody,closestPointOnBody,nearestBalloonTarget,localOffset,worldOffset} = propGeometry;\n`;
const stateSetup=`  const propStateSystem = window.PuppetalkPropState?.create?.({\n    getDimensions:()=>({W,H}),worldOffset,clamp\n  });\n  if(!propStateSystem) throw new Error('Puppetalk prop state failed to load.');\n  const {balloonAttachmentState,propState} = propStateSystem;\n`;
if(!build.includes('window.PuppetalkPropState?.create?.')) build=insertAfter(build,'prop state setup',geometryBinding,stateSetup);

const stateExtraction=`removeBetweenOnce(\n  'embedded prop state serializer',\n  \`  function propState(prop){\`,\n  \`  function handBody(p,hand){\`\n);\n\nremoveBetweenOnce(\n  'embedded balloon attachment state',\n  \`  function balloonAttachmentState(prop){\`,\n  \`  function localOffset(body,world){\`\n);\n\n`;
if(!build.includes("'embedded prop state serializer'")){
  build=insertBefore(build,'prop state extraction operations',"removeBetweenOnce(\n  'embedded prop attachment core',",stateExtraction);
}
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
