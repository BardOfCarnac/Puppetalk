(function(global){
  'use strict';

  function create({propGrips,gripKey,Composite,engine,puppets,handBody,propGripLocalPoint,Constraint}){
    if(!propGrips || typeof gripKey !== 'function' || !Composite || !engine || !puppets ||
       typeof handBody !== 'function' || typeof propGripLocalPoint !== 'function' || !Constraint) return null;

    function gripRecord(slot,hand){ return propGrips.get(gripKey(slot,hand)); }
    function freePropHand(slot,hand,propId=null){
      const held = gripRecord(slot,hand);
      return !held || held.propId === propId;
    }
    function clearPropGrip(slot,hand){
      const key = gripKey(slot,hand);
      const grip = propGrips.get(key);
      if(!grip) return null;
      Composite.remove(engine.world,grip.constraint);
      propGrips.delete(key);
      return grip;
    }
    function makePropGrip(prop,slot,hand,stiffness,role){
      const p = puppets.get(slot);
      if(!p || !freePropHand(slot,hand,prop.id)) return null;
      const constraint = Constraint.create({
        bodyA:handBody(p,hand),pointA:propGripLocalPoint(hand),
        bodyB:prop.body,pointB:prop.gripPoint || {x:0,y:0},
        length:3,stiffness,damping:.19
      });
      Composite.add(engine.world,constraint);
      const grip = {propId:prop.id,constraint,role};
      propGrips.set(gripKey(slot,hand),grip);
      return grip;
    }
    function cancelPropContest(prop){
      const tug = prop?.contest;
      if(!tug) return;
      clearPropGrip(tug.slot,tug.hand);
      prop.contest = null;
      const holder = prop.heldBy && gripRecord(prop.heldBy.slot,prop.heldBy.hand);
      if(holder) holder.constraint.stiffness = .88;
    }
    function promotePropContest(prop){
      const tug = prop?.contest;
      if(!tug) return false;
      if(prop.heldBy) clearPropGrip(prop.heldBy.slot,prop.heldBy.hand);
      tug.constraint.stiffness = .88;
      const record = gripRecord(tug.slot,tug.hand);
      if(record) record.role = 'holder';
      prop.heldBy = {slot:tug.slot,hand:tug.hand};
      prop.contest = null;
      return true;
    }
    function releasePropHolder(prop,promote=false){
      if(!prop?.heldBy) return;
      clearPropGrip(prop.heldBy.slot,prop.heldBy.hand);
      prop.heldBy = null;
      if(promote && prop.contest) promotePropContest(prop);
      else cancelPropContest(prop);
    }
    function beginPropHold(prop,slot,hand){
      prop._throwerSlot = null;
      prop._depth = null;
      prop._depthAssistUntil = 0;
      prop._assistPrevScreen = null;
      const grip = makePropGrip(prop,slot,hand,.88,'holder');
      if(!grip) return false;
      if(prop.type === 'frisbee'){
        prop._cutArmed = false;
        prop._thrownAt = 0;
        prop._frisbeePrev = null;
        prop.body.isSensor = false;
      }
      prop.heldBy = {slot,hand};
      return true;
    }
    function beginPropContest(prop,slot,hand,now){
      const grip = makePropGrip(prop,slot,hand,.17,'contest');
      if(!grip) return false;
      prop.contest = {slot,hand,constraint:grip.constraint,score:.18,lastTapAt:now,lastUpdateAt:now};
      return true;
    }

    return {
      gripRecord,freePropHand,clearPropGrip,makePropGrip,cancelPropContest,
      promotePropContest,releasePropHolder,beginPropHold,beginPropContest
    };
  }

  global.PuppetalkPropGripCore={create};
})(typeof window!=='undefined'?window:globalThis);
