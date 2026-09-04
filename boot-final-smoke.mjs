import fs from 'node:fs';
import vm from 'node:vm';

const appSource = fs.readFileSync('app.js','utf8');
const decorators = [
  'character-creator-patch.js',
  'character-creator-hotfix.js',
  'line-face-mouths-patch.js',
  'line-face-features-patch.js',
  'face-spacing-patch.js',
  'profile-name-patch.js',
  'look-sync-patch.js',
  'live-face-render-patch.js',
  'live-head-finalizer.js',
  'toy-system.js',
  'toy-tap.js',
  'dart-stick.js',
  'balloon-tie.js',
  'toy-throw.js',
  'prop-extremities.js',
  'balloon-buoyancy.js',
  'dart-balloon-pop.js',
  'severable-joints.js',
  'laser-frisbee.js',
  'item-polish.js',
  'special-items.js',
  'segmented-puppet.js',
  'seat-render.js',
  'depth-assist.js'
];

const stubNode = () => ({
  appendChild(){}, remove(){}, pause(){}, select(){},
  play(){ return Promise.resolve(); },
  setAttribute(){}, addEventListener(){}, prepend(){},
  classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  dataset:{}, style:{}, textContent:'', innerHTML:'', srcObject:null
});
const app = stubNode();
const body = stubNode();
const document = {
  documentElement:stubNode(),
  head:stubNode(),
  body,
  title:'Puppetalk',
  createElement(){ return stubNode(); },
  querySelector(selector){ return selector === '#app' ? app : null; },
  querySelectorAll(){ return []; },
  execCommand(){ return true; }
};
class MutationObserver { observe(){} disconnect(){} }
class SmokeBlob {
  constructor(parts=[],options={}){ this.parts=parts; this.type=options.type||''; }
}
let capturedBootSource='';
class SmokeURL extends URL {
  static createObjectURL(blob){
    capturedBootSource = (blob?.parts || []).map(String).join('');
    return 'blob:puppetalk-smoke';
  }
  static revokeObjectURL(){}
}
const location = {
  href:'https://puppetalk.test/?mode=controller&room=TEST12&lobby=done',
  origin:'https://puppetalk.test',
  search:'?mode=controller&room=TEST12&lobby=done'
};

const context = {
  console,
  performance,
  Response,
  URL:SmokeURL,
  URLSearchParams,
  Blob:SmokeBlob,
  MutationObserver,
  location,
  navigator:{},
  history:{replaceState(){}},
  crypto:{getRandomValues(array){ for(let i=0;i<array.length;i++) array[i]=i+1; return array; }},
  localStorage:{getItem(){return null;},setItem(){}},
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  document,
  window:{
    addEventListener(){},
    removeEventListener(){},
    dispatchEvent(){},
    devicePixelRatio:1
  }
};
context.globalThis=context;
context.window.window=context.window;
context.window.document=document;
context.window.location=location;
context.window.Blob=SmokeBlob;
context.window.URL=SmokeURL;
context.window.localStorage=context.localStorage;
context.window.fetch=async()=>new Response(appSource,{status:200});
context.fetch=(...args)=>context.window.fetch(...args);

for(const file of decorators){
  vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}

vm.runInNewContext(fs.readFileSync('boot.js','utf8'),context,{filename:'boot.js'});

let finalSource='';
for(let i=0;i<80;i++){
  await new Promise(resolve=>setTimeout(resolve,10));
  finalSource=capturedBootSource;
  if(finalSource) break;
}
if(!finalSource){
  throw new Error(`boot.js did not produce a final Blob. Startup text: ${app.innerHTML || app.textContent || '(none)'}`);
}

for(const hook of [
  'PUPPETALK_SPECIAL_ITEMS_V1',
  'PUPPETALK_SEGMENTED_PUPPET_V1',
  'PUPPETALK_SEAT_RENDER_V1',
  'PUPPETALK_DEPTH_ASSIST_V1',
  'brokenSeams:new Set()',
  'repairBrokenSeams(p)',
  'puppetalkSeatProjection(scene,propScene,slot)',
  'PUPPETALK_ACTION_DEPTH_TOLERANCE = .38',
  'driveDepthAssistedProps(now)',
  'puppetalkAimProjectPoint(p,qRaw,prop._throwerSlot)',
  'throwerSlot:Number.isInteger(prop._throwerSlot)',
  'const activePointers = new Map()',
  'const rawLook = p.look',
  "const headStyles=['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe']",
  'const eyeMap={closed:',
  'const noseMap={angular:',
  'drawLineFaceMouth(ctx,mouthStyle,p.mouth,hr)',
  'PUPPETALK_LAST_LOOK_SENT',
  "type:'look',look:msg.input.look,name"
]){
  if(!finalSource.includes(hook)){
    const headAt=finalSource.indexOf('const hx = p.head.x*w;');
    const headSnippet=headAt>=0?finalSource.slice(Math.max(0,headAt-500),headAt+4200):'(no head anchor found)';
    throw new Error(`Missing final boot hook: ${hook}\n--- surviving head renderer ---\n${headSnippet}`);
  }
}
if(finalSource.includes('splitPuppetBody(')) throw new Error('Old runtime slicing survived into final boot source.');
new Function(finalSource);
console.log('Final boot-transformed Puppetalk source, including selected head and native Line Face rendering, passed.');
