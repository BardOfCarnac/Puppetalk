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
const finalSyntax='new Function(source);';
const shellExtraction=`replaceOnce(\n  'view shell setup point',\n  \`if(mode === 'controller') startController(room);\`,\n  \`const {incompleteInviteShell,stageShell,controllerShell} = window.PuppetalkViewShells || {};\nif(!incompleteInviteShell || !stageShell || !controllerShell){\n  throw new Error('Puppetalk view shells failed to load.');\n}\n\nif(mode === 'controller') startController(room);\`\n);\n\nremoveBetweenOnce(\n  'embedded stage shell',\n  \`  app.innerHTML = \\\`\n    <section class=\\"stage-shell\\">\`,\n  \`  const canvas = document.querySelector('#stage-canvas');\`\n);\n\nreplaceOnce(\n  'stage shell render point',\n  \`  const canvas = document.querySelector('#stage-canvas');\`,\n  \`  app.innerHTML = stageShell(room,joinUrl.href);\n\n  const canvas = document.querySelector('#stage-canvas');\`\n);\n\nreplaceOnce(\n  'incomplete controller invite shell',\n  \`    app.innerHTML = \\\`<section class=\\"join-form\\"><div class=\\"join-panel card\\"><strong>Puppetalk</strong><div class=\\"muted small\\">This invite is incomplete.</div></div></section>\\\`;\`,\n  \`    app.innerHTML = incompleteInviteShell();\`\n);\n\nremoveBetweenOnce(\n  'embedded controller shell',\n  \`  app.innerHTML = \\\`\n    <section class=\\"shell controller-shell personal-controller\\">\`,\n  \`  const canvas = document.querySelector('#personal-canvas');\`\n);\n\nreplaceOnce(\n  'controller shell render point',\n  \`  const canvas = document.querySelector('#personal-canvas');\`,\n  \`  app.innerHTML = controllerShell(room,POSES);\n\n  const canvas = document.querySelector('#personal-canvas');\`\n);\n\n`;
if(!build.includes("'embedded controller shell'")) build=insertBefore(build,'view shell extraction',finalSyntax,shellExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const projectionModule="assert.match(actual,/PuppetalkSeatProjection/,'Translated runtime is not connected to extracted seat projection.');\n";
const shellModule="assert.match(actual,/PuppetalkViewShells/,'Translated runtime is not connected to extracted view shells.');\n";
if(!parity.includes(shellModule.trim())) parity=insertAfter(parity,'view shell module assertion',projectionModule,shellModule);

const projectionNegative="assert.doesNotMatch(actual,/function puppetalkSeatProjection\\(puppets,props,viewerSlot\\)/,'Embedded seat projection entry point survived extraction.');\n";
const shellNegatives="assert.doesNotMatch(actual,/<section class=\\\"stage-shell\\\">/,'Embedded stage shell markup survived view-shell extraction.');\nassert.doesNotMatch(actual,/<section class=\\\"shell controller-shell personal-controller\\\">/,'Embedded controller shell markup survived view-shell extraction.');\nassert.doesNotMatch(actual,/This invite is incomplete\\.<\\/div><\\/div><\\/section>/,'Embedded incomplete-invite shell survived view-shell extraction.');\nassert.match(actual,/app\\.innerHTML = stageShell\\(room,joinUrl\\.href\\);/,'Stage does not render through extracted view shell.');\nassert.match(actual,/app\\.innerHTML = controllerShell\\(room,POSES\\);/,'Controller does not render through extracted view shell.');\nassert.match(actual,/app\\.innerHTML = incompleteInviteShell\\(\\);/,'Incomplete controller invite does not render through extracted view shell.');\n";
if(!parity.includes('Embedded stage shell markup survived view-shell extraction.')) parity=insertAfter(parity,'view shell runtime assertions',projectionNegative,shellNegatives);

const projectionBinding="assert.match(actual,/const \\{puppetalkSeatProjection\\} = seatProjection;/,'Runtime callers are not bound to extracted seat projection.');\n";
const shellBinding="assert.match(actual,/const \\{incompleteInviteShell,stageShell,controllerShell\\} = window\\.PuppetalkViewShells \\|\\| \\{\\};/,'Runtime is not bound to extracted view shells.');\nconst viewShellBindingIndex=actual.indexOf('const {incompleteInviteShell,stageShell,controllerShell} = window.PuppetalkViewShells');\nconst viewShellDispatchIndex=actual.indexOf(\"if(mode === 'controller') startController(room);\");\nassert.ok(viewShellBindingIndex>=0 && viewShellDispatchIndex>=0 && viewShellBindingIndex<viewShellDispatchIndex,'View shells must be initialized before early mode dispatch.');\n";
if(!parity.includes('View shells must be initialized before early mode dispatch.')) parity=insertAfter(parity,'view shell binding assertions',projectionBinding,shellBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const projectionScript='  <script src="./translation/render/seat-projection.js?v=1"></script>\n';
const shellScript='  <script src="./translation/ui/shells.js?v=1"></script>\n';
if(!html.includes(shellScript.trim())) html=insertAfter(html,'view shell script',projectionScript,shellScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedProjection="expectedRuntime.push('./translation/render/seat-projection.js?v=1');\n";
const expectedShell="expectedRuntime.push('./translation/ui/shells.js?v=1');\n";
if(!entry.includes(expectedShell.trim())) entry=insertAfter(entry,'expected view shell module',expectedProjection,expectedShell);
const actualProjection="assert.ok(actualScripts.includes('./translation/render/seat-projection.js?v=1'),'Extracted seat projection is missing.');\n";
const actualShell="assert.ok(actualScripts.includes('./translation/ui/shells.js?v=1'),'Extracted view shells are missing.');\n";
if(!entry.includes(actualShell.trim())) entry=insertAfter(entry,'view shell entry assertion',actualProjection,actualShell);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared view-shell extraction against the current translated runtime.');
