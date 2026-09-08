import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let time=0;
const context={window:{performance:{now:()=>time}},globalThis:null,Math,Date};
context.globalThis=context.window;
vm.runInNewContext(fs.readFileSync(new URL('./scene-smoothing.js',import.meta.url),'utf8'),context,{filename:'scene-smoothing.js'});
const api=context.window.PuppetalkControllerSceneSmoothing;
assert.ok(api?.create,'Controller scene smoothing did not install.');

const smoother=api.create({now:()=>time,responseMs:46});
smoother.pushScene({
  puppets:[{slot:0,mouth:0,torso:{x:.20,y:.40,a:Math.PI-.08},head:{x:.20,y:.30,a:0}}],
  props:[{id:'ball',type:'ball',x:.20,y:.50,a:0}]
});
let frame=smoother.sample();
assert.equal(frame.puppets[0].torso.x,.20,'First scene must present immediately.');
assert.equal(frame.props[0].x,.20);

// A later packet becomes the new target but must not hard-snap visible geometry.
time=66;
smoother.pushScene({
  puppets:[{slot:0,mouth:2,torso:{x:.80,y:.40,a:-Math.PI+.08},head:{x:.80,y:.30,a:.3}}],
  props:[{id:'ball',type:'ball',x:.80,y:.50,a:.4}]
});
frame=smoother.sample();
assert.ok(frame.puppets[0].torso.x>.20 && frame.puppets[0].torso.x<.80,'Received geometry should interpolate rather than snap.');
assert.equal(frame.puppets[0].mouth,2,'Discrete expression state should follow the latest authoritative snapshot immediately.');
assert.ok(Math.abs(frame.puppets[0].torso.a)>3,'Angle interpolation must take the short path across ±π.');

const afterFirstBlend=frame.puppets[0].torso.x;
time+=16;
frame=smoother.sample();
assert.ok(frame.puppets[0].torso.x>afterFirstBlend && frame.puppets[0].torso.x<.80,'Animation frames between packets must continue approaching the target.');

// Multiple packets can arrive before the next paint. The renderer should head for only
// the newest target rather than drawing every obsolete packet back-to-back.
time+=8;
smoother.pushScene({puppets:[{slot:0,mouth:1,torso:{x:.30,y:.40,a:0},head:{x:.30,y:.30,a:0}}],props:[]});
smoother.pushScene({puppets:[{slot:0,mouth:1,torso:{x:.92,y:.40,a:0},head:{x:.92,y:.30,a:0}}],props:[]});
const target=smoother.getTarget();
assert.equal(target.puppets[0].torso.x,.92,'Only the newest network state should remain authoritative.');
frame=smoother.sample();
assert.equal(frame.props.length,0,'Removed props should disappear with the authoritative snapshot.');
assert.ok(frame.puppets[0].torso.x<.92,'Newest target should still be presented smoothly.');

for(let i=0;i<30;i++){time+=16;frame=smoother.sample();}
assert.ok(Math.abs(frame.puppets[0].torso.x-.92)<.001,'Presentation should converge on the authoritative state.');

console.log('Invitee scene smoothing presents first state immediately, interpolates geometry on its own frame clock and drops obsolete packet renders.');
