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
function removeThroughOnce(text,label,startMarker,endMarker){
  const start=text.indexOf(startMarker);
  if(start<0) throw new Error(`Missing ${label} start marker.`);
  if(text.indexOf(startMarker,start+startMarker.length)>=0) throw new Error(`${label} start marker matched more than once.`);
  const end=text.indexOf(endMarker,start+startMarker.length);
  if(end<0) throw new Error(`Missing ${label} end marker.`);
  return text.slice(0,start)+text.slice(end+endMarker.length);
}

let build=read('translation/build-runtime.mjs');
const rendererSetup=`replaceOnce(\n  'scene renderer setup point',`;
const lifecycleExtraction=`replaceOnce(\n  'embedded stage lifecycle resize listener',\n  \`  addEventListener('resize',resize,{passive:true});\n\`,\n  \`\`\n);\n\nremoveBetweenOnce(\n  'embedded stage lifecycle resize',\n  \`  function resize(){\`,\n  \`  const hostSession = window.PuppetalkHostSession?.create?.({\`\n);\n\nreplaceOnce(\n  'stage lifecycle startup',\n  \`  resize();\n  ensureTestProps();\n  installDartImpacts();\n  installPropContactPhysics();\n  requestAnimationFrame(tick);\`,\n  \`  const stageLifecycle = window.PuppetalkStageLifecycle?.create?.({\n    canvas,ctx,Bodies,Composite,engine,\n    getBounds:()=>bounds,setBounds:value=>{ bounds=value; },\n    setDimensions:(width,height)=>{ W=width; H=height; },\n    ensureTestProps,installDartImpacts,installPropContactPhysics,tick,\n    getViewport:()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio || 1}),\n    addEventListenerFn:(type,handler,opts)=>addEventListener(type,handler,opts),\n    requestFrame:callback=>requestAnimationFrame(callback)\n  });\n  if(!stageLifecycle) throw new Error('Puppetalk stage lifecycle failed to load.');\n  stageLifecycle.start();\`\n);\n\n`;
if(!build.includes("'embedded stage lifecycle resize'")) build=insertBefore(build,'stage lifecycle extraction',rendererSetup,lifecycleExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const stageLoopModule="assert.match(actual,/PuppetalkStageLoop/,'Translated runtime is not connected to extracted stage loop.');\n";
const lifecycleModule="assert.match(actual,/PuppetalkStageLifecycle/,'Translated runtime is not connected to extracted stage lifecycle.');\n";
if(!parity.includes(lifecycleModule.trim())) parity=insertAfter(parity,'stage lifecycle module assertion',stageLoopModule,lifecycleModule);

const tickNegative="assert.doesNotMatch(actual,/function tick\\(now\\)/,'Embedded tick survived stage-loop extraction.');\n";
const lifecycleNegatives="assert.doesNotMatch(actual,/function resize\\(\\)/,'Embedded stage resize survived stage-lifecycle extraction.');\nassert.doesNotMatch(actual,/addEventListener\\('resize',resize,\\{passive:true\\}\\)/,'Embedded stage resize listener survived stage-lifecycle extraction.');\n";
if(!parity.includes('Embedded stage resize listener survived stage-lifecycle extraction.')) parity=insertAfter(parity,'stage lifecycle negative assertions',tickNegative,lifecycleNegatives);

if(parity.includes('Resize listener moved during prop extraction.')){
  parity=replaceOnce(
    parity,
    'stale inline resize-listener parity guard',
    `assert.ok(actual.includes("addEventListener('resize',resize,{passive:true});"),'Resize listener moved during prop extraction.');\n`,
    ''
  );
}
if(parity.includes('V1 stage startup order changed during prop extraction.')){
  parity=removeThroughOnce(
    parity,
    'stale inline stage-startup parity guard',
    'assert.ok(actual.includes(`  resize();',
    "`),'V1 stage startup order changed during prop extraction.');"
  );
}

const lifecycleBinding="assert.match(actual,/const stageLifecycle = window\\.PuppetalkStageLifecycle\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted stage lifecycle.');\nassert.match(actual,/stageLifecycle\\.start\\(\\);/,'Extracted stage lifecycle is not started.');\n\n";
const parityConsole="console.log('Translated runtime matches frozen V1 with character systems, stage loop, host session and prop grip/attachment/contact systems extracted.');";
if(!parity.includes('Extracted stage lifecycle is not started.')) parity=insertBefore(parity,'stage lifecycle binding assertions',parityConsole,lifecycleBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const stageLoopScript='  <script src="./translation/stage/stage-loop.js?v=1"></script>\n';
const lifecycleScript='  <script src="./translation/stage/stage-lifecycle.js?v=1"></script>\n';
if(!html.includes(lifecycleScript.trim())) html=insertAfter(html,'stage lifecycle script',stageLoopScript,lifecycleScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedStageLoop="expectedRuntime.push('./translation/stage/stage-loop.js?v=1');\n";
const expectedLifecycle="expectedRuntime.push('./translation/stage/stage-lifecycle.js?v=1');\n";
if(!entry.includes(expectedLifecycle.trim())) entry=insertAfter(entry,'expected stage lifecycle module',expectedStageLoop,expectedLifecycle);
const actualStageLoop="assert.ok(actualScripts.includes('./translation/stage/stage-loop.js?v=1'),'Extracted stage loop is missing.');\n";
const actualLifecycle="assert.ok(actualScripts.includes('./translation/stage/stage-lifecycle.js?v=1'),'Extracted stage lifecycle is missing.');\n";
if(!entry.includes(actualLifecycle.trim())) entry=insertAfter(entry,'stage lifecycle entry assertion',actualStageLoop,actualLifecycle);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared stage lifecycle extraction against the current translated runtime.');
