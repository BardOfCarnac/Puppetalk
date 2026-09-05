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
const gripBinding=`  const {gripRecord,freePropHand,clearPropGrip,makePropGrip,cancelPropContest,promotePropContest,releasePropHolder,beginPropHold,beginPropContest} = propGripCore;\n`;
const popSetup=`  const balloonPops = window.PuppetalkBalloonPops?.create?.({\n    props,cancelPropContest,releasePropHolder,Composite,engine,Vector,clamp,Body\n  });\n  if(!balloonPops) throw new Error('Puppetalk balloon pops failed to load.');\n  const {distancePointToSegment,dartTouchesBalloon,popBalloon,driveDartBalloonPops} = balloonPops;\n`;
if(!build.includes('window.PuppetalkBalloonPops?.create?.')) build=insertAfter(build,'balloon pop setup',gripBinding,popSetup);

const factoryExtraction=`removeBetweenOnce(\n  'embedded prop factory',`;
const popExtraction=`removeBetweenOnce(\n  'embedded balloon pops',\n  \`  function distancePointToSegment(point,a,b){\`,\n  \`  function pointSegmentDistance(point,a,b){\`\n);\n\n`;
if(!build.includes("'embedded balloon pops'")) build=insertAfter(build,'balloon pop extraction',factoryExtraction,popExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const pumpModule="assert.match(actual,/PuppetalkPumpBalloon/,'Translated runtime is not connected to extracted pump balloon lifecycle.');\n";
const popModule="assert.match(actual,/PuppetalkBalloonPops/,'Translated runtime is not connected to extracted balloon pops.');\n";
if(!parity.includes(popModule.trim())) parity=insertAfter(parity,'balloon pop module assertion',pumpModule,popModule);

const pumpNegative="assert.doesNotMatch(actual,/function releasePumpBalloon\\(balloon\\)/,'Embedded releasePumpBalloon survived pump-balloon extraction.');\n";
const popNegatives="assert.doesNotMatch(actual,/function distancePointToSegment\\(point,a,b\\)/,'Embedded distancePointToSegment survived balloon-pop extraction.');\nassert.doesNotMatch(actual,/function dartTouchesBalloon\\(dart,balloon\\)/,'Embedded dartTouchesBalloon survived balloon-pop extraction.');\nassert.doesNotMatch(actual,/function popBalloon\\(balloon\\)/,'Embedded popBalloon survived balloon-pop extraction.');\nassert.doesNotMatch(actual,/function driveDartBalloonPops\\(\\)/,'Embedded driveDartBalloonPops survived balloon-pop extraction.');\n";
if(!parity.includes('Embedded driveDartBalloonPops survived balloon-pop extraction.')) parity=insertAfter(parity,'balloon pop negative assertions',pumpNegative,popNegatives);

const pumpBinding="assert.match(actual,/const \\{pumpNozzleOffset,ensurePumpBalloon,inflatePumpBalloon,releasePumpBalloon\\} = pumpBalloonSystem;/,'Runtime is not bound to extracted pump balloon lifecycle.');\n";
const popBinding="assert.match(actual,/const \\{distancePointToSegment,dartTouchesBalloon,popBalloon,driveDartBalloonPops\\} = balloonPops;/,'Runtime is not bound to extracted balloon pops.');\n";
if(!parity.includes(popBinding.trim())) parity=insertAfter(parity,'balloon pop binding assertion',pumpBinding,popBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const pumpScript='  <script src="./translation/props/pump-balloon.js?v=1"></script>\n';
const popScript='  <script src="./translation/props/balloon-pops.js?v=1"></script>\n';
if(!html.includes(popScript.trim())) html=insertAfter(html,'balloon pop script',pumpScript,popScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedPump="expectedRuntime.push('./translation/props/pump-balloon.js?v=1');\n";
const expectedPop="expectedRuntime.push('./translation/props/balloon-pops.js?v=1');\n";
if(!entry.includes(expectedPop.trim())) entry=insertAfter(entry,'expected balloon pop module',expectedPump,expectedPop);
const actualPump="assert.ok(actualScripts.includes('./translation/props/pump-balloon.js?v=1'),'Extracted pump balloon lifecycle is missing.');\n";
const actualPop="assert.ok(actualScripts.includes('./translation/props/balloon-pops.js?v=1'),'Extracted balloon pop module is missing.');\n";
if(!entry.includes(actualPop.trim())) entry=insertAfter(entry,'balloon pop entry assertion',actualPump,actualPop);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared balloon-pop extraction against the current translated runtime.');
