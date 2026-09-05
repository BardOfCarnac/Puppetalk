import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./balloon-pops.js',import.meta.url),'utf8'),context,{filename:'balloon-pops.js'});
const api=context.window.PuppetalkBalloonPops;
assert.ok(api?.create,'Balloon pop candidate did not install.');

const props=new Map(),calls=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const Vector={rotate(v,a)=>({x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a)})};
const engine={world:{id:'world'}};
const Composite={remove(world,body){calls.push(['remove',world.id,body.id]);}};
const Body={setVelocity(body,v){body.velocity={...v};calls.push(['velocity',body.id,v.x,v.y]);}};
const cancelPropContest=prop=>{calls.push(['cancel',prop.id]);prop.contest=null;};
const releasePropHolder=(prop,promote)=>{calls.push(['release',prop.id,promote]);prop.heldBy=null;};
const pop=api.create({props,cancelPropContest,releasePropHolder,Composite,engine,Vector,clamp,Body});
assert.ok(pop?.driveDartBalloonPops,'Balloon pop factory failed.');

assert.equal(pop.distancePointToSegment({x:3,y:4},{x:0,y:0},{x:0,y:0}),5);
assert.equal(pop.distancePointToSegment({x:5,y:4},{x:0,y:0},{x:10,y:0}),4);
assert.equal(pop.distancePointToSegment({x:-3,y:4},{x:0,y:0},{x:10,y:0}),5);

const dart={id:'d1',type:'dart',body:{id:'db1',position:{x:100,y:100},angle:0,velocity:{x:2,y:0}},heldBy:null,contest:null,attachedTo:null};
const near={id:'b1',type:'balloon',body:{id:'bb1',position:{x:122,y:100}},heldBy:null,contest:null,attachedTo:{mode:'balloon'}};
const far={id:'b2',type:'balloon',body:{id:'bb2',position:{x:145,y:100}},heldBy:null,contest:null,attachedTo:null};
assert.equal(pop.dartTouchesBalloon(dart,near),true,'Dart segment should reach a balloon within 20px of its 46px shaft.');
assert.equal(pop.dartTouchesBalloon(dart,far),false);
dart.body.angle=Math.PI/2;
const vertical={id:'b3',type:'balloon',body:{id:'bb3',position:{x:100,y:123}},heldBy:null,contest:null,attachedTo:null};
assert.equal(pop.dartTouchesBalloon(dart,vertical),true,'Dart hit geometry must rotate with the dart.');
dart.body.angle=0;

assert.equal(pop.popBalloon(null),false);
assert.equal(pop.popBalloon({id:'x',type:'ball'}),false);
const notRegistered={id:'ghost',type:'balloon',body:{id:'ghostBody'}};
assert.equal(pop.popBalloon(notRegistered),false);

const held={id:'held',type:'balloon',body:{id:'heldBody'},heldBy:{slot:0,hand:'left'},contest:{slot:1},attachedTo:{mode:'balloon'}};
props.set(held.id,held);
assert.equal(pop.popBalloon(held),true);
assert.ok(calls.some(c=>c[0]==='cancel'&&c[1]==='held'));
assert.ok(calls.some(c=>c[0]==='release'&&c[1]==='held'&&c[2]===false));
assert.equal(held.attachedTo,null);
assert.ok(calls.some(c=>c[0]==='remove'&&c[2]==='heldBody'));
assert.equal(props.has('held'),false);

props.clear();calls.length=0;
const slow={id:'slow',type:'dart',body:{id:'slowBody',position:{x:100,y:100},angle:0,velocity:{x:1.14,y:0}},heldBy:null,contest:null,attachedTo:null};
const targetSlow={id:'slowB',type:'balloon',body:{id:'slowBB',position:{x:120,y:100}},heldBy:null,contest:null,attachedTo:null};
props.set(slow.id,slow);props.set(targetSlow.id,targetSlow);
pop.driveDartBalloonPops();
assert.equal(props.has('slowB'),true,'Darts below 1.15 speed must not pop balloons.');

props.clear();calls.length=0;
const blocked={id:'blocked',type:'dart',body:{id:'blockedBody',position:{x:100,y:100},angle:0,velocity:{x:3,y:0}},heldBy:{slot:0},contest:null,attachedTo:null};
const blockedTarget={id:'blockedB',type:'balloon',body:{id:'blockedBB',position:{x:120,y:100}},heldBy:null,contest:null,attachedTo:null};
props.set(blocked.id,blocked);props.set(blockedTarget.id,blockedTarget);
pop.driveDartBalloonPops();
assert.equal(props.has('blockedB'),true,'Held darts must be excluded from puncture scans.');

props.clear();calls.length=0;
const clusterDart={id:'dart',type:'dart',body:{id:'dartBody',position:{x:100,y:100},angle:0,velocity:{x:4,y:2}},heldBy:null,contest:null,attachedTo:null};
const b1={id:'c1',type:'balloon',body:{id:'c1b',position:{x:112,y:100}},heldBy:null,contest:null,attachedTo:null};
const b2={id:'c2',type:'balloon',body:{id:'c2b',position:{x:126,y:100}},heldBy:null,contest:null,attachedTo:null};
props.set(clusterDart.id,clusterDart);props.set(b1.id,b1);props.set(b2.id,b2);
pop.driveDartBalloonPops();
assert.equal(props.has('c1'),false);assert.equal(props.has('c2'),false,'One fast dart may puncture a cluster.');
const velocities=calls.filter(c=>c[0]==='velocity');
assert.equal(velocities.length,2);
assert.deepEqual(velocities[0],['velocity','dartBody',3.6,1.8]);
assert.deepEqual(velocities[1],['velocity','dartBody',3.6,1.8],'Each pop uses the original frame velocity and preserves V1 90% impulse call.');

console.log('Balloon pop candidate preserves V1 dart segment geometry, eligibility/speed gates, cleanup and cluster puncture velocity calls.');
