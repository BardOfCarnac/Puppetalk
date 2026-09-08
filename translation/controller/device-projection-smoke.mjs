import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const sourceStage={width:1024,height:681};
const camera={stageFrame:(w,h)=>({sceneId:'default',profile:w/h>1.42?'wide':'tall',floorY:h*.88,floorLeft:0,floorRight:w})};
const window={
  URLSearchParams,
  location:{search:'?mode=controller'},
  PuppetalkSourceStage:sourceStage,
  PuppetalkSceneCamera:camera
};
const context={window,URLSearchParams};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./device-projection.js',import.meta.url),'utf8'),context,{filename:'device-projection.js'});

const api=window.PuppetalkControllerProjection;
assert.ok(api?.create,'Controller projection candidate did not install.');
assert.equal(typeof window.displayPoint,'function');
assert.equal(typeof window.displayNorm,'function');
assert.equal(typeof window.projectionRenderScale,'function');

let mode='controller';
const projection=api.create({getMode:()=>mode,getSourceStage:()=>sourceStage,getSceneCamera:()=>camera});

// Before any scene arrives, retain a conservative whole-stage fit.
const fallbackFrame=projection.projectionFor(1024,681);
assert.equal(fallbackFrame.sourceW,1024);
assert.equal(fallbackFrame.sourceH,681);
assert.ok(fallbackFrame.scale>0&&fallbackFrame.scale<=1,'Pre-scene projection should still fit the source stage.');

const puppet=(slot,x)=>({
  slot,
  head:{x,y:.57},torso:{x,y:.66},
  sl:{x:x-.035,y:.62},sr:{x:x+.035,y:.62},
  wl:{x:x-.06,y:.72},wr:{x:x+.06,y:.72},
  al:{x:x-.025,y:.89},ar:{x:x+.025,y:.89}
});

// With one live puppet, controller framing should stop fitting the entire host
// canvas and present the character at the comfortable near-1:1 scale.
projection.observeScene([puppet(0,.5)]);
const solo=projection.projectionFor(1024,681);
assert.ok(Math.abs(solo.scale-1.12)<1e-12,'Solo ensemble should use the comfortable puppet scale.');
const soloTorso=projection.displayPoint({x:.5,y:.66},1024,681);
assert.ok(soloTorso.x>400&&soloTorso.x<624,'Solo puppet should be centred in the visible stage.');

// A membership change must reframe the current ensemble. On a narrow portrait
// controller this is allowed to zoom out, but both players must remain visible.
const group=[puppet(0,.18),puppet(1,.82)];
assert.equal(projection.observeScene(group),true,'Adding a slot should invalidate ensemble framing.');
projection.invalidateControllerProjection();
const portrait=projection.projectionFor(480,900);
assert.ok(portrait.scale<1.12,'A genuinely wide ensemble should zoom out on a narrow controller.');
for(const p of group){
  const point=projection.displayPoint(p.torso,480,900);
  assert.ok(point.x>=0&&point.x<=480,`Joined slot ${p.slot} should be inside the portrait viewport.`);
}
assert.equal(projection.observeScene(group),false,'Ordinary movement with the same slots must not make the camera chase every packet.');

const prop={x:.4924579765564263,y:.8223294756620465};
const point=projection.displayPoint(prop,480,900);
const roundTrip=projection.displayNorm(point.x,point.y,480,900);
assert.ok(Math.abs(roundTrip.x-prop.x)<1e-12);
assert.ok(Math.abs(roundTrip.y-prop.y)<1e-12);
assert.ok(Math.abs(projection.projectionRenderScale(480,900)-portrait.scale)<1e-12);

// Objects returned from vm.runInNewContext have a different Object prototype, so
// compare values rather than realm identity here.
mode='stage';
const stagePoint=projection.displayPoint({x:.25,y:.75},800,600);
assert.equal(stagePoint.x,200);
assert.equal(stagePoint.y,450);
const stageNorm=projection.displayNorm(200,450,800,600);
assert.equal(stageNorm.x,.25);
assert.equal(stageNorm.y,.75);
assert.equal(projection.projectionRenderScale(800,600),1);

mode='controller';
sourceStage.width=80;sourceStage.height=50;
const fallback=projection.sourceStageSize();
assert.equal(fallback.width,320,'Invalid source-stage width must preserve V1 fallback size.');
assert.equal(fallback.height,360,'Invalid source-stage height must preserve V1 fallback size.');

console.log('Controller projection frames the live ensemble, keeps new slots visible, preserves inverse pointer mapping and retains stage passthrough.');
