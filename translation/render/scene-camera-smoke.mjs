import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('./scene-camera.js',import.meta.url),'utf8');
const body={dataset:{}};
const root={document:{body},innerWidth:320,innerHeight:360,addEventListener(){},setTimeout(fn){fn();}};
const context={window:root,globalThis:root,Map,Math,Number,String,Array};
vm.runInNewContext(source,context,{filename:'scene-camera.js'});

const installed=root.PuppetalkSceneCamera;
assert.ok(installed?.create,'Scene camera did not install.');
assert.equal(installed.profileFor(320,600),'tall');
assert.equal(installed.profileFor(900,500),'wide');
assert.equal(installed.profileFor(600,600),'standard');
assert.equal(body.dataset.sceneProfile,'standard','Installed camera should keep the page profile current.');

const events=[];
const camera=installed.create({
  documentRef:{body:{dataset:{}}},
  dispatch:(type,detail)=>events.push({type,detail}),
  addListener(){},
  getViewport:()=>({width:600,height:400}),
  setTimer:fn=>fn()
});

const scene=camera.registerScene({
  id:'workshop',label:'Workshop',
  floor:{horizon:.5,baseline:.8,left:.1,right:.9},
  crops:{wide:{focusX:.4,focusY:.55,zoom:1.2}}
});
assert.equal(scene.id,'workshop');
assert.equal(camera.setScene('workshop').id,'workshop');
assert.deepEqual(events.map(event=>event.type),['puppetalk-scene-change','resize']);

const frame=camera.stageFrame(1000,500);
assert.equal(frame.sceneId,'workshop');
assert.equal(frame.profile,'wide');
assert.equal(frame.floorY,400);
assert.equal(frame.horizonY,250);
assert.equal(frame.floorLeft,100);
assert.equal(frame.floorRight,900);

assert.equal(camera.setScene('missing').id,'default','Unknown scene ids should return to the default stage.');
assert.equal(camera.stageFrame(320,360).sceneId,'default');

console.log('Scene camera owns responsive profiles, scene registration/selection and floor geometry without source rewriting.');
