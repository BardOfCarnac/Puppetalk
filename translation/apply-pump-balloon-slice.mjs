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
const pumpSetup=`  const pumpBalloonSystem = window.PuppetalkPumpBalloon?.create?.({\n    props,makeProp,worldOffset,Body,syncAttachedProp,detachPropAttachment,\n    now:()=>performance.now(),random:()=>Math.random()\n  });\n  if(!pumpBalloonSystem) throw new Error('Puppetalk pump balloon lifecycle failed to load.');\n  const {pumpNozzleOffset,ensurePumpBalloon,inflatePumpBalloon,releasePumpBalloon} = pumpBalloonSystem;\n`;
if(!build.includes('window.PuppetalkPumpBalloon?.create?.')) build=insertAfter(build,'pump balloon setup',attachmentBinding,pumpSetup);

const specialConstants=`replaceOnce('embedded special item constants',`;
const pumpExtraction=`removeBetweenOnce(\n  'embedded pump balloon lifecycle',\n  \`  function pumpNozzleOffset(scale){\`,\n  \`  const PUPPETALK_ACTION_DEPTH_TOLERANCE = .38;\`\n);\n\n`;
if(!build.includes("'embedded pump balloon lifecycle'")) build=insertBefore(build,'pump balloon extraction',specialConstants,pumpExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const factoryModule="assert.match(actual,/PuppetalkPropFactory/,'Translated runtime is not connected to extracted prop factory.');\n";
const pumpModule="assert.match(actual,/PuppetalkPumpBalloon/,'Translated runtime is not connected to extracted pump balloon lifecycle.');\n";
if(!parity.includes(pumpModule.trim())) parity=insertAfter(parity,'pump balloon module assertion',factoryModule,pumpModule);

const factoryNegative="assert.doesNotMatch(actual,/function ensureLegacyTestProps\\(\\)/,'Embedded ensureLegacyTestProps survived prop-factory extraction.');\n";
const pumpNegatives="assert.doesNotMatch(actual,/function pumpNozzleOffset\\(scale\\)/,'Embedded pumpNozzleOffset survived pump-balloon extraction.');\nassert.doesNotMatch(actual,/function ensurePumpBalloon\\(pump\\)/,'Embedded ensurePumpBalloon survived pump-balloon extraction.');\nassert.doesNotMatch(actual,/function inflatePumpBalloon\\(pump\\)/,'Embedded inflatePumpBalloon survived pump-balloon extraction.');\nassert.doesNotMatch(actual,/function releasePumpBalloon\\(balloon\\)/,'Embedded releasePumpBalloon survived pump-balloon extraction.');\n";
if(!parity.includes('Embedded releasePumpBalloon survived pump-balloon extraction.')) parity=insertAfter(parity,'pump balloon negative assertions',factoryNegative,pumpNegatives);

const factoryBinding="assert.match(actual,/const \\{makeProp,ensureTestProps,ensureLegacyTestProps\\} = propFactory;/,'Runtime is not bound to extracted prop factory.');\n";
const pumpBinding="assert.match(actual,/const \\{pumpNozzleOffset,ensurePumpBalloon,inflatePumpBalloon,releasePumpBalloon\\} = pumpBalloonSystem;/,'Runtime is not bound to extracted pump balloon lifecycle.');\n";
if(!parity.includes(pumpBinding.trim())) parity=insertAfter(parity,'pump balloon binding assertion',factoryBinding,pumpBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const inputScript='  <script src="./translation/props/prop-input.js?v=1"></script>\n';
const pumpScript='  <script src="./translation/props/pump-balloon.js?v=1"></script>\n';
if(!html.includes(pumpScript.trim())) html=insertBefore(html,'pump balloon script',inputScript,pumpScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedInput="expectedRuntime.push('./translation/props/prop-input.js?v=1');\n";
const expectedPump="expectedRuntime.push('./translation/props/pump-balloon.js?v=1');\n";
if(!entry.includes(expectedPump.trim())) entry=insertBefore(entry,'expected pump balloon module',expectedInput,expectedPump);
const actualInput="assert.ok(actualScripts.includes('./translation/props/prop-input.js?v=1'),'Extracted prop input is missing.');\n";
const actualPump="assert.ok(actualScripts.includes('./translation/props/pump-balloon.js?v=1'),'Extracted pump balloon lifecycle is missing.');\n";
if(!entry.includes(actualPump.trim())) entry=insertBefore(entry,'pump balloon entry assertion',actualInput,actualPump);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared pump-balloon extraction against the current translated runtime.');
