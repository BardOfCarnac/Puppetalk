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
const creatorExtraction=`removeBetweenOnce(\n  'embedded character creator controller',`;
const commandExtraction=`removeBetweenOnce(\n  'embedded controller command panel',\n  \`  document.querySelector('#poses').addEventListener('click',event=>{\`,\n  \`  itemInteraction.installButtons();\`\n);\n\nreplaceOnce(\n  'controller command panel setup point',\n  \`  itemInteraction.installButtons();\`,\n  \`  const commandPanel = window.PuppetalkControllerCommands?.create?.({\n    document,input,activePointers,transmit,connect,\n    getCentreTimer:()=>centreTimer,setCentreTimer:value=>{ centreTimer=value; },\n    setTimeoutFn:(callback,ms)=>setTimeout(callback,ms),\n    clearTimeoutFn:id=>clearTimeout(id)\n  });\n  if(!commandPanel) throw new Error('Puppetalk controller command panel failed to load.');\n  commandPanel.install();\n\n  itemInteraction.installButtons();\`\n);\n\n`;
if(!build.includes("'embedded controller command panel'")) build=insertBefore(build,'command panel extraction',creatorExtraction,commandExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const audioModule="assert.match(actual,/PuppetalkControllerAudio/,'Translated runtime is not connected to extracted controller audio system.');\n";
const commandModule="assert.match(actual,/PuppetalkControllerCommands/,'Translated runtime is not connected to extracted controller command panel.');\n";
if(!parity.includes(commandModule.trim())) parity=insertAfter(parity,'command panel module assertion',audioModule,commandModule);

const audioNegative="assert.doesNotMatch(actual,/function stopManualTalk\\(\\)/,'Embedded stopManualTalk survived controller-audio extraction.');\n";
const commandNegatives="assert.doesNotMatch(actual,/document\\.querySelector\\('#poses'\\)\\.addEventListener\\('click'/,'Embedded pose command listener survived command-panel extraction.');\nassert.doesNotMatch(actual,/document\\.querySelector\\('#centre'\\)\\.addEventListener\\('click'/,'Embedded centre command listener survived command-panel extraction.');\nassert.doesNotMatch(actual,/document\\.querySelector\\('#retry'\\)\\.addEventListener\\('click',connect\\)/,'Embedded retry listener survived command-panel extraction.');\n";
if(!parity.includes('Embedded retry listener survived command-panel extraction.')) parity=insertAfter(parity,'command panel negative assertions',audioNegative,commandNegatives);

const audioBinding="assert.match(actual,/controllerAudio\\.install\\(\\);/,'Extracted controller audio is not installed.');\n";
const commandBinding="assert.match(actual,/const commandPanel = window\\.PuppetalkControllerCommands\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted controller command panel.');\nassert.match(actual,/commandPanel\\.install\\(\\);/,'Extracted controller command panel is not installed.');\n";
if(!parity.includes('Extracted controller command panel is not installed.')) parity=insertAfter(parity,'command panel binding assertions',audioBinding,commandBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const audioScript='  <script src="./translation/controller/audio-controls.js?v=1"></script>\n';
const commandScript='  <script src="./translation/controller/command-panel.js?v=1"></script>\n';
if(!html.includes(commandScript.trim())) html=insertAfter(html,'command panel script',audioScript,commandScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedAudio="expectedRuntime.push('./translation/controller/audio-controls.js?v=1');\n";
const expectedCommand="expectedRuntime.push('./translation/controller/command-panel.js?v=1');\n";
if(!entry.includes(expectedCommand.trim())) entry=insertAfter(entry,'expected command panel module',expectedAudio,expectedCommand);
const actualAudio="assert.ok(actualScripts.includes('./translation/controller/audio-controls.js?v=1'),'Extracted controller audio system is missing.');\n";
const actualCommand="assert.ok(actualScripts.includes('./translation/controller/command-panel.js?v=1'),'Extracted controller command panel is missing.');\n";
if(!entry.includes(actualCommand.trim())) entry=insertAfter(entry,'command panel entry assertion',actualAudio,actualCommand);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared controller command-panel extraction against the current translated runtime.');
