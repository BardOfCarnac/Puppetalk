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
const geometrySetup=`  const propGeometry = window.PuppetalkPropGeometry?.create?.({puppets,props,grabWorldPoint,clamp,Vector});`;
const factorySetup=`  const propFactory = window.PuppetalkPropFactory?.create?.({\n    Bodies,Composite,engine,props,getDimensions:()=>({W,H})\n  });\n  if(!propFactory) throw new Error('Puppetalk prop factory failed to load.');\n  const {makeProp,ensureTestProps,ensureLegacyTestProps} = propFactory;\n`;
if(!build.includes('window.PuppetalkPropFactory?.create?.')) build=insertBefore(build,'prop factory setup',geometrySetup,factorySetup);

const jointExtraction=`replaceOnce('embedded joint constructor',`;
const factoryExtraction=`replaceOnce('embedded prop id counter',\`  let nextPropId = 1;\n\`,\`\`);\n\nremoveBetweenOnce(\n  'embedded prop factory',\n  \`  function makeProp(type,x,y){\`,\n  \`  function updatePropContest(prop,now){\`\n);\n\n`;
if(!build.includes("'embedded prop factory'")) build=insertBefore(build,'prop factory extraction',jointExtraction,factoryExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const stateModule="assert.match(actual,/PuppetalkPropState/,'Translated runtime is not connected to extracted prop state.');\n";
const factoryModule="assert.match(actual,/PuppetalkPropFactory/,'Translated runtime is not connected to extracted prop factory.');\n";
if(!parity.includes(factoryModule.trim())) parity=insertAfter(parity,'prop factory module assertion',stateModule,factoryModule);

const stateNegative="assert.doesNotMatch(actual,/function propState\\(prop\\)/,'Embedded propState survived prop-state extraction.');\n";
const factoryNegatives="assert.doesNotMatch(actual,/let nextPropId = 1;/,'Embedded prop ID counter survived prop-factory extraction.');\nassert.doesNotMatch(actual,/function makeProp\\(type,x,y\\)/,'Embedded makeProp survived prop-factory extraction.');\nassert.doesNotMatch(actual,/function ensureTestProps\\(\\)/,'Embedded ensureTestProps survived prop-factory extraction.');\nassert.doesNotMatch(actual,/function ensureLegacyTestProps\\(\\)/,'Embedded ensureLegacyTestProps survived prop-factory extraction.');\n";
if(!parity.includes('Embedded ensureLegacyTestProps survived prop-factory extraction.')) parity=insertAfter(parity,'prop factory negative assertions',stateNegative,factoryNegatives);

const stateBinding="assert.match(actual,/const \\{balloonAttachmentState,propState\\} = propStateSystem;/,'Runtime is not bound to extracted prop state.');\n";
const factoryBinding="assert.match(actual,/const \\{makeProp,ensureTestProps,ensureLegacyTestProps\\} = propFactory;/,'Runtime is not bound to extracted prop factory.');\n";
if(!parity.includes(factoryBinding.trim())) parity=insertAfter(parity,'prop factory binding assertion',stateBinding,factoryBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const geometryScript='  <script src="./translation/props/prop-geometry.js?v=1"></script>\n';
const factoryScript='  <script src="./translation/props/prop-factory.js?v=1"></script>\n';
if(!html.includes(factoryScript.trim())) html=insertBefore(html,'prop factory script',geometryScript,factoryScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedGeometry="expectedRuntime.push('./translation/props/prop-geometry.js?v=1');\n";
const expectedFactory="expectedRuntime.push('./translation/props/prop-factory.js?v=1');\n";
if(!entry.includes(expectedFactory.trim())) entry=insertBefore(entry,'expected prop factory module',expectedGeometry,expectedFactory);
const actualGeometry="assert.ok(actualScripts.includes('./translation/props/prop-geometry.js?v=1'),'Extracted prop geometry is missing.');\n";
const actualFactory="assert.ok(actualScripts.includes('./translation/props/prop-factory.js?v=1'),'Extracted prop factory is missing.');\n";
if(!entry.includes(actualFactory.trim())) entry=insertBefore(entry,'prop factory entry assertion',actualGeometry,actualFactory);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared prop-factory extraction against the current translated runtime.');
