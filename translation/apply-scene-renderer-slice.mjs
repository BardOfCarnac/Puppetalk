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
const rendererExtraction=`replaceOnce(\n  'scene renderer setup point',\n  \`if(mode === 'controller') startController(room);\`,\n  \`const sceneRenderer = window.PuppetalkSceneRenderer?.create?.({\n  cleanLook,document,\n  Path2DClass:typeof Path2D === 'function' ? Path2D : null,\n  getDisplayPoint:()=>typeof displayPoint === 'function' ? displayPoint : null,\n  getProjectionRenderScale:()=>typeof projectionRenderScale === 'function' ? projectionRenderScale : null\n});\nif(!sceneRenderer) throw new Error('Puppetalk scene renderer failed to load.');\nconst {drawBackdrop,drawAnatomy,drawProp,roundRect} = sceneRenderer;\n\nif(mode === 'controller') startController(room);\`\n);\n\nremoveBetweenOnce(\n  'embedded shared scene renderer',\n  \`function drawBackdrop(ctx,w,h){\`,\n  \`})();\`\n);\n\n`;
if(!build.includes("'embedded shared scene renderer'")) build=insertBefore(build,'shared scene renderer extraction',finalSyntax,rendererExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const lookModule="assert.match(actual,/PuppetalkLookModel/,'Translated runtime is not connected to extracted character look model.');\n";
const rendererModule="assert.match(actual,/PuppetalkSceneRenderer/,'Translated runtime is not connected to extracted shared scene renderer.');\n";
if(!parity.includes(rendererModule.trim())) parity=insertAfter(parity,'scene renderer module assertion',lookModule,rendererModule);

const sessionNegative="assert.doesNotMatch(actual,/getScene:\(\)=>scene/,'Controller modules still close over embedded scene state.');\n";
const rendererNegatives="assert.doesNotMatch(actual,/function drawBackdrop\\(ctx,w,h\\)/,'Embedded drawBackdrop survived scene-renderer extraction.');\nassert.doesNotMatch(actual,/const PUPPETALK_LIVE_EYES=/,'Embedded live eye renderer data survived scene-renderer extraction.');\nassert.doesNotMatch(actual,/function puppetalkLiveHeadPath\\(ctx,style,r\\)/,'Embedded live head renderer survived scene-renderer extraction.');\nassert.doesNotMatch(actual,/function drawAnatomy\\(ctx,p,w,h,highlight=false,alpha=1\\)/,'Embedded drawAnatomy survived scene-renderer extraction.');\nassert.doesNotMatch(actual,/function drawProp\\(ctx,p,w,h\\)/,'Embedded drawProp survived scene-renderer extraction.');\nassert.doesNotMatch(actual,/function roundRect\\(ctx,x,y,w,h,r\\)/,'Embedded roundRect survived scene-renderer extraction.');\nassert.match(actual,/const LINE_FACE_EYES = \\{/,'Upper frozen line-face specimen moved during live-renderer extraction.');\n";
if(!parity.includes('Embedded drawBackdrop survived scene-renderer extraction.')) parity=insertAfter(parity,'scene renderer negative assertions',sessionNegative,rendererNegatives);

const lookBinding="assert.match(actual,/const \\{LOOK_PALETTE,LOOK_PARTS,defaultLook,cleanLook\\} = window\\.PuppetalkLookModel \\|\\| \\{\\};/,'Runtime is not bound to the extracted look model.');\n";
const rendererBinding="assert.match(actual,/const sceneRenderer = window\\.PuppetalkSceneRenderer\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted shared scene renderer.');\nassert.match(actual,/const \\{drawBackdrop,drawAnatomy,drawProp,roundRect\\} = sceneRenderer;/,'Runtime callers are not bound to extracted shared scene renderer.');\n";
if(!parity.includes('Runtime callers are not bound to extracted shared scene renderer.')) parity=insertAfter(parity,'scene renderer binding assertions',lookBinding,rendererBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const lookScript='  <script src="./translation/character/look-model.js?v=1"></script>\n';
const rendererScript='  <script src="./translation/render/scene-renderer.js?v=1"></script>\n';
if(!html.includes(rendererScript.trim())) html=insertAfter(html,'shared scene renderer script',lookScript,rendererScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedLook="expectedRuntime.push('./translation/character/look-model.js?v=1');\n";
const expectedRenderer="expectedRuntime.push('./translation/render/scene-renderer.js?v=1');\n";
if(!entry.includes(expectedRenderer.trim())) entry=insertAfter(entry,'expected shared scene renderer module',expectedLook,expectedRenderer);
const actualLook="assert.ok(actualScripts.includes('./translation/character/look-model.js?v=1'),'Extracted character look model is missing.');\n";
const actualRenderer="assert.ok(actualScripts.includes('./translation/render/scene-renderer.js?v=1'),'Extracted shared scene renderer is missing.');\n";
if(!entry.includes(actualRenderer.trim())) entry=insertAfter(entry,'shared scene renderer entry assertion',actualLook,actualRenderer);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared shared scene renderer extraction against the current translated runtime.');
