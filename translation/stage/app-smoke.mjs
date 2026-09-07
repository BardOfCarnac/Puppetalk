import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const root={};
const context={window:root,globalThis:root,Map,Math};
vm.runInNewContext(source,context,{filename:'stage/app.js'});
const api=root.PuppetalkStageApp;
assert.ok(api?.create,'Stage app candidate did not install.');
assert.equal(api.create(),null,'Incomplete stage app dependencies must fail closed.');

const app={textContent:'',innerHTML:''};
const fn=()=>{};
const deps={
  app,document:{},stageShell:()=>'',clamp:fn,angleDelta:fn,NAMES:['Mara'],COLORS:['#fff'],
  defaultLook:()=>({}),cleanLook:v=>v,GRAB_PARTS:new Set(['torso']),POSES:{stand:[0]},
  ensureRig:fn,resetPins:fn,antiTangleTarget:fn,rootFollow:fn,
  drawBackdrop:fn,drawProp:fn,drawAnatomy:fn,send:fn,peerId:r=>r,cleanPlayerName:v=>v
};
const stage=api.create(deps);
assert.ok(stage?.startStage,'Stage app factory failed with complete root dependencies.');
stage.startStage('ROOM');
assert.equal(app.textContent,'Puppetalk libraries failed to load.','Missing runtime libraries changed the frozen stage failure.');
root.Matter={};
stage.startStage('ROOM');
assert.equal(app.textContent,'Puppetalk libraries failed to load.','Missing Peer library changed the frozen stage failure.');

for(const name of [
  'PuppetalkGrabGeometry','PuppetalkDriveForces','PuppetalkRecoveryGeometry','PuppetalkRigFactory',
  'PuppetalkRecoverySystem','PuppetalkCharacterSceneState','PuppetalkCharacterInputSystem','PuppetalkPuppetDriver',
  'PuppetalkPropFactory','PuppetalkPropGeometry','PuppetalkPropState','PuppetalkPropGripCore','PuppetalkBalloonPops',
  'PuppetalkPropAttachmentCore','PuppetalkBalloonLift','PuppetalkPropDriver','PuppetalkDepthAssist','PuppetalkLaserFrisbee',
  'PuppetalkPumpBalloon','PuppetalkPropInput','PuppetalkSpecialItems','PuppetalkPuppetLifecycle','PuppetalkStageLoop',
  'PuppetalkHostSession','PuppetalkDartImpacts','PuppetalkPropContactPhysics','PuppetalkStageLifecycle'
]) assert.match(source,new RegExp(`root\\.${name}`),`Stage app lost ${name} composition binding.`);

assert.match(source,/Engine\.create\(\{enableSleeping:false\}\)/,'Frozen Matter engine creation changed.');
assert.match(source,/engine\.gravity\.y = 1\.05;/,'Frozen stage gravity changed.');
assert.match(source,/engine\.gravity\.scale = \.001;/,'Frozen stage gravity scale changed.');
assert.match(source,/stageLifecycle\.start\(\);/,'Stage lifecycle is no longer the final stage startup action.');
assert.ok(source.indexOf('const hostSession =') < source.indexOf('const dartImpacts ='),'Frozen host/contact composition order changed.');
assert.ok(source.indexOf('const dartImpacts =') < source.indexOf('const stageLifecycle ='),'Frozen collision/lifecycle composition order changed.');

console.log('Stage app preserves frozen library failure, engine settings, subsystem bindings and lifecycle startup boundary.');
