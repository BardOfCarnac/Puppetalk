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
const liftBinding=`  const {tieBalloonToBody,driveAttachedBalloon} = balloonLift;\n`;
const driverSetup=`  const propDriver = window.PuppetalkPropDriver?.create?.({\n    props,propGrips,gripKey,cancelPropContest,promotePropContest,clamp,\n    Body,engine,driveAttachedBalloon,syncAttachedProp,driveDartBalloonPops,\n    now:()=>performance.now()\n  });\n  if(!propDriver) throw new Error('Puppetalk prop driver failed to load.');\n  const {updatePropContest,driveProps} = propDriver;\n`;
if(!build.includes('window.PuppetalkPropDriver?.create?.')) build=insertAfter(build,'prop driver setup',liftBinding,driverSetup);

const balloonPopsExtraction=`removeBetweenOnce(\n  'embedded balloon pops',`;
const contestExtraction=`removeBetweenOnce(\n  'embedded prop contest driver',\n  \`  function updatePropContest(prop,now){\`,\n  \`  function distancePointToSegment(point,a,b){\`\n);\n\n`;
if(!build.includes("'embedded prop contest driver'")) build=insertBefore(build,'prop contest extraction',balloonPopsExtraction,contestExtraction);

const propStateExtraction=`removeBetweenOnce(\n  'embedded prop state serializer',`;
const driveExtraction=`removeBetweenOnce(\n  'embedded generic prop driver',\n  \`  function driveProps(){\`,\n  \`  function propState(prop){\`\n);\n\n`;
if(!build.includes("'embedded generic prop driver'")) build=insertBefore(build,'generic prop drive extraction',propStateExtraction,driveExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const liftModule="assert.match(actual,/PuppetalkBalloonLift/,'Translated runtime is not connected to extracted balloon lift.');\n";
const driverModule="assert.match(actual,/PuppetalkPropDriver/,'Translated runtime is not connected to extracted prop driver.');\n";
if(!parity.includes(driverModule.trim())) parity=insertAfter(parity,'prop driver module assertion',liftModule,driverModule);

const liftNegative="assert.doesNotMatch(actual,/function driveAttachedBalloon\\(prop,now\\)/,'Embedded driveAttachedBalloon survived balloon-lift extraction.');\n";
const driverNegatives="assert.doesNotMatch(actual,/function updatePropContest\\(prop,now\\)/,'Embedded updatePropContest survived prop-driver extraction.');\nassert.doesNotMatch(actual,/function driveProps\\(\\)/,'Embedded driveProps survived prop-driver extraction.');\n";
if(!parity.includes('Embedded driveProps survived prop-driver extraction.')) parity=insertAfter(parity,'prop driver negative assertions',liftNegative,driverNegatives);

const liftBindingAssert="assert.match(actual,/const \\{tieBalloonToBody,driveAttachedBalloon\\} = balloonLift;/,'Runtime is not bound to extracted balloon lift.');\n";
const driverBinding="assert.match(actual,/const \\{updatePropContest,driveProps\\} = propDriver;/,'Runtime is not bound to extracted prop driver.');\n";
if(!parity.includes(driverBinding.trim())) parity=insertAfter(parity,'prop driver binding assertion',liftBindingAssert,driverBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const popScript='  <script src="./translation/props/balloon-pops.js?v=1"></script>\n';
const driverScript='  <script src="./translation/props/prop-driver.js?v=1"></script>\n';
if(!html.includes(driverScript.trim())) html=insertAfter(html,'prop driver script',popScript,driverScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedPop="expectedRuntime.push('./translation/props/balloon-pops.js?v=1');\n";
const expectedDriver="expectedRuntime.push('./translation/props/prop-driver.js?v=1');\n";
if(!entry.includes(expectedDriver.trim())) entry=insertAfter(entry,'expected prop driver module',expectedPop,expectedDriver);
const actualPop="assert.ok(actualScripts.includes('./translation/props/balloon-pops.js?v=1'),'Extracted balloon pop module is missing.');\n";
const actualDriver="assert.ok(actualScripts.includes('./translation/props/prop-driver.js?v=1'),'Extracted generic prop driver is missing.');\n";
if(!entry.includes(actualDriver.trim())) entry=insertAfter(entry,'prop driver entry assertion',actualPop,actualDriver);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared generic prop-driver extraction against the current translated runtime.');
