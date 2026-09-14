import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('index.html','utf8');
const appSource = fs.readFileSync('app.js','utf8');

const localScripts = [...html.matchAll(/<script\s+src=["']\.\/([^"'?]+)(?:\?[^"']*)?["']/g)]
  .map(match=>match[1]);

if(!localScripts.length) throw new Error('No local scripts found in index.html.');
if(localScripts.at(-1) !== 'boot.js') throw new Error('boot.js must remain the final local script in index.html.');

function mustPrecede(a,b){
  const ai = localScripts.indexOf(a);
  const bi = localScripts.indexOf(b);
  if(ai < 0 || bi < 0 || ai >= bi) throw new Error(`Live script order is wrong: ${a} must precede ${b}.`);
}

mustPrecede('toy-system.js','balloon-tie.js');
mustPrecede('balloon-tie.js','item-polish.js');
mustPrecede('item-polish.js','expanded-items.js');
mustPrecede('expanded-items.js','prop-size-tuning.js');
mustPrecede('prop-size-tuning.js','upright-posture.js');
mustPrecede('invitee-smoothing.js','boot.js');

const sourceByFile = new Map();
for(const file of localScripts){
  if(file === 'lobby-routing.js' || file === 'boot.js') continue;
  if(!fs.existsSync(file)) throw new Error(`index.html references missing local script: ${file}`);
  sourceByFile.set(file,fs.readFileSync(file,'utf8'));
}

// Only source decorators need to participate in the synthetic app.js fetch.
// Their order is derived directly from index.html so this test cannot quietly
// drift behind the live build as new decorator layers are added.
const decorators = localScripts.filter(file=>{
  if(file === 'lobby-routing.js' || file === 'boot.js') return false;
  const source = sourceByFile.get(file) || '';
  return source.includes('window.fetch') || source.includes('decoratedFetch');
});

for(const required of ['toy-system.js','balloon-tie.js','expanded-items.js','prop-size-tuning.js','invitee-smoothing.js']){
  if(!decorators.includes(required)) throw new Error(`Live decorator chain is missing ${required}.`);
}

const stubNode = () => ({
  appendChild(){}, prepend(){}, remove(){}, pause(){}, select(){},
  play(){ return Promise.resolve(); },
  setAttribute(){}, removeAttribute(){}, addEventListener(){}, removeEventListener(){},
  requestFullscreen(){ return Promise.resolve(); },
  getBoundingClientRect(){ return {left:0,top:0,width:390,height:700}; },
  getContext(){ return {setTransform(){}}; },
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  dataset:{}, style:{}, textContent:'', innerHTML:'', srcObject:null,
  hidden:false, paused:false, destroyed:false
});

const app = stubNode();
const document = {
  documentElement:stubNode(),
  head:stubNode(),
  body:stubNode(),
  title:'Puppetalk',
  fullscreenElement:null,
  createElement(){ return stubNode(); },
  querySelector(selector){ return selector === '#app' ? app : null; },
  querySelectorAll(){ return []; },
  addEventListener(){}, removeEventListener(){},
  execCommand(){ return true; },
  exitFullscreen(){ return Promise.resolve(); }
};

class MutationObserver { observe(){} disconnect(){} }
class SmokeBlob {
  constructor(parts=[],options={}){ this.parts=parts; this.type=options.type||''; }
}
let capturedBootSource='';
class SmokeURL extends URL {
  static createObjectURL(blob){
    capturedBootSource = (blob?.parts || []).map(String).join('');
    return 'blob:puppetalk-live-chain-smoke';
  }
  static revokeObjectURL(){}
}

const location = {
  href:'https://puppetalk.test/?mode=controller&room=TEST12&lobby=done',
  origin:'https://puppetalk.test',
  search:'?mode=controller&room=TEST12&lobby=done'
};
const storage = {getItem(){return null;},setItem(){},removeItem(){}};

const context = {
  console,
  performance,
  Response,
  URL:SmokeURL,
  URLSearchParams,
  Blob:SmokeBlob,
  MutationObserver,
  location,
  navigator:{mediaDevices:{}},
  history:{replaceState(){}},
  localStorage:storage,
  sessionStorage:storage,
  screen:{orientation:{lock(){ return Promise.resolve(); }}},
  matchMedia(){ return {matches:false,addEventListener(){},removeEventListener(){}}; },
  innerWidth:390,
  innerHeight:700,
  devicePixelRatio:1,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame(){ return 1; },
  cancelAnimationFrame(){},
  addEventListener(){},
  removeEventListener(){},
  document,
  window:{
    addEventListener(){},
    removeEventListener(){},
    dispatchEvent(){},
    devicePixelRatio:1,
    innerWidth:390,
    innerHeight:700,
    matchMedia(){ return {matches:false,addEventListener(){},removeEventListener(){}}; }
  }
};
context.globalThis=context;
context.window.window=context.window;
context.window.document=document;
context.window.location=location;
context.window.navigator=context.navigator;
context.window.history=context.history;
context.window.Blob=SmokeBlob;
context.window.URL=SmokeURL;
context.window.URLSearchParams=URLSearchParams;
context.window.localStorage=storage;
context.window.sessionStorage=storage;
context.window.screen=context.screen;
context.window.requestAnimationFrame=context.requestAnimationFrame;
context.window.cancelAnimationFrame=context.cancelAnimationFrame;
context.window.fetch=async()=>new Response(appSource,{status:200});
context.fetch=(...args)=>context.window.fetch(...args);

for(const file of decorators){
  vm.runInNewContext(sourceByFile.get(file),context,{filename:file});
}

vm.runInNewContext(fs.readFileSync('boot.js','utf8'),context,{filename:'boot.js'});

let finalSource='';
for(let i=0;i<100;i++){
  await new Promise(resolve=>setTimeout(resolve,10));
  finalSource=capturedBootSource;
  if(finalSource) break;
}
if(!finalSource){
  throw new Error(`boot.js did not produce a final Blob. Startup text: ${app.innerHTML || app.textContent || '(none)'}`);
}

for(const marker of [
  'PUPPETALK_TOY_SYSTEM_V1',
  'PUPPETALK_BALLOON_TIE_V1',
  'PUPPETALK_ITEM_POLISH_V1',
  'PUPPETALK_EXPANDED_ITEMS_V1',
  'PUPPETALK_PROP_SIZE_TUNING_V2',
  'PUPPETALK_SEGMENTED_PUPPET_V1',
  'PUPPETALK_UPRIGHT_POSTURE_V1',
  'PUPPETALK_SEAT_RENDER_V1',
  'PUPPETALK_DEPTH_ASSIST_V1',
  'PUPPETALK_CANONICAL_SLIM_RENDER_V1',
  'PUPPETALK_INVITEE_SMOOTHING_V4'
]){
  if(!finalSource.includes(marker)) throw new Error(`Missing live-chain marker: ${marker}`);
}

for(const hook of [
  "['frisbee','pump','ball','dart','boomerang','dartgun','moonboots','sword']",
  'Bodies.circle(x,y,19,{density:.00062',
  'Bodies.rectangle(x,y,88,11,{density:.0036',
  'queueAuthoritativeScene(msg.puppets)',
  'puppetalkSeatProjection(scene,propScene,slot)',
  'driveDepthAssistedProps(now)',
  'puppetalkLiveHeadPath(ctx,look.headStyle,hr)'
]){
  if(!finalSource.includes(hook)) throw new Error(`Missing live-chain hook: ${hook}`);
}

if(finalSource.includes('PUPPETALK_BODY_SLICING_V1')) throw new Error('Old arbitrary body slicing leaked into the live build.');
new Function(finalSource);

console.log(`Live chain passed with ${decorators.length} source decorators derived from index.html.`);
