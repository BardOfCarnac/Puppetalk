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
const firstExtraction="replaceOnce('pose/grab constants',";
const lookExtraction=`removeBetweenOnce(\n  'embedded look model',\n  \`const LOOK_PALETTE = ['#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8','#d79b75','#8a6d5b','#d9c3a7','#7e8794','#d65050','#5b8fd1'];\`,\n  \`const PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];\`\n);\n\nreplaceOnce(\n  'look model setup point',\n  \`const PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];\`,\n  \`const {LOOK_PALETTE,LOOK_PARTS,defaultLook,cleanLook} = window.PuppetalkLookModel || {};\nif(!LOOK_PALETTE || !LOOK_PARTS || !defaultLook || !cleanLook){\n  throw new Error('Puppetalk look model failed to load.');\n}\n\nconst PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];\`\n);\n\n`;
if(!build.includes("'embedded look model'")) build=insertBefore(build,'look model extraction',firstExtraction,lookExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const rigModule="assert.match(actual,/PuppetalkCharacterRigCore/,'Translated runtime is not connected to extracted rig core.');\n";
const lookModule="assert.match(actual,/PuppetalkLookModel/,'Translated runtime is not connected to extracted character look model.');\n";
if(!parity.includes(lookModule.trim())) parity=insertBefore(parity,'look model module assertion',rigModule,lookModule);

const firstNegative="assert.doesNotMatch(actual,/function makePuppet\\(slot\\)/,'Embedded makePuppet survived rig-factory extraction.');\n";
const lookNegatives="assert.doesNotMatch(actual,/const LOOK_PALETTE = \\[/,'Embedded LOOK_PALETTE survived look-model extraction.');\nassert.doesNotMatch(actual,/function defaultLook\\(slot=0\\)/,'Embedded defaultLook survived look-model extraction.');\nassert.doesNotMatch(actual,/function cleanLook\\(value,slot=0\\)/,'Embedded cleanLook survived look-model extraction.');\n";
if(!parity.includes('Embedded cleanLook survived look-model extraction.')) parity=insertBefore(parity,'look model negative assertions',firstNegative,lookNegatives);

const firstBinding="assert.match(actual,/const \\{makePuppet\\} = rigFactory;/,'Runtime callers are not bound to the extracted makePuppet.');\n";
const lookBinding="assert.match(actual,/const \\{LOOK_PALETTE,LOOK_PARTS,defaultLook,cleanLook\\} = window\\.PuppetalkLookModel \\|\\| \\{\\};/,'Runtime is not bound to the extracted look model.');\n";
if(!parity.includes('Runtime is not bound to the extracted look model.')) parity=insertBefore(parity,'look model binding assertion',firstBinding,lookBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const rigScript='  <script src="./translation/character/rig-core.js?v=1"></script>\n';
const lookScript='  <script src="./translation/character/look-model.js?v=1"></script>\n';
if(!html.includes(lookScript.trim())) html=insertBefore(html,'look model script',rigScript,lookScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedRig="expectedRuntime.push('./translation/character/rig-core.js?v=1');\n";
const expectedLook="expectedRuntime.push('./translation/character/look-model.js?v=1');\n";
if(!entry.includes(expectedLook.trim())) entry=insertBefore(entry,'expected look model module',expectedRig,expectedLook);
const actualRig="assert.ok(actualScripts.includes('./translation/character/rig-core.js?v=1'),'Extracted character rig core is missing.');\n";
const actualLook="assert.ok(actualScripts.includes('./translation/character/look-model.js?v=1'),'Extracted character look model is missing.');\n";
if(!entry.includes(actualLook.trim())) entry=insertBefore(entry,'look model entry assertion',actualRig,actualLook);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared character look-model extraction against the current translated runtime.');
