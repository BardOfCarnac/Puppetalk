import fs from 'node:fs';
import vm from 'node:vm';
import {appSourceDecorators as decorators} from './translation/manifest.mjs';

const appSource = fs.readFileSync('app.js','utf8');

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
  'PUPPETALK_SPECIAL_ITEMS_V1',
  'PUPPETALK_SEGMENTED_PUPPET_V1',
  'PUPPETALK_SEAT_RENDER_V1',
  'PUPPETALK_DEPTH_ASSIST_V1',
  'PUPPETALK_VISUAL_THICKNESS_V1'
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
  'const tw = Math.max(18,40*scale);',
  'const hr = Math.max(12,23.5*scale);'
]){
  if(!composed.includes(hook)) throw new Error(`Missing live architecture hook: ${hook}`);
}

if(composed.includes('splitPuppetBody(')) throw new Error('Runtime body slicing should not be in the live composed source.');
if(composed.includes('PUPPETALK_SEAT_VIEW')) throw new Error('Peer-wrapped seat view should not be in the live composed source.');

new Function(composed);
console.log('Composed frozen Puppetalk app, including final visual proportions, passed.');
