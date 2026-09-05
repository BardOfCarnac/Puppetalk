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

let build=read('translation/build-runtime.mjs');
const itemExtraction=`removeBetweenOnce(\n  'embedded controller special-item helpers',`;
const puppetryExtraction=`replaceOnce(\n  'embedded controller active pointer state',\n  \`  const activePointers = new Map();\n\`,\n  \`\`\n);\n\nreplaceOnce(\n  'embedded controller grab sync',\n  \`  function syncGrabs(){ input.grabs = [...activePointers.values()].slice(0,2).map(g=>({part:g.part,x:g.x,y:g.y})); }\n\`,\n  \`\`\n);\n\nreplaceOnce(\n  'direct puppet interaction setup point',\n  \`  input.look = savedLook();\`,\n  \`  input.look = savedLook();\n\n  const puppetInteraction = window.PuppetalkControllerPuppetry?.create?.({\n    canvas,ctx,hint,input,clamp,\n    getScene:()=>scene,getPropScene:()=>propScene,getSlot:()=>slot,getDimensions:()=>({cw,ch}),\n    drawBackdrop,seatProjection:puppetalkSeatProjection,drawProp,drawAnatomy,transmit,\n    cancelCentre:()=>{ if(centreTimer){ clearTimeout(centreTimer); centreTimer = null; } }\n  });\n  if(!puppetInteraction) throw new Error('Puppetalk direct puppet interaction failed to load.');\n  const {\n    activePointers,myPuppet,grabSpots,renderGrabHandles,renderPersonalScene,\n    pointerToWorld,pickGrab,describeActiveGrabs\n  } = puppetInteraction;\`\n);\n\nremoveBetweenOnce(\n  'embedded direct puppet interaction',\n  \`  function myPuppet(){ return scene.find(p=>p.slot === slot); }\`,\n  \`  function propDisplayPoint(q){\`\n);\n\nreplaceOnce(\n  'direct puppet interaction install point',\n  \`  function propDisplayPoint(q){\`,\n  \`  puppetInteraction.install();\n\n  function propDisplayPoint(q){\`\n);\n\n`;
if(!build.includes("'embedded direct puppet interaction'")) build=insertBefore(build,'direct puppet interaction extraction',itemExtraction,puppetryExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const itemModule="assert.match(actual,/PuppetalkControllerItems/,'Translated runtime is not connected to extracted controller item interactions.');\n";
const puppetryModule="assert.match(actual,/PuppetalkControllerPuppetry/,'Translated runtime is not connected to extracted direct puppet interaction.');\n";
if(!parity.includes(puppetryModule.trim())) parity=insertBefore(parity,'direct puppetry module assertion',itemModule,puppetryModule);

const itemNegative="assert.doesNotMatch(actual,/function controllerSpecialType\\(\\)/,'Embedded controllerSpecialType survived item-interaction extraction.');\n";
const puppetryNegatives="assert.doesNotMatch(actual,/const activePointers = new Map\\(\\);/,'Embedded activePointers state survived direct-puppetry extraction.');\nassert.doesNotMatch(actual,/function syncGrabs\\(\\)/,'Embedded syncGrabs survived direct-puppetry extraction.');\nassert.doesNotMatch(actual,/function grabSpots\\(p\\)/,'Embedded grabSpots survived direct-puppetry extraction.');\nassert.doesNotMatch(actual,/function renderPersonalScene\\(\\)/,'Embedded renderPersonalScene survived direct-puppetry extraction.');\nassert.doesNotMatch(actual,/function pointerToWorld\\(event\\)/,'Embedded pointerToWorld survived direct-puppetry extraction.');\nassert.doesNotMatch(actual,/function pickGrab\\(event\\)/,'Embedded pickGrab survived direct-puppetry extraction.');\nassert.doesNotMatch(actual,/const stopPointer = event=>/,'Embedded stopPointer survived direct-puppetry extraction.');\n";
if(!parity.includes('Embedded stopPointer survived direct-puppetry extraction.')) parity=insertBefore(parity,'direct puppetry negative assertions',itemNegative,puppetryNegatives);

const itemBinding="assert.match(actual,/const itemInteraction = window\\.PuppetalkControllerItems\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted controller item interactions.');\n";
const puppetryBinding="assert.match(actual,/const puppetInteraction = window\\.PuppetalkControllerPuppetry\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted direct puppet interaction.');\nassert.match(actual,/puppetInteraction\\.install\\(\\);/,'Extracted direct puppet interaction is not installed.');\n";
if(!parity.includes('Extracted direct puppet interaction is not installed.')) parity=insertBefore(parity,'direct puppetry binding assertions',itemBinding,puppetryBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const itemScript='  <script src="./translation/controller/item-interactions.js?v=1"></script>\n';
const puppetryScript='  <script src="./translation/controller/puppet-interaction.js?v=1"></script>\n';
if(!html.includes(puppetryScript.trim())) html=insertBefore(html,'direct puppetry script',itemScript,puppetryScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedItem="expectedRuntime.push('./translation/controller/item-interactions.js?v=1');\n";
const expectedPuppetry="expectedRuntime.push('./translation/controller/puppet-interaction.js?v=1');\n";
if(!entry.includes(expectedPuppetry.trim())) entry=insertBefore(entry,'expected direct puppetry module',expectedItem,expectedPuppetry);
const actualItem="assert.ok(actualScripts.includes('./translation/controller/item-interactions.js?v=1'),'Extracted controller item interactions are missing.');\n";
const actualPuppetry="assert.ok(actualScripts.includes('./translation/controller/puppet-interaction.js?v=1'),'Extracted direct puppet interaction is missing.');\n";
if(!entry.includes(actualPuppetry.trim())) entry=insertBefore(entry,'direct puppetry entry assertion',actualItem,actualPuppetry);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared direct puppet interaction extraction against the current translated runtime.');
