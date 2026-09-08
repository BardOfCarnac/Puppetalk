import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./locomotion-runtime.js',import.meta.url),'utf8');

class Peer {
  on(){}
}

const window={
  Matter:{
    Body:{nextGroup(){return -1;},applyForce(){}},
    Engine:{update(){}}
  },
  Peer,
  PuppetalkDepthState:{
    getDepthForSlot(){return 0;},
    scaleForDepth(depth){return depth>=0?Math.min(2.58,1+depth*1.58):Math.max(.72,1+depth*.58);},
    shiftForDepth(depth){return depth>=0?depth*.245:depth*.025;}
  }
};

vm.runInNewContext(source,{window,performance:{now:()=>0},console,Math,Map,Number,Object,Array});

const {rawTorsoFromScene}=window.PuppetalkLocomotion;
assert.equal(typeof rawTorsoFromScene,'function');

const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-9,`${message}: expected ${expected}, got ${actual}`);

// Foreground depth: the display scene moves the torso down by the depth shift.
// Locomotion must remove that visual offset before using the torso as a physics anchor.
{
  const depth=.44;
  const rawY=.6;
  const projectedY=rawY+window.PuppetalkDepthState.shiftForDepth(depth);
  const raw=rawTorsoFromScene({slot:2,depth,torso:{x:.31,y:projectedY}});
  near(raw.x,.31,'foreground x');
  near(raw.y,rawY,'foreground y');
}

// Background depth uses a small negative visual shift and must also round-trip.
{
  const depth=-.36;
  const rawY=.6;
  const projectedY=rawY+window.PuppetalkDepthState.shiftForDepth(depth);
  const raw=rawTorsoFromScene({slot:2,depth,torso:{x:.63,y:projectedY}});
  near(raw.x,.63,'background x');
  near(raw.y,rawY,'background y');
}

// Neutral scenes remain untouched.
{
  const raw=rawTorsoFromScene({slot:2,depth:0,torso:{x:.5,y:.61}});
  near(raw.x,.5,'neutral x');
  near(raw.y,.61,'neutral y');
}

console.log('locomotion runtime depth-feedback smoke passed');
