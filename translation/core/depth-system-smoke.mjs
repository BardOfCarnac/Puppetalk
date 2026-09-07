import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let clock=1000;
const events=[];
const root={
  innerWidth:900,innerHeight:600,
  performance:{now:()=>clock},
  Event:class Event{constructor(type){this.type=type;}},
  dispatchEvent:event=>events.push(event.type)
};
const context={window:root,globalThis:root,Map,Math,Number,Date,Object,Array};
vm.runInNewContext(fs.readFileSync(new URL('./depth-system.js',import.meta.url),'utf8'),context,{filename:'depth-system.js'});

const system=root.PuppetalkDepthSystem;
assert.ok(system?.createStage&&system?.createController,'Depth system did not install.');
assert.deepEqual(Array.from(system.tuning.planes),[-.48,-.36,-.24,-.12,0,.11,.22,.33,.44,.55,.66,.77,.88,1]);
assert.equal(root.PuppetalkDepthState.getPlaneForSlot(0),4);
assert.equal(root.PuppetalkDepthState.getDepthForSlot(0),0);

const stage=system.createStage({now:()=>clock});
assert.equal(stage.stepDepth(0,1),true);
assert.equal(stage.getPlaneForSlot(0),5,'Closer gesture should advance exactly one discrete plane.');
for(let i=0;i<6;i++){
  clock+=150;
  stage.getDepthForSlot(0);
}
const closer=stage.getDepthForSlot(0);
assert.ok(Math.abs(closer-.11)<.01,'Closer plane should settle smoothly at its target across successive frames.');
assert.ok(system.scaleForDepth(closer)>1,'Closer depth should enlarge the puppet.');
assert.equal(stage.stepDepth(0,-1),true);
for(let i=0;i<6;i++){
  clock+=150;
  stage.getDepthForSlot(0);
}
assert.ok(Math.abs(stage.getDepthForSlot(0))<.01,'Away gesture should return one plane toward neutral across successive frames.');

const scene={type:'scene',puppets:[{slot:0,torso:{x:.5,y:.5},head:{x:.5,y:.35},wl:{x:.4,y:.5},wr:{x:.6,y:.5}}],props:[]};
const tuned=stage.tuneScene(scene,{width:1024,height:681,time:clock});
assert.deepEqual(JSON.parse(JSON.stringify(tuned.stageViewport)),{width:1024,height:681});
assert.equal(tuned.puppets[0].depthPlane,4);
assert.equal(tuned.puppets[0].visualScale,1);

clock=4000;
const directions=[];
const controller=system.createController({now:()=>clock,dispatch:type=>events.push(type)});
const down={grabs:[{part:'torso',x:.5,y:.5,screenY:250}]};
const up={grabs:[]};
for(let i=0;i<3;i++){
  controller.observeInput(down,d=>directions.push(d));clock+=35;
  controller.observeInput(up,d=>directions.push(d));clock+=45;
}
assert.deepEqual(directions,[1],'Three quick torso taps should request one closer step.');

clock+=100;
controller.observeInput(down,d=>directions.push(d));clock+=300;
controller.observeInput(up,d=>directions.push(d));
assert.deepEqual(directions,[1,-1],'A short long-press should request one away step.');

controller.updateSourceStage({type:'scene',stageViewport:{width:1024,height:681}});
assert.deepEqual(JSON.parse(JSON.stringify(root.PuppetalkSourceStage)),{width:1024,height:681});
assert.ok(events.includes('puppetalk-stage-viewport'),'Controller should announce source-stage size changes for projection.');

console.log('Depth system preserves discrete closer/away gestures, smooth frame-by-frame plane travel, scene scaling and source-stage projection updates without Peer monkeypatching.');
