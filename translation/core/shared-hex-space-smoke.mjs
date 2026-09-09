import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root={};
const context={window:root,globalThis:root,Math,Number,Object,Array};
vm.runInNewContext(fs.readFileSync(new URL('./shared-hex-space.js',import.meta.url),'utf8'),context,{filename:'shared-hex-space.js'});
const hex=root.PuppetalkSharedHex;
assert.ok(hex,'Shared hex geometry did not install.');
assert.deepEqual(Array.from(hex.LEVELS),[-1,-.5,-.25,0,.25,.5,1]);
assert.deepEqual(Array.from(hex.SEAT_ORDER),[0,3,1,4,2,5]);
assert.equal(hex.NODES.length,19,'Complete vertex-chord intersections should produce 19 shared nodes.');

for(const node of hex.NODES){
  assert.ok(hex.insideHex(node),'Every crossing node must lie in the shared hex.');
  for(let viewer=0;viewer<6;viewer++){
    const depth=hex.projectWorld(node,viewer).z;
    const plane=hex.nearestPlane(depth);
    assert.ok(Math.abs(depth-plane)<1e-7,'Every shared crossing must land exactly on one of the seven planes from every view.');
  }
}

for(let viewer=0;viewer<6;viewer++){
  for(const depth of hex.LEVELS){
    for(const x of [.08,.5,.92]){
      const world=hex.worldFromView(x,depth,viewer);
      const view=hex.viewFromWorld(world,viewer);
      assert.ok(hex.insideHex(world));
      assert.ok(Math.abs(view.depth-depth)<1e-7,'View-to-world-to-view should preserve depth.');
      if(Math.abs(depth)<.999){
        assert.ok(Math.abs(view.screenX-x)<1e-7,'View-to-world-to-view should preserve horizontal screen position.');
      }
    }
  }
}

const p=hex.worldFromView(.19,.5,0);
const opposite=hex.viewFromWorld(p,1); // slot 1 is the opposite seat via [0,3,1,4,2,5]
assert.ok(Math.abs(opposite.depth+.5)<1e-7,'Opposite viewer should reverse shared depth.');

console.log('Shared hex exposes six coherent flattenings, seven exact depth planes and the 19 common chord intersections.');
