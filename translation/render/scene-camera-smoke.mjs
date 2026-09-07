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
assert.equal(installed.APPROVED_SCENES.length,7,'Only the seven approved Puppetalk photographs should be in rotation.');
assert.ok(installed.APPROVED_SCENES.every(scene=>scene.image.startsWith('https://images.unsplash.com/')),'Approved scene registry should use direct Unsplash image assets.');
assert.ok(installed.APPROVED_SCENES.every(scene=>scene.image.includes('fm=jpg')&&scene.image.includes('w=1600')&&!scene.image.includes('auto=format')),'Phone backdrops should request a bounded plain JPEG rather than a large negotiated format.');
const firstRoom=installed.selectForRoom('ABCDE');
const repeatRoom=installed.selectForRoom('ABCDE');
assert.equal(firstRoom.id,repeatRoom.id,'A room must always resolve to the same photograph on every device.');
assert.notEqual(firstRoom.id,'default','A valid room should resolve to an approved photograph.');

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

const retryTimers=[];
const retryBody={dataset:{}};
class FakeImage{
  static instances=[];
  constructor(){
    this.naturalWidth=1600;
    this.naturalHeight=1000;
    FakeImage.instances.push(this);
  }
  set src(value){this._src=value;}
  get src(){return this._src;}
}
const retryCamera=installed.create({
  ImageClass:FakeImage,
  documentRef:{body:retryBody},
  dispatch(){},
  addListener(){},
  getViewport:()=>({width:320,height:360}),
  setTimer:(fn,ms)=>retryTimers.push({fn,ms})
});
retryCamera.registerScene({
  id:'retry-photo',image:'https://images.unsplash.com/photo-test?fit=crop&fm=jpg&q=74&w=1600',
  floor:{horizon:.6,baseline:.89,left:.04,right:.96}
});
retryCamera.setScene('retry-photo');
assert.equal(retryCamera.frameFor(320,360).imageReady,false);
assert.equal(FakeImage.instances.length,1);
assert.equal(retryBody.dataset.sceneImage,'loading');
FakeImage.instances[0].onerror();
assert.equal(retryBody.dataset.sceneImage,'retrying','A failed mobile image request should not become a permanent grid.');
assert.equal(retryTimers.length,1,'A failed image request should schedule a retry.');
retryTimers.shift().fn();
assert.equal(FakeImage.instances.length,2,'Retry should create a fresh image request rather than reuse the failed object.');
FakeImage.instances[1].onload();
assert.equal(retryBody.dataset.sceneImage,'ready');
assert.equal(retryCamera.frameFor(320,360).imageReady,true,'A later successful retry should replace the procedural fallback.');

console.log('Scene camera owns approved room-photo selection, responsive crops, floor geometry and resilient mobile image loading.');
