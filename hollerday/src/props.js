import { depthScale, depthShift } from "./behaviour.js";
import { cutCandidateAlongPath, severCandidate } from "./segmentation.js";

const { Bodies, Body, Composite, Constraint, Events, Vector } = Matter;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function worldPoint(body,local){const r=Vector.rotate(local,body.angle);return{x:body.position.x+r.x,y:body.position.y+r.y};}
function localPoint(body,world){return Vector.rotate({x:world.x-body.position.x,y:world.y-body.position.y},-body.angle);}
function handBody(puppet,hand){if(!puppet)return null;if(hand==="left")return puppet.parts.lowerArmL2||puppet.parts.lowerArmL;if(hand==="right")return puppet.parts.lowerArmR2||puppet.parts.lowerArmR;return null;}
function handPoint(puppet,hand){const body=handBody(puppet,hand);return body?worldPoint(body,{x:0,y:body===puppet.parts.lowerArmL2||body===puppet.parts.lowerArmR2?12:23}):null;}
function handLocalPoint(puppet,hand){const body=handBody(puppet,hand);return body&&(body===puppet.parts.lowerArmL2||body===puppet.parts.lowerArmR2)?{x:0,y:12}:{x:0,y:23};}
function gripKey(playerId,hand){return `${playerId}:${hand}`;}

export function createPropSystem(engine,puppets){
  const props=new Map();
  const grips=new Map();
  let nextId=1;

  function makeProp(type,x,y,ownerPlayerId=null){
    const id=`prop-${nextId++}`;
    let body,gripPoint={x:0,y:0};
    if(type==="ball") body=Bodies.circle(x,y,16,{density:.0008,restitution:.9,friction:.24,frictionAir:.006});
    else if(type==="balloon") body=Bodies.circle(x,y,18,{density:.00018,restitution:.38,friction:.18,frictionAir:.028});
    else if(type==="frisbee") body=Bodies.circle(x,y,21,{density:.00038,restitution:.16,friction:.18,frictionAir:.004});
    else if(type==="pump") { body=Bodies.rectangle(x,y,16,58,{density:.0012,restitution:.05,friction:.82,frictionAir:.02,chamfer:{radius:4}});gripPoint={x:0,y:-18}; }
    else {body=Bodies.rectangle(x,y,44,6,{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});gripPoint={x:-13,y:0};}
    body.label=`hollerday-prop:${id}:${type}`;
    const owner=ownerPlayerId?puppets.get(`puppet-${ownerPlayerId}`):null;
    const prop={id,type,body,gripPoint,heldBy:null,contest:null,ownerPlayerId,attached:null,depth:Number(owner?.behaviour?.depth)||0,cutArmed:false,previous:null,thrownAt:0,special:false};
    props.set(id,prop);Composite.add(engine.world,body);return prop;
  }

  function removeProp(prop){if(!prop)return;for(const[key,grip]of[...grips])if(grip.propId===prop.id)clearGrip(key);if(prop.attached?.constraint)Composite.remove(engine.world,prop.attached.constraint,true);Composite.remove(engine.world,prop.body,true);props.delete(prop.id);}
  function clearGrip(key){const grip=grips.get(key);if(!grip)return null;Composite.remove(engine.world,grip.constraint,true);grips.delete(key);const prop=props.get(grip.propId);if(prop){if(grip.role==="holder"&&prop.heldBy?.playerId===grip.playerId&&prop.heldBy?.hand===grip.hand)prop.heldBy=null;if(grip.role==="contest"&&prop.contest?.playerId===grip.playerId&&prop.contest?.hand===grip.hand)prop.contest=null;}return grip;}
  function handFree(playerId,hand,propId=null){const grip=grips.get(gripKey(playerId,hand));return !grip||grip.propId===propId;}

  function makeGrip(prop,playerId,hand,stiffness,role){
    const puppet=puppets.get(`puppet-${playerId}`),body=handBody(puppet,hand);if(!body||!handFree(playerId,hand,prop.id))return null;
    const constraint=Constraint.create({bodyA:body,pointA:handLocalPoint(puppet,hand),bodyB:prop.body,pointB:prop.gripPoint,length:3,stiffness,damping:.19});
    Composite.add(engine.world,constraint);const grip={propId:prop.id,constraint,role,playerId,hand};grips.set(gripKey(playerId,hand),grip);return grip;
  }

  function cancelContest(prop){const tug=prop?.contest;if(!tug)return;clearGrip(gripKey(tug.playerId,tug.hand));prop.contest=null;if(prop.heldBy){const holder=grips.get(gripKey(prop.heldBy.playerId,prop.heldBy.hand));if(holder)holder.constraint.stiffness=.88;}}
  function promoteContest(prop){const tug=prop?.contest;if(!tug)return false;if(prop.heldBy)clearGrip(gripKey(prop.heldBy.playerId,prop.heldBy.hand));const record=grips.get(gripKey(tug.playerId,tug.hand));if(!record)return false;record.role="holder";record.constraint.stiffness=.88;prop.heldBy={playerId:tug.playerId,hand:tug.hand};prop.ownerPlayerId=tug.playerId;prop.contest=null;return true;}
  function beginHold(prop,playerId,hand){const grip=makeGrip(prop,playerId,hand,.88,"holder");if(!grip)return false;prop.heldBy={playerId,hand};prop.ownerPlayerId=playerId;prop.cutArmed=false;prop.body.isSensor=false;const puppet=puppets.get(`puppet-${playerId}`);prop.depth=Number(puppet?.behaviour?.depth)||0;return true;}
  function beginContest(prop,playerId,hand,now){const grip=makeGrip(prop,playerId,hand,.17,"contest");if(!grip)return false;prop.contest={playerId,hand,score:.18,lastTapAt:now,lastUpdateAt:now};return true;}

  function nearestHand(playerId,prop,maxDistance=86){const puppet=puppets.get(`puppet-${playerId}`);if(!puppet)return null;let best=null;for(const hand of["left","right"]){const point=handPoint(puppet,hand);if(!point)continue;const distance=Math.hypot(prop.body.position.x-point.x,prop.body.position.y-point.y);if(distance<=maxDistance&&(!best||distance<best.distance))best={hand,distance};}return best?.hand||null;}
  function tapProp(playerId,propId,requestedHand=null){const prop=props.get(propId);if(!prop)return{ok:false,message:"That object is gone."};const hand=(requestedHand==="left"||requestedHand==="right")?requestedHand:nearestHand(playerId,prop);if(!hand)return{ok:false,message:"Move a hand a little closer first."};const hp=handPoint(puppets.get(`puppet-${playerId}`),hand);if(!hp||Math.hypot(prop.body.position.x-hp.x,prop.body.position.y-hp.y)>86)return{ok:false,message:"Move a hand a little closer first."};const now=performance.now();if(!prop.heldBy){if(!handFree(playerId,hand,prop.id)||!beginHold(prop,playerId,hand))return{ok:false,message:"That hand is already holding something."};return{ok:true,message:`Picked up ${prop.type}.`};}if(prop.heldBy.playerId===playerId){if(prop.contest){prop.contest.score=Math.max(0,prop.contest.score-.19);prop.contest.lastTapAt=now;prop.contest.lastUpdateAt=now;if(prop.contest.score<=.01)cancelContest(prop);return{ok:true,message:"Held your ground."};}return{ok:true,message:`Still holding ${prop.type}.`};}if(prop.contest){if(prop.contest.playerId!==playerId)return{ok:false,message:"Someone else is already tugging at it."};if(prop.contest.hand!==hand)return{ok:false,message:"Keep using the same hand for this tug."};prop.contest.score=Math.min(1.05,prop.contest.score+.19);prop.contest.lastTapAt=now;prop.contest.lastUpdateAt=now;if(prop.contest.score>=1){promoteContest(prop);return{ok:true,message:`Pulled the ${prop.type} free.`};}return{ok:true,message:`Tugging ${prop.type} — keep tapping.`};}if(!handFree(playerId,hand,prop.id)||!beginContest(prop,playerId,hand,now))return{ok:false,message:"That hand is already holding something."};return{ok:true,message:`Tugging ${prop.type} — keep tapping.`};}
  function toggleGrip(playerId,hand){const key=gripKey(playerId,hand),existing=grips.get(key);if(existing){const prop=props.get(existing.propId);if(existing.role==="contest")cancelContest(prop);else{clearGrip(key);if(prop?.contest)promoteContest(prop);}return{ok:true,held:false,message:`Released ${hand} hand.`};}const puppet=puppets.get(`puppet-${playerId}`);if(!puppet)return{ok:false,message:"Your puppet is not ready yet."};const hp=handPoint(puppet,hand);let best=null;for(const prop of props.values()){if(prop.attached)continue;const d=Math.hypot(prop.body.position.x-hp.x,prop.body.position.y-hp.y);if(d<=74&&(!best||d<best.distance))best={prop,distance:d};}if(!best)return{ok:false,message:`Move your ${hand} hand closer to a prop.`};return tapProp(playerId,best.prop.id,hand);}
  function heldProp(playerId,hand){const grip=grips.get(gripKey(playerId,hand));return grip?.role==="holder"?props.get(grip.propId):null;}

  function throwHeld(playerId,hand,velocity=null){const prop=heldProp(playerId,hand);if(!prop)return{ok:false,message:`Nothing in ${hand} hand.`};const puppet=puppets.get(`puppet-${playerId}`),hb=handBody(puppet,hand);const v=velocity||{x:(hb?.velocity?.x||0)*1.35+(hand==="left"?-2.8:2.8),y:(hb?.velocity?.y||0)*1.15-1.2};if(prop.contest)cancelContest(prop);clearGrip(gripKey(playerId,hand));Body.setVelocity(prop.body,{x:clamp(v.x,-16,16),y:clamp(v.y,-16,16)});prop.ownerPlayerId=playerId;prop.depth=Number(puppet?.behaviour?.depth)||0;prop.previous={...prop.body.position};prop.thrownAt=performance.now();if(prop.type==="frisbee"){prop.cutArmed=true;prop.body.isSensor=true;Body.setAngularVelocity(prop.body,.42*Math.sign(v.x||1));}return{ok:true,message:`Threw ${prop.type}.`};}
  function bringOut(playerId,type){const puppet=puppets.get(`puppet-${playerId}`);if(!puppet)return{ok:false,message:"Your puppet is not ready yet."};const existing=[...props.values()].find(p=>p.ownerPlayerId===playerId&&p.special);if(existing)return{ok:false,message:`${existing.type} is already out.`};const valid=["frisbee","pump","ball","dart"],chosen=valid.includes(type)?type:"ball",hand=handPoint(puppet,"right"),x=clamp(chosen==="pump"?puppet.parts.torso.position.x+70:hand.x+38,30,970),y=chosen==="pump"?560:clamp(hand.y-8,46,570),prop=makeProp(chosen,x,y,playerId);prop.special=true;return{ok:true,propId:prop.id,type:chosen,message:`Brought out ${chosen}.`};}
  function useHeld(playerId,hand){const prop=heldProp(playerId,hand);if(!prop)return{ok:false,message:`Nothing in ${hand} hand.`};if(prop.type==="pump"){const balloon=makeProp("balloon",prop.body.position.x+28,prop.body.position.y-42,playerId);balloon.special=false;return{ok:true,message:"Inflated a balloon."};}if(prop.type==="frisbee"){prop.cutArmed=true;return{ok:true,message:"Frisbee armed."};}return{ok:false,message:`${prop.type} has no separate use action.`};}

  function stickDart(prop,body,point){if(prop.attached||prop.heldBy)return;const constraint=Constraint.create({bodyA:prop.body,pointA:{x:13,y:0},bodyB:body,pointB:localPoint(body,point),length:0,stiffness:.96,damping:.2});Composite.add(engine.world,constraint);prop.attached={body,constraint};Body.setVelocity(prop.body,{x:body.velocity.x,y:body.velocity.y});}
  Events.on(engine,"collisionStart",event=>{for(const pair of event.pairs){const pa=[...props.values()].find(p=>p.body===pair.bodyA||p.body===pair.bodyB);if(!pa)continue;const other=pa.body===pair.bodyA?pair.bodyB:pair.bodyA,puppet=[...puppets.values()].find(p=>Object.values(p.parts).includes(other));if(pa.type==="dart"&&puppet){const support=pair.collision?.supports?.[0]||pa.body.position;stickDart(pa,other,support);}if(pa.type==="dart"){const balloon=[...props.values()].find(p=>p.type==="balloon"&&p.body===other);if(balloon)removeProp(balloon);}}});
  function updateContest(prop,now){const tug=prop.contest;if(!tug||!prop.heldBy)return;const holder=grips.get(gripKey(prop.heldBy.playerId,prop.heldBy.hand)),challenger=grips.get(gripKey(tug.playerId,tug.hand));if(!holder||!challenger){cancelContest(prop);return;}const dt=clamp((now-tug.lastUpdateAt)/1000,0,.08);tug.lastUpdateAt=now;if(now-tug.lastTapAt>260)tug.score=Math.max(0,tug.score-dt*.12);tug.score=clamp(tug.score,0,1.05);holder.constraint.stiffness=.86-tug.score*.58;challenger.constraint.stiffness=.14+tug.score*.72;if(tug.score>=1)promoteContest(prop);else if(tug.score<=0&&now-tug.lastTapAt>700)cancelContest(prop);}

  function driveFrisbee(prop){
    if(!prop.cutArmed||prop.heldBy||prop.attached){if(prop.body)prop.body.isSensor=false;return;}
    const current={...prop.body.position},previous=prop.previous||current;prop.previous=current;
    const linear=Math.hypot(prop.body.velocity.x,prop.body.velocity.y),spin=Math.abs(prop.body.angularVelocity||0),edgeSpeed=linear+spin*23,age=performance.now()-prop.thrownAt;
    const dangerous=linear>=5.2&&spin>=.12&&edgeSpeed>=8.8;
    prop.body.isSensor=!!dangerous;
    if(!dangerous){if(linear<3.5&&age>280)prop.cutArmed=false;if(!prop.cutArmed)prop.body.isSensor=false;return;}
    let best=null;
    for(const puppet of puppets.values()){
      if(puppet.ownerPlayerId===prop.ownerPlayerId&&age<180)continue;
      const candidate=cutCandidateAlongPath(puppet,previous,current);if(candidate&&(!best||candidate.distance<best.candidate.distance))best={puppet,candidate};
    }
    if(best&&severCandidate(best.puppet,best.candidate)){prop.cutArmed=false;prop.body.isSensor=false;Body.setVelocity(prop.body,{x:prop.body.velocity.x*.76,y:prop.body.velocity.y*.76});}
  }

  function step(){const now=performance.now();for(const prop of props.values()){if(prop.type==="balloon"&&!prop.heldBy)Body.applyForce(prop.body,prop.body.position,{x:0,y:-prop.body.mass*engine.gravity.y*engine.gravity.scale*1.42});updateContest(prop,now);if(prop.type==="frisbee")driveFrisbee(prop);if(prop.heldBy){const puppet=puppets.get(`puppet-${prop.heldBy.playerId}`);if(puppet)prop.depth=Number(puppet.behaviour?.depth)||0;}}}
  function serialize(){return[...props.values()].map(prop=>({id:prop.id,type:prop.type,x:prop.body.position.x,y:prop.body.position.y,angle:prop.body.angle,heldBy:prop.heldBy,contestedBy:prop.contest?{playerId:prop.contest.playerId,hand:prop.contest.hand}:null,tug:prop.contest?clamp(prop.contest.score,0,1):0,depth:prop.depth||0,attached:!!prop.attached,cutArmed:!!prop.cutArmed,ownerPlayerId:prop.ownerPlayerId||null,special:!!prop.special}));}
  function releasePlayer(playerId){for(const prop of props.values()){if(prop.contest?.playerId===playerId)cancelContest(prop);if(prop.heldBy?.playerId===playerId){clearGrip(gripKey(playerId,prop.heldBy.hand));if(prop.contest)promoteContest(prop);}}}
  return{props,step,serialize,toggleGrip,tapProp,throwHeld,bringOut,useHeld,releasePlayer,makeProp};
}

function projectedPoint(prop){const depth=Number(prop.depth)||0;if(Math.abs(depth)<.0001)return{x:prop.x,y:prop.y,scale:1};return{x:prop.x,y:prop.y+depthShift(depth),scale:depthScale(depth)};}
export function propScreenPoint(prop,cameraApi){const q=projectedPoint(prop),screen=cameraApi.worldToScreen(q.x,q.y);return{...screen,scale:q.scale};}
export function pickPropAtScreen(props,x,y,cameraApi){let best=null;for(const prop of props||[]){const q=propScreenPoint(prop,cameraApi),base=prop.type==="balloon"?38:prop.type==="ball"?34:prop.type==="frisbee"?36:32,radius=base*Math.max(.7,q.scale),distance=Math.hypot(x-q.x,y-q.y);if(distance<=radius&&(!best||distance<best.distance))best={prop,distance};}return best?.prop||null;}
export function drawProp(ctx,prop,cameraApi){if(!prop)return;const q=projectedPoint(prop),screen=cameraApi.worldToScreen(q.x,q.y),s=Math.max(.72,cameraApi.camera.scale*1.9*q.scale);ctx.save();ctx.translate(screen.x,screen.y);ctx.rotate(prop.angle||0);ctx.lineCap=ctx.lineJoin="round";if(prop.type==="ball"){ctx.fillStyle="#08090a";ctx.beginPath();ctx.arc(0,0,18*s,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f1c84c";ctx.beginPath();ctx.arc(0,0,15*s,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(20,20,20,.55)";ctx.lineWidth=Math.max(1,1.5*s);ctx.beginPath();ctx.arc(0,0,8*s,-1.1,1.1);ctx.stroke();}else if(prop.type==="balloon"){ctx.strokeStyle="rgba(30,20,20,.55)";ctx.lineWidth=Math.max(1,s);ctx.beginPath();ctx.moveTo(0,15*s);ctx.quadraticCurveTo(8*s,28*s,-2*s,42*s);ctx.stroke();ctx.fillStyle="#08090a";ctx.beginPath();ctx.ellipse(0,0,16*s,20*s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#cf6c63";ctx.beginPath();ctx.ellipse(0,0,13*s,17*s,0,0,Math.PI*2);ctx.fill();}else if(prop.type==="frisbee"){ctx.fillStyle="#070808";ctx.beginPath();ctx.ellipse(0,0,24*s,7*s,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=prop.cutArmed?"#f5d65b":"#d7e5e8";ctx.lineWidth=Math.max(2,2.2*s);ctx.beginPath();ctx.moveTo(-18*s,0);ctx.lineTo(18*s,0);ctx.stroke();}else if(prop.type==="pump"){ctx.strokeStyle="#08090a";ctx.lineWidth=Math.max(7,9*s);ctx.beginPath();ctx.moveTo(0,-24*s);ctx.lineTo(0,22*s);ctx.stroke();ctx.strokeStyle="#d7e5e8";ctx.lineWidth=Math.max(3,4*s);ctx.beginPath();ctx.moveTo(-12*s,-24*s);ctx.lineTo(12*s,-24*s);ctx.stroke();}else{ctx.strokeStyle="#08090a";ctx.lineWidth=Math.max(7,8*s);ctx.beginPath();ctx.moveTo(-22*s,0);ctx.lineTo(22*s,0);ctx.stroke();ctx.strokeStyle="#e9edf2";ctx.lineWidth=Math.max(3,4*s);ctx.beginPath();ctx.moveTo(-18*s,0);ctx.lineTo(17*s,0);ctx.stroke();ctx.fillStyle="#cf6c63";ctx.beginPath();ctx.moveTo(22*s,0);ctx.lineTo(13*s,-5*s);ctx.lineTo(13*s,5*s);ctx.closePath();ctx.fill();}if(prop.contestedBy){ctx.strokeStyle="rgba(184,51,36,.9)";ctx.lineWidth=Math.max(1.5,2*s);ctx.beginPath();ctx.arc(0,0,(26+8*(prop.tug||0))*s,0,Math.PI*2);ctx.stroke();}else if(prop.heldBy){ctx.strokeStyle="rgba(255,255,255,.7)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.stroke();}ctx.restore();}
