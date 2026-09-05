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
const driverBinding=`  const {updatePropContest,driveProps} = propDriver;\n`;
const depthSetup=`  const depthAssist = window.PuppetalkDepthAssist?.create?.({\n    props,puppets,clamp,Body,getDimensions:()=>({W,H}),\n    getDepthState:()=>window.PuppetalkDepthState,\n    getForegroundTuning:()=>window.PuppetalkForegroundTuning\n  });\n  if(!depthAssist) throw new Error('Puppetalk depth assist failed to load.');\n  const {puppetalkAimProjectPoint,puppetalkAimProjectPropPoint,driveDepthAssistedProps} = depthAssist;\n`;
if(!build.includes('window.PuppetalkDepthAssist?.create?.')) build=insertAfter(build,'depth assist setup',driverBinding,depthSetup);

const specialConstants=`replaceOnce('embedded special item constants',`;
const depthExtraction=`removeBetweenOnce(\n  'embedded depth assist',\n  \`  const PUPPETALK_ACTION_DEPTH_TOLERANCE = .38;\`,\n  \`  function driveProps(){\`\n);\n\n`;
if(!build.includes("'embedded depth assist'")) build=insertBefore(build,'depth assist extraction',specialConstants,depthExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const frisbeeModule="assert.match(actual,/PuppetalkLaserFrisbee/,'Translated runtime is not connected to extracted laser frisbee.');\n";
const depthModule="assert.match(actual,/PuppetalkDepthAssist/,'Translated runtime is not connected to extracted depth assist.');\n";
if(!parity.includes(depthModule.trim())) parity=insertAfter(parity,'depth assist module assertion',frisbeeModule,depthModule);

const frisbeeNegative="assert.doesNotMatch(actual,/function driveLaserFrisbeeCuts\\(now\\)/,'Embedded driveLaserFrisbeeCuts survived laser-frisbee extraction.');\n";
const depthNegatives="assert.doesNotMatch(actual,/const PUPPETALK_ACTION_DEPTH_TOLERANCE = \\.38;/,'Embedded depth-assist constants survived extraction.');\nassert.doesNotMatch(actual,/function puppetalkActionProjectPuppetPoint\\(p,q,viewerSlot\\)/,'Embedded puppet depth projection survived extraction.');\nassert.doesNotMatch(actual,/function puppetalkAimProjectPropPoint\\(prop,viewerSlot\\)/,'Embedded prop depth projection survived extraction.');\nassert.doesNotMatch(actual,/function driveDepthAssistedProps\\(now\\)/,'Embedded driveDepthAssistedProps survived extraction.');\n";
if(!parity.includes('Embedded driveDepthAssistedProps survived extraction.')) parity=insertAfter(parity,'depth assist negative assertions',frisbeeNegative,depthNegatives);

const frisbeeBinding="assert.match(actual,/const \\{pointSegmentDistance,driveLaserFrisbeeCuts\\} = laserFrisbee;/,'Runtime is not bound to extracted laser frisbee.');\n";
const depthBinding="assert.match(actual,/const \\{puppetalkAimProjectPoint,puppetalkAimProjectPropPoint,driveDepthAssistedProps\\} = depthAssist;/,'Runtime is not bound to extracted depth assist.');\n";
if(!parity.includes(depthBinding.trim())) parity=insertAfter(parity,'depth assist binding assertion',frisbeeBinding,depthBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const driverScript='  <script src="./translation/props/prop-driver.js?v=1"></script>\n';
const depthScript='  <script src="./translation/props/depth-assist.js?v=1"></script>\n';
if(!html.includes(depthScript.trim())) html=insertAfter(html,'depth assist script',driverScript,depthScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedDriver="expectedRuntime.push('./translation/props/prop-driver.js?v=1');\n";
const expectedDepth="expectedRuntime.push('./translation/props/depth-assist.js?v=1');\n";
if(!entry.includes(expectedDepth.trim())) entry=insertAfter(entry,'expected depth assist module',expectedDriver,expectedDepth);
const actualDriver="assert.ok(actualScripts.includes('./translation/props/prop-driver.js?v=1'),'Extracted generic prop driver is missing.');\n";
const actualDepth="assert.ok(actualScripts.includes('./translation/props/depth-assist.js?v=1'),'Extracted prop depth assist is missing.');\n";
if(!entry.includes(actualDepth.trim())) entry=insertAfter(entry,'depth assist entry assertion',actualDriver,actualDepth);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared depth-assist extraction against the current translated runtime.');
