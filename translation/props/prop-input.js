(function(root){
  function create(deps={}){
    const {
      props,conns,puppets,send,
      validPropEffector,handPoint,freePropHand,detachPropAttachment,beginPropHold,
      nearestBalloonTarget,tieBalloonToBody,cancelPropContest,promotePropContest,
      beginPropContest,releasePropHolder,gripRecord,handBody,clamp,Body,
      inflatePumpBalloon,releasePumpBalloon,
      getDimensions=()=>({W:1,H:1}),
      now=()=>0,
      getDepthForSlot=()=>0,
      projectPropPoint=()=>({x:0,y:0})
    }=deps;

    function propHandIsClose(slot,hand,prop){
      const p = puppets.get(slot);
      if(!p) return false;
      const hp = handPoint(p,hand);
      const speed = Math.hypot(prop?.body?.velocity?.x||0,prop?.body?.velocity?.y||0);
      const reach = prop?.type === 'frisbee' ? (speed < 3.8 ? 122 : 102) : 86;
      return Math.hypot(prop.body.position.x-hp.x,prop.body.position.y-hp.y) <= reach;
    }

    function tapProp(slot,msg){
      const prop = props.get(msg?.propId);
      const hand = msg?.hand;
      if(!prop || !validPropEffector(hand)) return {ok:false,message:'Tap the object with a nearby hand or foot.'};
      if(!propHandIsClose(slot,hand,prop)) return {ok:false,message:'Move a hand a little closer first.'};
      const time = now();

      if(prop.attachedTo){
        if(!freePropHand(slot,hand,prop.id)) return {ok:false,message:'That hand is already holding something.'};
        detachPropAttachment(prop);
        if(!beginPropHold(prop,slot,hand)) return {ok:false,message:'Pulled it free, but could not hold it.'};
        return {ok:true,message:'Pulled the '+prop.type+' free.'};
      }

      if(!prop.heldBy){
        if(!freePropHand(slot,hand,prop.id)) return {ok:false,message:'That hand is already holding something.'};
        if(!beginPropHold(prop,slot,hand)) return {ok:false,message:'Could not get hold of it.'};
        return {ok:true,message:'Picked up '+prop.type+'.'};
      }

      if(prop.heldBy.slot === slot){
        if(prop.type === 'balloon' && !prop.contest){
          const target = nearestBalloonTarget(prop,slot,hand);
          if(target && tieBalloonToBody(prop,target)){
            return {ok:true,message:'Tied balloon to '+target.part+'.'};
          }
        }
        if(prop.contest){
          prop.contest.score = Math.max(0,prop.contest.score-.19);
          prop.contest.lastTapAt = time;
          prop.contest.lastUpdateAt = time;
          if(prop.contest.score <= .01) cancelPropContest(prop);
          return {ok:true,message:'Held your ground.'};
        }
        return {ok:true,message:'Still holding '+prop.type+'.'};
      }

      if(prop.contest){
        if(prop.contest.slot !== slot) return {ok:false,message:'Someone else is already tugging at it.'};
        if(prop.contest.hand !== hand) return {ok:false,message:'Keep using the same hand for this tug.'};
        prop.contest.score = Math.min(1.05,prop.contest.score+.19);
        prop.contest.lastTapAt = time;
        prop.contest.lastUpdateAt = time;
        if(prop.contest.score >= 1){
          promotePropContest(prop);
          return {ok:true,message:'Pulled the '+prop.type+' free.'};
        }
        return {ok:true,message:'Tugging '+prop.type+' — keep tapping.'};
      }

      if(!freePropHand(slot,hand,prop.id)) return {ok:false,message:'That hand is already holding something.'};
      if(!beginPropContest(prop,slot,hand,time)) return {ok:false,message:'Could not get a grip on it.'};
      return {ok:true,message:'Tugging '+prop.type+' — keep tapping.'};
    }

    function releaseAllPropGrips(slot){
      props.forEach(prop=>{
        if(prop.contest?.slot === slot) cancelPropContest(prop);
        if(prop.heldBy?.slot === slot) releasePropHolder(prop,true);
      });
    }

    function throwHeldProp(slot,msg){
      const hand = msg?.hand;
      if(!validPropEffector(hand)) return {ok:false,message:'Choose a throwing hand or foot.'};
      const grip = gripRecord(slot,hand);
      if(!grip) return {ok:false,message:'That hand is not holding anything.'};
      const prop = props.get(grip.propId);
      if(!prop || prop.heldBy?.slot !== slot || prop.heldBy?.hand !== hand) return {ok:false,message:'That prop is no longer held.'};

      const p = puppets.get(slot);
      const hb = p ? handBody(p,hand) : null;
      const handV = hb?.velocity || {x:0,y:0};
      const propV = prop.body.velocity || {x:0,y:0};
      const {W,H}=getDimensions();

      const gestureVX = clamp(Number(msg.vx)||0,-3.2,3.2)*W/60;
      const gestureVY = clamp(Number(msg.vy)||0,-3.2,3.2)*H/60;
      let vx = gestureVX*.72 + handV.x*.42 + propV.x*.34;
      let vy = gestureVY*.72 + handV.y*.42 + propV.y*.34;
      const speed = Math.hypot(vx,vy);
      const maxSpeed = 17;
      if(speed > maxSpeed){
        const k = maxSpeed/speed;
        vx *= k;
        vy *= k;
      }

      const spin = clamp((prop.body.angularVelocity||0)*.8 + (hb?.angularVelocity||0)*.55 + gestureVX*.018,-.34,.34);
      prop._throwerSlot = slot;
      prop._depth = getDepthForSlot(slot) || 0;
      prop._depthAssistUntil = now()+1750;
      prop._assistPrevScreen = null;
      releasePropHolder(prop,false);
      Body.setVelocity(prop.body,{x:vx,y:vy});
      if(prop.type === 'frisbee'){
        const direction = Math.sign(vx || 1);
        Body.setAngularVelocity(prop.body,clamp(spin*1.45+direction*.18,-.58,.58));
        prop._cutArmed = true;
        prop._thrownAt = now();
        prop._frisbeePrev = projectPropPoint(prop,slot);
        prop.body.isSensor = true;
      }else{
        Body.setAngularVelocity(prop.body,spin);
      }
      return {ok:true,thrown:true,propId:prop.id,message:'Threw '+prop.type+'.'};
    }

    function handlePropInput(slot,msg){
      if(msg?.type !== 'prop') return;
      if(msg.action === 'pump'){
        const pump = props.get(msg.propId);
        const result = pump?.type === 'pump' ? inflatePumpBalloon(pump) : {ok:false,message:'That is not a balloon pump.'};
        send(conns.get(slot),{type:'prop-result',propId:msg.propId,...result});
        return;
      }
      if(msg.action === 'release-pump-balloon'){
        const balloon = props.get(msg.propId);
        const ok = releasePumpBalloon(balloon);
        send(conns.get(slot),{type:'prop-result',propId:msg.propId,ok,message:ok?'Released balloon.':'That balloon is not on the pump.'});
        return;
      }
      let result = null;
      if(msg.action === 'tap') result = tapProp(slot,msg);
      else if(msg.action === 'throw') result = throwHeldProp(slot,msg);
      if(!result) return;
      send(conns.get(slot),{type:'prop-result',propId:msg.propId || result.propId,...result});
    }

    return {propHandIsClose,tapProp,releaseAllPropGrips,throwHeldProp,handlePropInput};
  }

  root.PuppetalkPropInput={create};
})(typeof window!=='undefined'?window:globalThis);
