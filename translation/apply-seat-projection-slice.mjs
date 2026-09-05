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
const finalSyntax=`new Function(source);`;
const projectionExtraction=`removeBetweenOnce(\n  'embedded seat projection',\n  \`const PUPPETALK_SEAT_ORDER = [0,3,1,4,2,5];\`,\n  \`function startController(room){\`\n);\n\nreplaceOnce(\n  'seat projection setup point',\n  \`function startController(room){\`,\n  \`const seatProjection = window.PuppetalkSeatProjection?.create?.({\n  getDepthState:()=>window.PuppetalkDepthState,\n  getForegroundTuning:()=>window.PuppetalkForegroundTuning\n});\nif(!seatProjection) throw new Error('Puppetalk seat projection failed to load.');\nconst {puppetalkSeatProjection} = seatProjection;\n\nfunction startController(room){\`\n);\n\n`;
if(!build.includes("'embedded seat projection'")) build=insertBefore(build,'seat projection extraction',finalSyntax,projectionExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const rendererModule="assert.match(actual,/PuppetalkSceneRenderer/,'Translated runtime is not connected to extracted shared scene renderer.');\n";
const projectionModule="assert.match(actual,/PuppetalkSeatProjection/,'Translated runtime is not connected to extracted seat projection.');\n";
if(!parity.includes(projectionModule.trim())) parity=insertAfter(parity,'seat projection module assertion',rendererModule,projectionModule);

const rendererNegative="assert.doesNotMatch(actual,/function roundRect\\(ctx,x,y,w,h,r\\)/,'Embedded roundRect survived scene-renderer extraction.');\n";
const projectionNegatives="assert.doesNotMatch(actual,/const PUPPETALK_SEAT_ORDER = \\[0,3,1,4,2,5\\];/,'Embedded seat ordering survived seat-projection extraction.');\nassert.doesNotMatch(actual,/const puppetalkPropOwners = new Map\\(\\);/,'Embedded sticky prop-owner map survived seat-projection extraction.');\nassert.doesNotMatch(actual,/function puppetalkSeatAngle\\(slot\\)/,'Embedded seat angle helper survived seat-projection extraction.');\nassert.doesNotMatch(actual,/function puppetalkProjectPuppet\\(p,viewerSlot\\)/,'Embedded puppet seat projection survived extraction.');\nassert.doesNotMatch(actual,/function puppetalkProjectProp\\(prop,metaBySlot,viewerSlot\\)/,'Embedded prop seat projection survived extraction.');\nassert.doesNotMatch(actual,/function puppetalkSeatProjection\\(puppets,props,viewerSlot\\)/,'Embedded seat projection entry point survived extraction.');\n";
if(!parity.includes('Embedded seat projection entry point survived extraction.')) parity=insertAfter(parity,'seat projection negative assertions',rendererNegative,projectionNegatives);

const rendererBinding="assert.match(actual,/const \\{drawBackdrop,drawAnatomy,drawProp,roundRect\\} = sceneRenderer;/,'Runtime callers are not bound to extracted shared scene renderer.');\n";
const projectionBinding="assert.match(actual,/const seatProjection = window\\.PuppetalkSeatProjection\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted seat projection.');\nassert.match(actual,/const \\{puppetalkSeatProjection\\} = seatProjection;/,'Runtime callers are not bound to extracted seat projection.');\n";
if(!parity.includes('Runtime callers are not bound to extracted seat projection.')) parity=insertAfter(parity,'seat projection binding assertions',rendererBinding,projectionBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const rendererScript='  <script src="./translation/render/scene-renderer.js?v=1"></script>\n';
const projectionScript='  <script src="./translation/render/seat-projection.js?v=1"></script>\n';
if(!html.includes(projectionScript.trim())) html=insertAfter(html,'seat projection script',rendererScript,projectionScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedRenderer="expectedRuntime.push('./translation/render/scene-renderer.js?v=1');\n";
const expectedProjection="expectedRuntime.push('./translation/render/seat-projection.js?v=1');\n";
if(!entry.includes(expectedProjection.trim())) entry=insertAfter(entry,'expected seat projection module',expectedRenderer,expectedProjection);
const actualRenderer="assert.ok(actualScripts.includes('./translation/render/scene-renderer.js?v=1'),'Extracted shared scene renderer is missing.');\n";
const actualProjection="assert.ok(actualScripts.includes('./translation/render/seat-projection.js?v=1'),'Extracted seat projection is missing.');\n";
if(!entry.includes(actualProjection.trim())) entry=insertAfter(entry,'seat projection entry assertion',actualRenderer,actualProjection);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared seat projection extraction against the current translated runtime.');
