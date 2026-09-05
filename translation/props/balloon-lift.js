(function(root){
  'use strict';

  function create({
    props,puppets,cancelPropContest,releasePropHolder,localOffset,worldOffset,
    Body,syncAttachedProp,clamp
  }){
    function tieBalloonToBody(prop,target){
      if(!prop || prop.type !== 'balloon' || !target?.body || prop.attachedTo) return false;
      cancelPropContest(prop);
      if(prop.heldBy) releasePropHolder(prop,false);
      const numeric = Number(String(prop.id).replace(/D+/g,'')) || 1;
      prop.attachedTo = {
        slot:target.slot,
        part:target.part,
        body:target.body,
        offset:localOffset(target.body,target.point || target.body.position),
        angle:0,
        mode:'balloon',
        stringLength:58+(numeric%3)*6,
        phase:numeric*.83
      };
      Body.setStatic(prop.body,true);
      prop.body.collisionFilter.mask = 0;
      syncAttachedProp(prop);
      return true;
    }

    function driveAttachedBalloon(prop,now){
      const a = prop?.attachedTo;
      if(prop?.type !== 'balloon' || a?.mode !== 'balloon' || !a.body) return;
      const anchor = worldOffset(a.body,a.offset);

      let count = 0;
      for(const candidate of props.values()){
        if(candidate?.type === 'balloon' &&
           candidate.attachedTo?.mode === 'balloon' &&
           candidate.attachedTo?.slot === a.slot) count++;
      }

      let baseLift;
      if(count <= 1) baseLift = .0034;
      else if(count === 2) baseLift = .0045;
      else if(count === 3) baseLift = .0062;
      else if(count === 4) baseLift = .0115;
      else baseLift = .0115 + (count-4)*.0018;

      const puppet = puppets.get(a.slot);
      const upwardSpeed = Math.max(0,-(puppet?.torso?.velocity?.y || 0));
      const speedFade = clamp(1-upwardSpeed/13,.55,1);
      const balloonScale = Math.max(.35,prop._renderScale||1);
      const lift = baseLift * balloonScale*balloonScale * speedFade;
      const sway = Math.sin(now*.0016+(a.phase||0))*.00032;

      const torso = puppet?.torso;
      const localShare = torso && torso !== a.body ? (count >= 4 ? .64 : .76) : 1;
      Body.applyForce(a.body,anchor,{x:sway,y:-lift*localShare});
      if(torso && torso !== a.body){
        Body.applyForce(torso,torso.position,{x:0,y:-lift*(1-localShare)});
      }
    }

    return {tieBalloonToBody,driveAttachedBalloon};
  }

  root.PuppetalkBalloonLift = {create};
})(typeof window !== 'undefined' ? window : globalThis);
