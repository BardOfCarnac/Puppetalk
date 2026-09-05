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
const frisbeeSetup=`  const laserFrisbee = window.PuppetalkLaserFrisbee?.create?.({\n    props,puppets,clamp,puppetalkAimProjectPropPoint,puppetalkAimProjectPoint,\n    jointCutPoint,seamCutPoint,severSeam,severJoint,Body\n  });\n  if(!laserFrisbee) throw new Error('Puppetalk laser frisbee failed to load.');\n  const {pointSegmentDistance,driveLaserFrisbeeCuts} = laserFrisbee;\n`;
if(!build.includes('window.PuppetalkLaserFrisbee?.create?.')) build=insertAfter(build,'laser frisbee setup',driverBinding,frisbeeSetup);

const pumpExtraction=`removeBetweenOnce(\n  'embedded pump balloon lifecycle',`;
const frisbeeExtraction=`removeBetweenOnce(\n  'embedded laser frisbee',\n  \`  function pointSegmentDistance(point,a,b){\`,\n  \`  function pumpNozzleOffset(scale){\`\n);\n\n`;
if(!build.includes("'embedded laser frisbee'")) build=insertBefore(build,'laser frisbee extraction',pumpExtraction,frisbeeExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const driverModule="assert.match(actual,/PuppetalkPropDriver/,'Translated runtime is not connected to extracted prop driver.');\n";
const frisbeeModule="assert.match(actual,/PuppetalkLaserFrisbee/,'Translated runtime is not connected to extracted laser frisbee.');\n";
if(!parity.includes(frisbeeModule.trim())) parity=insertAfter(parity,'laser frisbee module assertion',driverModule,frisbeeModule);

const driverNegative="assert.doesNotMatch(actual,/function driveProps\\(\\)/,'Embedded driveProps survived prop-driver extraction.');\n";
const frisbeeNegatives="assert.doesNotMatch(actual,/function pointSegmentDistance\\(point,a,b\\)/,'Embedded pointSegmentDistance survived laser-frisbee extraction.');\nassert.doesNotMatch(actual,/function driveLaserFrisbeeCuts\\(now\\)/,'Embedded driveLaserFrisbeeCuts survived laser-frisbee extraction.');\n";
if(!parity.includes('Embedded driveLaserFrisbeeCuts survived laser-frisbee extraction.')) parity=insertAfter(parity,'laser frisbee negative assertions',driverNegative,frisbeeNegatives);

const driverBindingAssert="assert.match(actual,/const \\{updatePropContest,driveProps\\} = propDriver;/,'Runtime is not bound to extracted prop driver.');\n";
const frisbeeBinding="assert.match(actual,/const \\{pointSegmentDistance,driveLaserFrisbeeCuts\\} = laserFrisbee;/,'Runtime is not bound to extracted laser frisbee.');\n";
if(!parity.includes(frisbeeBinding.trim())) parity=insertAfter(parity,'laser frisbee binding assertion',driverBindingAssert,frisbeeBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const driverScript='  <script src="./translation/props/prop-driver.js?v=1"></script>\n';
const frisbeeScript='  <script src="./translation/props/laser-frisbee.js?v=1"></script>\n';
if(!html.includes(frisbeeScript.trim())) html=insertAfter(html,'laser frisbee script',driverScript,frisbeeScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedDriver="expectedRuntime.push('./translation/props/prop-driver.js?v=1');\n";
const expectedFrisbee="expectedRuntime.push('./translation/props/laser-frisbee.js?v=1');\n";
if(!entry.includes(expectedFrisbee.trim())) entry=insertAfter(entry,'expected laser frisbee module',expectedDriver,expectedFrisbee);
const actualDriver="assert.ok(actualScripts.includes('./translation/props/prop-driver.js?v=1'),'Extracted generic prop driver is missing.');\n";
const actualFrisbee="assert.ok(actualScripts.includes('./translation/props/laser-frisbee.js?v=1'),'Extracted laser frisbee module is missing.');\n";
if(!entry.includes(actualFrisbee.trim())) entry=insertAfter(entry,'laser frisbee entry assertion',actualDriver,actualFrisbee);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared laser-frisbee extraction against the current translated runtime.');
