import fs from 'node:fs';
import vm from 'node:vm';

const appSource = fs.readFileSync('app.js','utf8');
const decorators = [
  'character-creator-patch.js',
  'character-creator-hotfix.js',
  'line-face-mouths-patch.js',
  'line-face-features-patch.js',
  'face-spacing-patch.js',
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
  'voice-layer.js',
  'voice-stage-compat.js'
];

const stubNode = () => ({
  appendChild(){}, remove(){}, pause(){},
  play(){ return Promise.resolve(); },
  setAttribute(){}, addEventListener(){},
  classList:{ add(){}, remove(){}, toggle(){} },
  dataset:{}, style:{}, textContent:'', srcObject:null
});
const document = {
  documentElement:stubNode(),
  head:stubNode(),
  body:stubNode(),
  createElement:stubNode,
  querySelector(){ return null; }
};
class MutationObserver { observe(){} disconnect(){} }
const location = { href:'https://puppetalk.test/app.js', origin:'https://puppetalk.test' };

const context = {
  console,
  performance,
  Response,
  URL,
  setTimeout,
  clearTimeout,
  document,
  MutationObserver,
  location,
  window: {}
};
context.window.fetch = async () => new Response(appSource,{status:200});
context.globalThis = context;

for(const file of decorators){
  vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}

const response = await context.window.fetch('app.js');
const composed = await response.text();

for(const marker of [
  'PUPPETALK_TOY_SYSTEM_V1',
  'PUPPETALK_TOY_TAP_V1',
  'PUPPETALK_DART_STICK_V1',
  'PUPPETALK_BALLOON_TIE_V1',
  'PUPPETALK_TOY_THROW_V1',
  'PUPPETALK_PROP_EXTREMITIES_V1',
  'PUPPETALK_BALLOON_BUOYANCY_V1',
  'PUPPETALK_DART_BALLOON_POP_V1',
  'PUPPETALK_SEVERABLE_JOINTS_V1',
  'PUPPETALK_LASER_FRISBEE_V1',
  'PUPPETALK_ITEM_POLISH_V1',
  'PUPPETALK_VOICE_STAGE_COMPAT_V1'
]){
  if(!composed.includes(marker)) throw new Error(`Missing composed marker: ${marker}`);
}

for(const hook of [
  'window.PuppetalkVoice?.stageJoin(conn,slot);',
  'window.PuppetalkVoice?.stageData(conn,slot,msg);',
  'window.PuppetalkVoice?.controllerPeer(peer,room);',
  'window.PuppetalkVoice?.setLocalStream(stream);',
  'window.PuppetalkVoice?.mouthState?.(rms,now)',
  'id="deafen"'
]){
  if(!composed.includes(hook)) throw new Error(`Missing live voice hook: ${hook}`);
}

new Function(composed);
console.log('Composed app + live voice source smoke check passed.');
