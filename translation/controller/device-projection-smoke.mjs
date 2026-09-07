import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const sourceStage={width:1024,height:681};
const camera={stageFrame:()=>({sceneId:'default',profile:'wide',floorY:599.28,floorLeft:0,floorRight:1024})};
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
const frame=projection.projectionFor(1024,681);
assert.equal(frame.sourceW,1024);
assert.equal(frame.sourceH,681);
assert.ok(Math.abs(frame.scale-.9577777777777777)<1e-12,'Projection scale drifted from frozen V1 geometry.');
assert.ok(Math.abs(frame.offsetX-21.617777777777803)<1e-9);
assert.ok(Math.abs(frame.offsetY-12.258)<1e-9);

const prop={x:.4924579765564263,y:.9223294756620465};
const point=projection.displayPoint(prop,1024,681);
assert.ok(Math.abs(point.x-504.6030515673765)<1e-9,'Projected frisbee X no longer matches the live parity specimen.');
assert.ok(Math.abs(point.y-613.8443260689843)<1e-9,'Projected frisbee Y no longer matches the live parity specimen.');
const roundTrip=projection.displayNorm(point.x,point.y,1024,681);
assert.ok(Math.abs(roundTrip.x-prop.x)<1e-12);
assert.ok(Math.abs(roundTrip.y-prop.y)<1e-12);
assert.ok(Math.abs(projection.projectionRenderScale(1024,681)-frame.scale)<1e-12);

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

console.log('Controller projection preserves V1 source-stage fit, live frisbee screen coordinates, inverse pointer mapping and stage passthrough.');
