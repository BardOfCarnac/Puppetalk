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
const liftSetup=`  const balloonLift = window.PuppetalkBalloonLift?.create?.({\n    props,puppets,cancelPropContest,releasePropHolder,localOffset,worldOffset,\n    Body,syncAttachedProp,clamp\n  });\n  if(!balloonLift) throw new Error('Puppetalk balloon lift failed to load.');\n  const {tieBalloonToBody,driveAttachedBalloon} = balloonLift;\n`;
if(!build.includes('window.PuppetalkBalloonLift?.create?.')) build=insertAfter(build,'balloon lift setup',attachmentBinding,liftSetup);

const oldGeometryExtraction=`removeBetweenOnce(\n  'embedded prop geometry',\n  \`  function handBody(p,hand){\`,\n  \`  function tieBalloonToBody(prop,target){\`\n);\n\n`;
if(build.includes(oldGeometryExtraction)) build=replaceOnce(build,'old prop geometry extraction',oldGeometryExtraction,'');

const attachmentStateExtraction=`removeBetweenOnce(\n  'embedded balloon attachment state',`;
const liftExtraction=`removeBetweenOnce(\n  'embedded balloon lift',\n  \`  function tieBalloonToBody(prop,target){\`,\n  \`  function balloonAttachmentState(prop){\`\n);\n\n`;
if(!build.includes("'embedded balloon lift'")){
  build=insertBefore(build,'prop geometry and balloon lift extraction',attachmentStateExtraction,oldGeometryExtraction+liftExtraction);
}
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const popModule="assert.match(actual,/PuppetalkBalloonPops/,'Translated runtime is not connected to extracted balloon pops.');\n";
const liftModule="assert.match(actual,/PuppetalkBalloonLift/,'Translated runtime is not connected to extracted balloon lift.');\n";
if(!parity.includes(liftModule.trim())) parity=insertAfter(parity,'balloon lift module assertion',popModule,liftModule);

const popNegative="assert.doesNotMatch(actual,/function driveDartBalloonPops\\(\\)/,'Embedded driveDartBalloonPops survived balloon-pop extraction.');\n";
const liftNegatives="assert.doesNotMatch(actual,/function tieBalloonToBody\\(prop,target\\)/,'Embedded tieBalloonToBody survived balloon-lift extraction.');\nassert.doesNotMatch(actual,/function driveAttachedBalloon\\(prop,now\\)/,'Embedded driveAttachedBalloon survived balloon-lift extraction.');\n";
if(!parity.includes('Embedded driveAttachedBalloon survived balloon-lift extraction.')) parity=insertAfter(parity,'balloon lift negative assertions',popNegative,liftNegatives);

const popBinding="assert.match(actual,/const \\{distancePointToSegment,dartTouchesBalloon,popBalloon,driveDartBalloonPops\\} = balloonPops;/,'Runtime is not bound to extracted balloon pops.');\n";
const liftBinding="assert.match(actual,/const \\{tieBalloonToBody,driveAttachedBalloon\\} = balloonLift;/,'Runtime is not bound to extracted balloon lift.');\n";
if(!parity.includes(liftBinding.trim())) parity=insertAfter(parity,'balloon lift binding assertion',popBinding,liftBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const attachmentScript='  <script src="./translation/props/attachment-core.js?v=1"></script>\n';
const liftScript='  <script src="./translation/props/balloon-lift.js?v=1"></script>\n';
if(!html.includes(liftScript.trim())) html=insertAfter(html,'balloon lift script',attachmentScript,liftScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedAttachment="expectedRuntime.push('./translation/props/attachment-core.js?v=1');\n";
const expectedLift="expectedRuntime.push('./translation/props/balloon-lift.js?v=1');\n";
if(!entry.includes(expectedLift.trim())) entry=insertAfter(entry,'expected balloon lift module',expectedAttachment,expectedLift);
const actualAttachment="assert.ok(actualScripts.includes('./translation/props/attachment-core.js?v=1'),'Extracted prop attachment core is missing.');\n";
const actualLift="assert.ok(actualScripts.includes('./translation/props/balloon-lift.js?v=1'),'Extracted balloon lift module is missing.');\n";
if(!entry.includes(actualLift.trim())) entry=insertAfter(entry,'balloon lift entry assertion',actualAttachment,actualLift);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared balloon-lift extraction against the current translated runtime.');
