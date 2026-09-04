import { depthScale, depthShift } from "./behaviour.js";

const { Bodies, Body, Composite, Constraint, Events, Vector } = Matter;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function worldPoint(body,local){const r=Vector.rotate(local,body.angle);return{x:body.position.x+r.x,y:body.position.y+r.y};}
function localPoint(body,world){return Vector.rotate({x:world.x-body.position.x,y:world.y-body.position.y},-body.angle);}
function handBody(puppet,hand){if(hand==="left")return puppet.parts.lowerArmL;if(hand==="right")return puppet.parts.lowerArmR;return null;}
function handPoint(puppet,hand){return worldPoint(handBody(puppet,hand),{x:0,y:23});}
function gripKey(playerId,hand){return `${playerId}:${hand}`;}
function segmentDistance(point,a,b){const abx=b.x-a.x,aby=b.y-a.y,d=abx*abx+aby*aby;if(d<.0001)return Math.hypot(point.x-a.x,point.y-a.y);const t=clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/d,0,1);return Math.hypot(point.x-(a.x+abx*t),point.y-(a.y+aby*t));}
function constraintPoint(c){if(!c?.bodyA||!c?.bodyB)return null;const a=worldPoint(c.bodyA,c.pointA||{x:0,y:0}),b=worldPoint(c.bodyB,c.pointB||{x:0,y:0});return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}

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
    const prop={id,type,body,gripPoint,heldBy:null,ownerPlayerId,attached:null,depth:Number(owner?.behaviour?.depth)||0,cutArmed:false,previous:null,thrownAt:0,special:false};
    props.set(id,prop);Composite.add(engine.world,body);return prop;
  }

  function removeProp(prop){
    if(!prop)return;
    for(const [key,grip] of [...grips])if(grip.propId===prop.id)releaseGripByKey(key);
    if(prop.attached?.constraint)Composite.remove(engine.world,prop.attached.constraint,true);
    Composite.remove(engine.world,prop.body,true);props.delete(prop.id);
  }

  function releaseGripByKey(key){
    const grip=grips.get(key);if(!grip)return false;
    Composite.remove(engine.world,grip.constraint,true);
    const prop=props.get(grip.propId);if(prop?.heldBy)prop.heldBy=null;
    grips.delete(key);return true;
  }

  function toggleGrip(playerId,hand){
    const key=gripKey(playerId,hand);
    if(releaseGripByKey(key))return{ok:true,held:false,message:`Released ${hand} hand.`};
    const puppet=puppets.get(`puppet-${playerId}`);if(!puppet)return{ok:false,message:"Your puppet is not ready yet."};
    const hp=handPoint(puppet,hand);let best=null;
    for(const prop of props.values()){
      if(prop.heldBy||prop.attached)continue;
      const d=Math.hypot(prop.body.position.x-hp.x,prop.body.position.y-hp.y);
      if(d<=74&&(!best||d<best.distance))best={prop,distance:d};
    }
    if(!best)return{ok:false,message:`Move your ${hand} hand closer to a prop.`};
    const prop=best.prop;
    const constraint=Constraint.create({bodyA:handBody(puppet,hand),pointA:{x:0,y:23},bodyB:prop.body,pointB:prop.gripPoint,length:3,stiffness:.9,damping:.18});
    Composite.add(engine.world,constraint);prop.heldBy={playerId,hand};prop.ownerPlayerId=playerId;prop.depth=Number(puppet.behaviour?.depth)||0;prop.cutArmed=false;grips.set(key,{propId:prop.id,constraint});
    return{ok:true,held:true,propId:prop.id,type:prop.type,message:`Gripped ${prop.type} with ${hand} hand.`};
  }

  function heldProp(playerId,hand){const grip=grips.get(gripKey(playerId,hand));return grip?props.get(grip.propId):null;}

  function throwHeld(playerId,hand,velocity=null){
    const prop=heldProp(playerId,hand);if(!prop)return{ok:false,message:`Nothing in ${hand} hand.`};
    const puppet=puppets.get(`puppet-${playerId}`);const hb=handBody(puppet,hand);
    const v=velocity||{x:(hb?.velocity?.x||0)*1.35+(hand==="left"?-2.8:2.8),y:(hb?.velocity?.y||0)*1.15-1.2};
    releaseGripByKey(gripKey(playerId,hand));Body.setVelocity(prop.body,{x:clamp(v.x,-16,16),y:clamp(v.y,-16,16)});prop.ownerPlayerId=playerId;prop.depth=Number(puppet?.behaviour?.depth)||0;prop.previous={...prop.body.position};prop.thrownAt=performance.now();
    if(prop.type==="frisbee"){prop.cutArmed=true;Body.setAngularVelocity(prop.body,.42*Math.sign(v.x||1));}
    return{ok:true,message:`Threw ${prop.type}.`};
  }

  function bringOut(playerId,type){
    const puppet=puppets.get(`puppet-${playerId}`);if(!puppet)return{ok:false,message:"Your puppet is not ready yet."};
    const existing=[...props.values()].find(p=>p.ownerPlayerId===playerId&&p.special);if(existing)return{ok:false,message:`${existing.type} is already out.`};
    const valid=["frisbee","pump","ball","dart"],chosen=valid.includes(type)?type:"ball";
    const hand=handPoint(puppet,"right"),x=clamp(chosen==="pump"?puppet.parts.torso.position.x+70:hand.x+38,30,970),y=chosen==="pump"?560:clamp(hand.y-8,46,570);
    const prop=makeProp(chosen,x,y,playerId);prop.special=true;return{ok:true,propId:prop.id,type:chosen,message:`Brought out ${chosen}.`};
  }

  function useHeld(playerId,hand){
    const prop=heldProp(playerId,hand);if(!prop)return{ok:false,message:`Nothing in ${hand} hand.`};
    if(prop.type==="pump"){
      const balloon=makeProp("balloon",prop.body.position.x+28,prop.body.position.y-42,playerId);balloon.special=false;return{ok:true,message:"Inflated a balloon."};
    }
    if(prop.type==="frisbee"){prop.cutArmed=true;return{ok:true,message:"Frisbee armed."};}
    return{ok:false,message:`${prop.type} has no separate use action.`};
  }

  function stickDart(prop,body,point){
    if(prop.attached||prop.heldBy)return;
    const constraint=Constraint.create({bodyA:prop.body,pointA:{x:13,y:0},bodyB:body,pointB:localPoint(body,point),length:0,stiffness:.96,damping:.2});
    Composite.add(engine.world,constraint);prop.attached={body,constraint};Body.setVelocity(prop.body,{x:body.velocity.x,y:body.velocity.y});
  }

  Events.on(engine,"collisionStart",event=>{
    for(const pair of event.pairs){
      const pa=[...props.values()].find(p=>p.body===pair.bodyA||p.body===pair.bodyB);if(!pa)continue;
      const other=pa.body===pair.bodyA?pair.bodyB:pair.bodyA;
      const puppet=[...puppets.values()].find(p=>Object.values(p.parts).includes(other));
      if(pa.type==="dart"&&puppet){const support=pair.collision?.supports?.[0]||pa.body.position;stickDart(pa,other,support);}
      if(pa.type==="dart"){
        const balloon=[...props.values()].find(p=>p.type==="balloon"&&p.body===other);if(balloon)removeProp(balloon);
      }
    }
  });

  function driveFrisbee(prop){
    if(!prop.cutArmed||prop.heldBy||prop.attached)return;
    const current={...prop.body.position},previous=prop.previous||current;prop.previous=current;
    const speed=Math.hypot(prop.body.velocity.x,prop.body.velocity.y);if(speed<3.2){prop.cutArmed=false;return;}
    for(const puppet of puppets.values()){
      if(puppet.ownerPlayerId===prop.ownerPlayerId&&performance.now()-prop.thrownAt<180)continue;
      for(let i=puppet.joints.length-1;i>=0;i--){
        const joint=puppet.joints[i],point=constraintPoint(joint);if(!point)continue;
        if(segmentDistance(point,previous,current)<=15){Composite.remove(engine.world,joint,true);puppet.joints.splice(i,1);prop.cutArmed=false;return;}
      }
    }
  }

  function step(){
    for(const prop of props.values()){
      if(prop.type==="balloon"&&!prop.heldBy)Body.applyForce(prop.body,prop.body.position,{x:0,y:-prop.body.mass*engine.gravity.y*engine.gravity.scale*1.42});
      if(prop.type==="frisbee")driveFrisbee(prop);
      if(prop.heldBy){const puppet=puppets.get(`puppet-${prop.heldBy.playerId}`);if(puppet)prop.depth=Number(puppet.behaviour?.depth)||0;}
    }
  }

  function serialize(){
    return [...props.values()].map(prop=>({
      id:prop.id,type:prop.type,x:prop.body.position.x,y:prop.body.position.y,angle:prop.body.angle,
      heldBy:prop.heldBy,depth:prop.depth||0,attached:!!prop.attached,cutArmed:!!prop.cutArmed,
      ownerPlayerId:prop.ownerPlayerId||null,special:!!prop.special
    }));
  }

  function releasePlayer(playerId){for(const hand of ["left","right"])releaseGripByKey(gripKey(playerId,hand));}
  return{props,step,serialize,toggleGrip,throwHeld,bringOut,useHeld,releasePlayer,makeProp};
}

function projectedPoint(prop){
  const depth=Number(prop.depth)||0;if(Math.abs(depth)<.0001)return{x:prop.x,y:prop.y,scale:1};
  return{x:prop.x,y:prop.y+depthShift(depth),scale:depthScale(depth)};
}

export function drawProp(ctx,prop,cameraApi){
  if(!prop)return;const q=projectedPoint(prop),screen=cameraApi.worldToScreen(q.x,q.y),s=Math.max(.72,cameraApi.camera.scale*1.9*q.scale);
  ctx.save();ctx.translate(screen.x,screen.y);ctx.rotate(prop.angle||0);ctx.lineCap=ctx.lineJoin="round";
  if(prop.type==="ball"){
    ctx.fillStyle="#08090a";ctx.beginPath();ctx.arc(0,0,18*s,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f1c84c";ctx.beginPath();ctx.arc(0,0,15*s,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(20,20,20,.55)";ctx.lineWidth=Math.max(1,1.5*s);ctx.beginPath();ctx.arc(0,0,8*s,-1.1,1.1);ctx.stroke();
  }else if(prop.type==="balloon"){
    ctx.strokeStyle="rgba(30,20,20,.55)";ctx.lineWidth=Math.max(1,s);ctx.beginPath();ctx.moveTo(0,15*s);ctx.quadraticCurveTo(8*s,28*s,-2*s,42*s);ctx.stroke();ctx.fillStyle="#08090a";ctx.beginPath();ctx.ellipse(0,0,16*s,20*s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#cf6c63";ctx.beginPath();ctx.ellipse(0,0,13*s,17*s,0,0,Math.PI*2);ctx.fill();
  }else if(prop.type==="frisbee"){
    ctx.fillStyle="#070808";ctx.beginPath();ctx.ellipse(0,0,24*s,7*s,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=prop.cutArmed?"#f5d65b":"#d7e5e8";ctx.lineWidth=Math.max(2,2.2*s);ctx.beginPath();ctx.moveTo(-18*s,0);ctx.lineTo(18*s,0);ctx.stroke();
  }else if(prop.type==="pump"){
    ctx.strokeStyle="#08090a";ctx.lineWidth=Math.max(7,9*s);ctx.beginPath();ctx.moveTo(0,-24*s);ctx.lineTo(0,22*s);ctx.stroke();ctx.strokeStyle="#d7e5e8";ctx.lineWidth=Math.max(3,4*s);ctx.beginPath();ctx.moveTo(-12*s,-24*s);ctx.lineTo(12*s,-24*s);ctx.stroke();
  }else{
    ctx.strokeStyle="#08090a";ctx.lineWidth=Math.max(7,8*s);ctx.beginPath();ctx.moveTo(-22*s,0);ctx.lineTo(22*s,0);ctx.stroke();ctx.strokeStyle="#e9edf2";ctx.lineWidth=Math.max(3,4*s);ctx.beginPath();ctx.moveTo(-18*s,0);ctx.lineTo(17*s,0);ctx.stroke();ctx.fillStyle="#cf6c63";ctx.beginPath();ctx.moveTo(22*s,0);ctx.lineTo(13*s,-5*s);ctx.lineTo(13*s,5*s);ctx.closePath();ctx.fill();
  }
  if(prop.heldBy){ctx.strokeStyle="rgba(255,255,255,.7)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
