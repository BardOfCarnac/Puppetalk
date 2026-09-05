import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./prop-input.js',import.meta.url),'utf8'),context,{filename:'prop-input.js'});
const api=context.window.PuppetalkPropInput;
assert.ok(api?.create,'Prop input candidate did not install.');

const props=new Map(),conns=new Map([[0,{id:'conn0'}]]),puppets=new Map();
const calls=[];
let clock=1000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const Body={
  setVelocity(body,v){body.velocity={...v};calls.push(['velocity',v.x,v.y]);},
  setAngularVelocity(body,v){body.angularVelocity=v;calls.push(['spin',v]);}
};
const send=(conn,msg)=>calls.push(['send',conn?.id,JSON.parse(JSON.stringify(msg))]);
const validPropEffector=hand=>['left','right','leftFoot','rightFoot'].includes(hand);
const handPoint=(p,hand)=>p.points[hand];
const freePropHand=()=>true;
const detachPropAttachment=prop=>{prop.attachedTo=null;calls.push(['detach',prop.id]);return true;};
const beginPropHold=(prop,slot,hand)=>{prop.heldBy={slot,hand};calls.push(['hold',prop.id,slot,hand]);return true;};
const nearestBalloonTarget=()=>null;
const tieBalloonToBody=()=>false;
const cancelPropContest=prop=>{calls.push(['cancel',prop.id]);prop.contest=null;};
const promotePropContest=prop=>{calls.push(['promote',prop.id]);prop.heldBy={slot:prop.contest.slot,hand:prop.contest.hand};prop.contest=null;return true;};
const beginPropContest=(prop,slot,hand,now)=>{prop.contest={slot,hand,score:.18,lastTapAt:now,lastUpdateAt:now};calls.push(['contest',prop.id,slot,hand,now]);return true;};
const releasePropHolder=(prop,promote)=>{calls.push(['release',prop.id,promote]);prop.heldBy=null;};
let grip=null;
const gripRecord=()=>grip;
const handBody=p=>p.handBody;
const inflatePumpBalloon=prop=>({ok:true,inflated:prop.id});
const releasePumpBalloon=prop=>!!prop?.releaseable;
const getDimensions=()=>({W:900,H:650});
const now=()=>clock++;
const getDepthForSlot=()=>.42;
const projectPropPoint=(prop,slot)=>({x:prop.body.position.x+slot,y:prop.body.position.y,depth:prop._depth});

const input=api.create({props,conns,puppets,send,validPropEffector,handPoint,freePropHand,detachPropAttachment,beginPropHold,nearestBalloonTarget,tieBalloonToBody,cancelPropContest,promotePropContest,beginPropContest,releasePropHolder,gripRecord,handBody,clamp,Body,inflatePumpBalloon,releasePumpBalloon,getDimensions,now,getDepthForSlot,projectPropPoint});
assert.ok(input?.handlePropInput,'Prop input factory failed.');

const puppet={points:{left:{x:100,y:100},right:{x:100,y:100},leftFoot:{x:100,y:100},rightFoot:{x:100,y:100}},handBody:{velocity:{x:2,y:-1},angularVelocity:.1}};
puppets.set(0,puppet);
const ball={id:'ball1',type:'ball',body:{position:{x:185,y:100},velocity:{x:0,y:0},angularVelocity:0},heldBy:null,contest:null,attachedTo:null};
props.set(ball.id,ball);
assert.equal(input.propHandIsClose(0,'left',ball),true,'Generic prop reach must remain 86px.');
ball.body.position.x=187;
assert.equal(input.propHandIsClose(0,'left',ball),false,'Generic prop reach must stop beyond 86px.');

const frisbee={id:'f1',type:'frisbee',body:{position:{x:220,y:100},velocity:{x:3,y:0},angularVelocity:0},heldBy:null,contest:null,attachedTo:null};
props.set(frisbee.id,frisbee);
assert.equal(input.propHandIsClose(0,'left',frisbee),true,'Slow frisbee reach must remain 122px.');
frisbee.body.velocity.x=4;
assert.equal(input.propHandIsClose(0,'left',frisbee),false,'Fast frisbee reach must fall to 102px.');

ball.body.position.x=150;
let result=input.tapProp(0,{propId:'ball1',hand:'left'});
assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true,message:'Picked up ball.'});
assert.deepEqual(ball.heldBy,{slot:0,hand:'left'});

ball.heldBy={slot:1,hand:'right'};
ball.contest=null;
result=input.tapProp(0,{propId:'ball1',hand:'left'});
assert.equal(result.ok,true);
assert.match(result.message,/Tugging ball/);
assert.equal(ball.contest.slot,0);
assert.equal(ball.contest.hand,'left');
assert.equal(ball.contest.score,.18);

ball.contest.score=.95;
result=input.tapProp(0,{propId:'ball1',hand:'left'});
assert.equal(result.message,'Pulled the ball free.');
assert.deepEqual(ball.heldBy,{slot:0,hand:'left'});
assert.equal(ball.contest,null);

const balloon={id:'b1',type:'balloon',body:{position:{x:150,y:100},velocity:{x:0,y:0},angularVelocity:0},heldBy:{slot:0,hand:'left'},contest:{slot:2,hand:'right',score:.1,lastTapAt:0,lastUpdateAt:0},attachedTo:null};
props.set(balloon.id,balloon);
result=input.tapProp(0,{propId:'b1',hand:'left'});
assert.equal(result.message,'Held your ground.');
assert.equal(balloon.contest,null,'Holder tap must cancel a contest when the score reaches zero.');

const thrown={id:'f2',type:'frisbee',body:{position:{x:200,y:200},velocity:{x:1,y:2},angularVelocity:.05,isSensor:false},heldBy:{slot:0,hand:'left'},contest:null,attachedTo:null};
props.set(thrown.id,thrown);
grip={propId:'f2'};
result=input.throwHeldProp(0,{hand:'left',vx:1.5,vy:-.5});
assert.equal(result.ok,true);
assert.equal(result.thrown,true);
assert.equal(thrown._throwerSlot,0);
assert.equal(thrown._depth,.42);
assert.equal(thrown._depthAssistUntil,2753);
assert.equal(thrown._cutArmed,true);
assert.equal(thrown._thrownAt,1004);
assert.equal(thrown.body.isSensor,true);
assert.deepEqual(thrown._frisbeePrev,{x:200,y:200,depth:.42});
assert.ok(Math.hypot(thrown.body.velocity.x,thrown.body.velocity.y)<=17+1e-12,'Throw speed cap must remain 17.');
assert.ok(Math.abs(thrown.body.angularVelocity)<=.58+1e-12,'Frisbee spin cap must remain .58.');

const heldA={id:'heldA',contest:{slot:0,hand:'left'},heldBy:null};
const heldB={id:'heldB',contest:null,heldBy:{slot:0,hand:'right'}};
props.set('heldA',heldA);props.set('heldB',heldB);
input.releaseAllPropGrips(0);
assert.ok(calls.some(c=>c[0]==='cancel'&&c[1]==='heldA'));
assert.ok(calls.some(c=>c[0]==='release'&&c[1]==='heldB'&&c[2]===true));

const pump={id:'pump1',type:'pump'};
props.set('pump1',pump);
input.handlePropInput(0,{type:'prop',action:'pump',propId:'pump1'});
let sent=calls.filter(c=>c[0]==='send').at(-1)[2];
assert.deepEqual(sent,{type:'prop-result',propId:'pump1',ok:true,inflated:'pump1'});
const releaseable={id:'b2',type:'balloon',releaseable:true};
props.set('b2',releaseable);
input.handlePropInput(0,{type:'prop',action:'release-pump-balloon',propId:'b2'});
sent=calls.filter(c=>c[0]==='send').at(-1)[2];
assert.deepEqual(sent,{type:'prop-result',propId:'b2',ok:true,message:'Released balloon.'});

console.log('Prop input candidate preserves V1 reach, tap/tug/hold semantics, release-all behaviour, throw caps/depth/frisbee arming and prop-result dispatch.');
