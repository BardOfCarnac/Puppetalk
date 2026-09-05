import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/character/input-system.js','utf8'),context,{filename:'input-system.js'});
const api=context.window.PuppetalkCharacterInputSystem;
assert.ok(api?.create,'Character input system did not install.');

const GRAB_PARTS=new Set(['torso','pelvis','leftShoulder','rightShoulder','head','leftHand','rightHand','leftFoot','rightFoot']);
const POSES={stand:[0],point:[1],cheer:[2],shrug:[3],crouch:[4]};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const puppets=new Map();
const makeCalls=[];
const makePuppet=slot=>{
  makeCalls.push(slot);
  if(!puppets.has(slot)) puppets.set(slot,{
    grabs:[{part:'head',x:.4,y:.4}],grabbing:true,grabPart:'head',grabTarget:{x:.4,y:.4},
    pose:'stand',poseVersion:2,rag:false,mouth:1
  });
  return puppets.get(slot);
};
const system=api.create({makePuppet,GRAB_PARTS,POSES,clamp});
assert.ok(system?.applyInput,'Character input system did not expose applyInput.');

system.applyInput(1,{type:'look',input:{grabbing:true}});
assert.equal(makeCalls.length,0,'Non-input messages must not construct/access a puppet.');

system.applyInput(1,{type:'input',input:{
  grabs:[
    {part:'leftHand',x:-1,y:2},
    {part:'bogus',x:.2,y:.2},
    {part:'rightFoot',x:.7,y:.8}
  ],
  pose:'cheer',poseVersion:7,rag:true,mouth:9
}});
let p=puppets.get(1);
assert.deepEqual(makeCalls.splice(0),[1]);
assert.deepEqual(JSON.parse(JSON.stringify(p.grabs)),[{part:'leftHand',x:.02,y:.96}], 'V1 slices to two grabs before filtering invalid parts.');
assert.equal(p.grabbing,true);
assert.equal(p.grabPart,'leftHand');
assert.deepEqual(p.grabTarget,{x:.02,y:.96});
assert.equal(p.pose,'cheer');
assert.equal(p.poseVersion,7);
assert.equal(p.rag,true);
assert.equal(p.mouth,2);

system.applyInput(1,{type:'input',input:{grabs:[{part:'rightHand',x:NaN,y:Infinity}],pose:'missing',poseVersion:2.5,rag:'yes',mouth:1.2}});
p=puppets.get(1);
assert.deepEqual(JSON.parse(JSON.stringify(p.grabs)),[{part:'rightHand',x:.5,y:.55}], 'Invalid grab coordinates must fall back to V1 defaults.');
assert.equal(p.pose,'cheer','Unknown pose must leave current pose unchanged.');
assert.equal(p.poseVersion,7,'Non-integer poseVersion must be ignored.');
assert.equal(p.rag,true,'Non-boolean rag value must be ignored.');
assert.equal(p.mouth,2,'Non-integer mouth value must be ignored.');

system.applyInput(1,{type:'input',input:{grabs:[],grabbing:true,grabPart:'pelvis',x:.33,y:.44,mouth:-3}});
p=puppets.get(1);
assert.deepEqual(JSON.parse(JSON.stringify(p.grabs)),[{part:'pelvis',x:.33,y:.44}], 'Legacy single-grab input must still translate into the grab array.');
assert.equal(p.grabPart,'pelvis');
assert.deepEqual(p.grabTarget,{x:.33,y:.44});
assert.equal(p.mouth,0);

const previousTarget={...p.grabTarget};
system.applyInput(1,{type:'input',input:{grabs:[],grabbing:false}});
p=puppets.get(1);
assert.deepEqual(JSON.parse(JSON.stringify(p.grabs)),[]);
assert.equal(p.grabbing,false);
assert.equal(p.grabPart,'pelvis','V1 leaves grabPart untouched when grabs clear.');
assert.deepEqual(p.grabTarget,previousTarget,'V1 leaves the last grab target untouched when grabs clear.');

system.applyInput(1,{type:'input'});
assert.deepEqual(JSON.parse(JSON.stringify(p.grabs)),[],'Missing input object behaves like an empty input.');

console.log('Character input candidate exactly preserves V1 grab normalization, legacy input fallback and pose/rag/mouth updates.');
