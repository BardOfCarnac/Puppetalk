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
  'upright-posture.js',
  'seat-render.js',
  'depth-assist.js',
  'visual-thickness.js',
  'canonical-puppet-render.js',
  'live-voice.js'
];

const stubNode = () => ({
  appendChild(){}, remove(){}, pause(){},
  play(){ return Promise.resolve(); },
  setAttribute(){}, addEventListener(){},
  classList:{ add(){}, remove(){}, toggle(){} },
  dataset:{}, style:{}, textContent:'', srcObject:null,
  paused:false
});
const document = {
  documentElement:stubNode(),
  head:stubNode(),
  body:stubNode(),
  createElement:stubNode,
  querySelector(){ return null; },
  addEventListener(){}
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
  'PUPPETALK_SPECIAL_ITEMS_V1',
  'PUPPETALK_SEGMENTED_PUPPET_V1',
  'PUPPETALK_UPRIGHT_POSTURE_V1',
  'PUPPETALK_SEAT_RENDER_V1',
  'PUPPETALK_DEPTH_ASSIST_V1',
  'PUPPETALK_VISUAL_THICKNESS_V1',
  'PUPPETALK_CANONICAL_SLIM_RENDER_V1'
]){
  if(!composed.includes(marker)) throw new Error(`Missing composed marker: ${marker}`);
}

for(const hook of [
  'specialItemType(slot,requested)',
  'bringOutSpecialItem(slot,requested)',
  "localStorage.getItem('puppetalk-special-item')",
  'brokenSeams:new Set()',
  'severSeam(p,name)',
  "best.kind === 'seam'",
  'prop.body.isSensor = true',
  'repairBrokenSeams(p)',
  'puppetalkSeatProjection(scene,propScene,slot)',
  'PUPPETALK_SEAT_ORDER = [0,3,1,4,2,5]',
  'PUPPETALK_ACTION_DEPTH_TOLERANCE = .38',
  'driveDepthAssistedProps(now)',
  'puppetalkAimProjectPropPoint(prop,prop._throwerSlot)',
  'puppetalkAimProjectPoint(p,qRaw,prop._throwerSlot)',
  'throwerSlot:Number.isInteger(prop._throwerSlot)',
  'viewScale:depthApi?.scaleForDepth?.(viewDepth)||1',
  'PUPPETALK_LAST_LOOK_SENT',
  'servo(p.torsoTop,0,.014*muscle)',
  'servo(p.torsoBottom,0,.0125*muscle)',
  'servo(p.head,0,.0068*muscle)',
  'puppetalkLiveHeadPath = function(ctx,style,r)',
  'const tw = Math.max(16,34.5*scale);',
  'const hr = Math.max(11,22*scale);',
  ',p.color,10.2);',
  ',p.color,11.6);',
  'window.PuppetalkLiveVoice?.stageJoin(conn,slot)',
  'window.PuppetalkLiveVoice?.controllerPeer(peer,room)',
  'window.PuppetalkLiveVoice?.setLocalStream(stream)',
  'window.PuppetalkLiveVoice?.clearLocalStream(stream)'
]){
  if(!composed.includes(hook)) throw new Error(`Missing live architecture hook: ${hook}`);
}

if(composed.includes('window.PuppetalkVoice?.mouthState')) throw new Error('Live voice must not alter mouth analysis.');
if(composed.includes('splitPuppetBody(')) throw new Error('Runtime body slicing should not be in the live composed source.');
if(composed.includes('PUPPETALK_SEAT_VIEW')) throw new Error('Peer-wrapped seat view should not be in the live composed source.');

new Function(composed);
console.log('Composed live app + synced canonical slim character + upright neutral core + profile items + segmented bodies + seat projection + minimal voice passed.');
