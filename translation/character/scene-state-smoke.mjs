import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/character/scene-state.js','utf8'),context,{filename:'scene-state.js'});
const api=context.window.PuppetalkCharacterSceneState;
assert.ok(api?.create,'Character scene-state module did not install.');

let dims={W:1000,H:800};
const getDimensions=()=>dims;
const worldPoint=(body,local)=>({x:body.position.x+local.x,y:body.position.y+local.y});
const lookCalls=[];
const cleanLook=(look,slot)=>{lookCalls.push([look,slot]);return {kind:look.kind,slot};};
const scene=api.create({getDimensions,worldPoint,cleanLook});
assert.ok(scene?.anatomy,'Character scene-state factory did not expose anatomy.');

const body=(x,y,a=0)=>({position:{x,y},angle:a});
const p={
  slot:2,name:'Cy',color:'#333',mouth:2,rag:true,look:{kind:'spikes'},
  severedJoints:new Set(['neck','leftElbow']),brokenSeams:new Set(['torsoUpper']),
  torso:body(500,400,.3),torsoTop:body(500,374,.31),torsoBottom:body(500,426,.32),
  head:body(500,347,.4),headTop:body(500,323,.6),
  uaL:body(460,370,.1),uaL2:body(460,396,.11),faL:body(455,418,.12),faL2:body(455,442,.13),
  uaR:body(540,370,-.1),uaR2:body(540,396,-.11),faR:body(545,418,-.12),faR2:body(545,442,-.13),
  thL:body(486,450,.2),thL2:body(486,479,.21),shL:body(486,505,.22),shL2:body(486,532,.23),
  thR:body(514,450,-.2),thR2:body(514,479,-.21),shR:body(514,505,-.22),shR2:body(514,532,-.23)
};

function frozenNorm(point){return {x:point.x/dims.W,y:point.y/dims.H};}
function frozenSegmentState(b){return {x:b.position.x/dims.W,y:b.position.y/dims.H,a:b.angle||0};}
function frozenAnatomy(q){
  const W=dims.W,H=dims.H,t=q.torso;
  return {
    slot:q.slot,name:q.name,color:q.color,mouth:q.mouth,rag:q.rag,severed:[...(q.severedJoints||[])],brokenSeams:[...(q.brokenSeams||[])],
    segTorsoTop:frozenSegmentState(q.torsoTop),segTorsoBottom:frozenSegmentState(q.torsoBottom),
    segHeadLower:frozenSegmentState(q.head),segHeadTop:frozenSegmentState(q.headTop),look:{kind:q.look.kind,slot:q.slot},
    torso:{x:t.position.x/W,y:t.position.y/H,a:t.angle},
    head:{x:(q.head.position.x+q.headTop.position.x)/(2*W),y:(q.head.position.y+q.headTop.position.y)/(2*H),a:((q.head.angle||0)+(q.headTop.angle||0))*.5},
    sl:frozenNorm(worldPoint(t,{x:-24,y:-27})),sr:frozenNorm(worldPoint(t,{x:24,y:-27})),
    el:frozenNorm(worldPoint(q.uaL2,{x:0,y:13})),er:frozenNorm(worldPoint(q.uaR2,{x:0,y:13})),
    wl:frozenNorm(worldPoint(q.faL2,{x:0,y:12})),wr:frozenNorm(worldPoint(q.faR2,{x:0,y:12})),
    hl:frozenNorm(worldPoint(t,{x:-14,y:38})),hr:frozenNorm(worldPoint(t,{x:14,y:38})),
    kl:frozenNorm(worldPoint(q.thL2,{x:0,y:14.5})),kr:frozenNorm(worldPoint(q.thR2,{x:0,y:14.5})),
    al:frozenNorm(worldPoint(q.shL2,{x:0,y:13.5})),ar:frozenNorm(worldPoint(q.shR2,{x:0,y:13.5})),
    uaLt:frozenNorm(worldPoint(q.uaL,{x:0,y:-13})),faLt:frozenNorm(worldPoint(q.faL,{x:0,y:-12})),
    uaRt:frozenNorm(worldPoint(q.uaR,{x:0,y:-13})),faRt:frozenNorm(worldPoint(q.faR,{x:0,y:-12})),
    thLt:frozenNorm(worldPoint(q.thL,{x:0,y:-14.5})),shLt:frozenNorm(worldPoint(q.shL,{x:0,y:-13.5})),
    thRt:frozenNorm(worldPoint(q.thR,{x:0,y:-14.5})),shRt:frozenNorm(worldPoint(q.shR,{x:0,y:-13.5})),
    uaLmA:frozenNorm(worldPoint(q.uaL,{x:0,y:13})),uaLmB:frozenNorm(worldPoint(q.uaL2,{x:0,y:-13})),
    faLmA:frozenNorm(worldPoint(q.faL,{x:0,y:12})),faLmB:frozenNorm(worldPoint(q.faL2,{x:0,y:-12})),
    uaRmA:frozenNorm(worldPoint(q.uaR,{x:0,y:13})),uaRmB:frozenNorm(worldPoint(q.uaR2,{x:0,y:-13})),
    faRmA:frozenNorm(worldPoint(q.faR,{x:0,y:12})),faRmB:frozenNorm(worldPoint(q.faR2,{x:0,y:-12})),
    thLmA:frozenNorm(worldPoint(q.thL,{x:0,y:14.5})),thLmB:frozenNorm(worldPoint(q.thL2,{x:0,y:-14.5})),
    shLmA:frozenNorm(worldPoint(q.shL,{x:0,y:13.5})),shLmB:frozenNorm(worldPoint(q.shL2,{x:0,y:-13.5})),
    thRmA:frozenNorm(worldPoint(q.thR,{x:0,y:14.5})),thRmB:frozenNorm(worldPoint(q.thR2,{x:0,y:-14.5})),
    shRmA:frozenNorm(worldPoint(q.shR,{x:0,y:13.5})),shRmB:frozenNorm(worldPoint(q.shR2,{x:0,y:-13.5}))
  };
}

const plain=v=>JSON.parse(JSON.stringify(v));
assert.deepEqual(plain(scene.anatomy(p)),plain(frozenAnatomy(p)),'Character anatomy serialization drifted from frozen V1.');
assert.deepEqual(lookCalls,[[p.look,2]],'cleanLook must be called once with the puppet slot.');
assert.deepEqual(plain(scene.norm({x:250,y:200})),{x:.25,y:.25});
assert.deepEqual(plain(scene.segmentState(body(100,80,0))),{x:.1,y:.1,a:0});

dims={W:500,H:400};
assert.deepEqual(plain(scene.norm({x:250,y:200})),{x:.5,y:.5},'Scene-state helpers must use current dimensions, not captured startup dimensions.');
assert.equal(scene.anatomy(p).torso.x,1,'Anatomy must use current stage width.');

console.log('Character scene-state candidate exactly preserves V1 anatomy serialization and dynamic stage dimensions.');
