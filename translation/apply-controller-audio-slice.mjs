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
const controllerSetup=`replaceOnce(\n  'controller throw gesture setup point',`;
const audioExtraction=`replaceOnce(\n  'embedded controller audio state',\n  \`  let micStop = null;\n  let manualTimer = null;\n\`,\n  \`\`\n);\n\nremoveBetweenOnce(\n  'embedded controller audio',\n  \`  async function enableMic(){\`,\n  \`  addEventListener('resize',resizeCanvas,{passive:true});\`\n);\n\nreplaceOnce(\n  'controller audio setup point',\n  \`  addEventListener('resize',resizeCanvas,{passive:true});\`,\n  \`  const controllerAudio = window.PuppetalkControllerAudio?.create?.({\n    micButton,level,talkButton,input,transmit,setStatus,clamp,\n    getUserMedia:constraints=>navigator.mediaDevices.getUserMedia(constraints),\n    createAudioContext:()=>new AudioContext(),\n    requestFrame:callback=>requestAnimationFrame(callback),\n    cancelFrame:id=>cancelAnimationFrame(id),\n    setTimer:(callback,ms)=>setInterval(callback,ms),\n    clearTimer:id=>clearInterval(id)\n  });\n  if(!controllerAudio) throw new Error('Puppetalk controller audio failed to load.');\n  controllerAudio.install();\n\n  addEventListener('resize',resizeCanvas,{passive:true});\`\n);\n\n`;
if(!build.includes("'embedded controller audio'")) build=insertBefore(build,'controller audio extraction',controllerSetup,audioExtraction);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const throwModule="assert.match(actual,/PuppetalkControllerThrowGesture/,'Translated runtime is not connected to extracted controller throw gesture.');\n";
const audioModule="assert.match(actual,/PuppetalkControllerAudio/,'Translated runtime is not connected to extracted controller audio system.');\n";
if(!parity.includes(audioModule.trim())) parity=insertAfter(parity,'controller audio module assertion',throwModule,audioModule);

const throwNegative="assert.doesNotMatch(actual,/function finishThrow\\(event\\)/,'Embedded finishThrow survived controller throw extraction.');\n";
const audioNegatives="assert.doesNotMatch(actual,/let micStop = null;/,'Embedded micStop state survived controller-audio extraction.');\nassert.doesNotMatch(actual,/let manualTimer = null;/,'Embedded manualTimer state survived controller-audio extraction.');\nassert.doesNotMatch(actual,/async function enableMic\\(\\)/,'Embedded enableMic survived controller-audio extraction.');\nassert.doesNotMatch(actual,/function startManualTalk\\(event\\)/,'Embedded startManualTalk survived controller-audio extraction.');\nassert.doesNotMatch(actual,/function stopManualTalk\\(\\)/,'Embedded stopManualTalk survived controller-audio extraction.');\n";
if(!parity.includes('Embedded stopManualTalk survived controller-audio extraction.')) parity=insertAfter(parity,'controller audio negative assertions',throwNegative,audioNegatives);

const throwBinding="assert.match(actual,/controllerThrowGesture\\.install\\(\\);/,'Extracted controller throw gesture is not installed.');\n";
const audioBinding="assert.match(actual,/const controllerAudio = window\\.PuppetalkControllerAudio\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted controller audio.');\nassert.match(actual,/controllerAudio\\.install\\(\\);/,'Extracted controller audio is not installed.');\n";
if(!parity.includes('Extracted controller audio is not installed.')) parity=insertAfter(parity,'controller audio binding assertion',throwBinding,audioBinding);
write('translation/runtime-parity-smoke.mjs',parity);

let html=read('translation/index.html');
const throwScript='  <script src="./translation/controller/throw-gesture.js?v=1"></script>\n';
const audioScript='  <script src="./translation/controller/audio-controls.js?v=1"></script>\n';
if(!html.includes(audioScript.trim())) html=insertAfter(html,'controller audio script',throwScript,audioScript);
write('translation/index.html',html);

let entry=read('translation/entry-smoke.mjs');
const expectedThrow="expectedRuntime.push('./translation/controller/throw-gesture.js?v=1');\n";
const expectedAudio="expectedRuntime.push('./translation/controller/audio-controls.js?v=1');\n";
if(!entry.includes(expectedAudio.trim())) entry=insertAfter(entry,'expected controller audio module',expectedThrow,expectedAudio);
const actualThrow="assert.ok(actualScripts.includes('./translation/controller/throw-gesture.js?v=1'),'Extracted controller throw gesture is missing.');\n";
const actualAudio="assert.ok(actualScripts.includes('./translation/controller/audio-controls.js?v=1'),'Extracted controller audio system is missing.');\n";
if(!entry.includes(actualAudio.trim())) entry=insertAfter(entry,'controller audio entry assertion',actualThrow,actualAudio);
write('translation/entry-smoke.mjs',entry);

console.log('Prepared controller audio extraction against the current translated runtime.');
