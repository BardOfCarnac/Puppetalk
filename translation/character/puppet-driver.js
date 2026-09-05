(function(global){
  'use strict';

  function create({
    getDimensions,now,POSES,ensureRig,resetPins,antiTangleTarget,rootFollow,
    grabBody,grabWorldPoint,springPull,servo,clamp
  }){
    if(typeof getDimensions !== 'function' || typeof now !== 'function' || !POSES ||
       typeof ensureRig !== 'function' || typeof resetPins !== 'function' ||
       typeof antiTangleTarget !== 'function' || typeof rootFollow !== 'function' ||
       typeof grabBody !== 'function' || typeof grabWorldPoint !== 'function' ||
       typeof springPull !== 'function' || typeof servo !== 'function' || typeof clamp !== 'function') return null;

    function drivePuppet(p){
      const {W,H}=getDimensions();
      const t = p.torso;
      const rig = ensureRig(p);
      const floorY = H-31;
      const crouched = p.pose === 'crouch';
      const standingY = floorY-(crouched ? 112 : 145);
      const poseVersion = p.poseVersion || 0;

      if(rig.lastPose !== p.pose || rig.lastPoseVersion !== poseVersion){
        rig.lastPose = p.pose;
        rig.lastPoseVersion = poseVersion;
        resetPins(rig);
      }

      const grabs = Array.isArray(p.grabs) ? p.grabs.slice(0,2) : [];
      const activeParts = new Set(grabs.map(g=>g.part));
      for(const part of Object.keys(rig.sessions)) if(!activeParts.has(part)) delete rig.sessions[part];

      const currentTime = now();
      const prepared = [];
      let rootSum = 0;
      let rootWeight = 0;
      let torsoDesired = null;

      for(const grab of grabs){
        const desired = {x:clamp(grab.x*W,20,W-20),y:clamp(grab.y*H,30,H-24)};
        let session = rig.sessions[grab.part];
        if(!session){
          session = rig.sessions[grab.part] = {
            startDesired:{x:desired.x,y:desired.y},
            startRootX:p.target.x*W,
            startTorsoY:t.position.y,
            startedAt:currentTime
          };
        }
        const age = currentTime-session.startedAt;
        const guided = antiTangleTarget(p,grab.part,desired,age);
        const follow = rootFollow(grab.part);
        const rootX = grab.part === 'torso' || grab.part === 'pelvis'
          ? desired.x
          : session.startRootX+(desired.x-session.startDesired.x)*follow;
        const weight = grab.part === 'torso' ? 2 : grab.part === 'pelvis' ? 1.7 : follow;
        rootSum += clamp(rootX,70,W-70)*weight;
        rootWeight += weight;
        if(grab.part === 'torso' || grab.part === 'pelvis') torsoDesired = desired;
        prepared.push({grab,desired,guided,session});
      }

      if(rootWeight) p.target.x = clamp(rootSum/rootWeight,70,W-70)/W;
      const anchorX = clamp(p.target.x*W,70,W-70);
      const coreGrab = grabs.some(g=>g.part==='torso'||g.part==='pelvis'||g.part.includes('Shoulder'));
      const limbGrab = grabs.some(g=>!['torso','pelvis','leftShoulder','rightShoulder'].includes(g.part));

      for(const item of prepared){
        const part = item.grab.part;
        const body = grabBody(p,part);
        const point = grabWorldPoint(p,part);
        const twoFingerScale = grabs.length > 1 ? .86 : 1;
        const strength = (p.rag ? .00017 : part === 'head' ? .00022 : part === 'torso' || part === 'pelvis' ? .00019 : part.includes('Shoulder') ? .0002 : .00019)*twoFingerScale;
        springPull(body,point,item.guided,strength,.0026);

        if(!['torso','pelvis'].includes(part)){
          const followY = part.includes('Shoulder') ? .68 : part === 'head' ? .7 : part.includes('Hand') ? .38 : .28;
          const bodyTargetY = item.session.startTorsoY+(item.desired.y-item.session.startDesired.y)*followY;
          springPull(t,t.position,{x:anchorX,y:bodyTargetY},.000088/grabs.length,.0043);
        }

        if(['head','leftHand','rightHand','leftFoot','rightFoot'].includes(part)){
          rig.pins[part] = {x:item.desired.x-anchorX,y:item.desired.y-standingY};
        }
      }

      if(p.rag) return;

      if(!coreGrab){
        springPull(t,t.position,{x:anchorX,y:standingY},limbGrab ? .00011 : .00015,.0049);
      }else if(torsoDesired){
        springPull(t,t.position,torsoDesired,.000075,.0042);
      }

      const legSpread = crouched ? 22 : 16;
      const thighY = standingY+(crouched ? 48 : 61);
      const shinY = standingY+(crouched ? 88 : 112);
      const footY = floorY-2;

      if(!activeParts.has('leftFoot') && !rig.pins.leftFoot){
        springPull(p.thL,p.thL.position,{x:anchorX-13,y:thighY},.000078,.0055);
        springPull(p.shL,p.shL.position,{x:anchorX-legSpread,y:shinY},.0001,.0057);
        springPull(p.shL,grabWorldPoint(p,'leftFoot'),{x:anchorX-legSpread,y:footY},.00017,.0059);
      }
      if(!activeParts.has('rightFoot') && !rig.pins.rightFoot){
        springPull(p.thR,p.thR.position,{x:anchorX+13,y:thighY},.000078,.0055);
        springPull(p.shR,p.shR.position,{x:anchorX+legSpread,y:shinY},.0001,.0057);
        springPull(p.shR,grabWorldPoint(p,'rightFoot'),{x:anchorX+legSpread,y:footY},.00017,.0059);
      }

      for(const part of ['head','leftHand','rightHand','leftFoot','rightFoot']){
        const pin = rig.pins[part];
        if(!pin || activeParts.has(part)) continue;
        const body = grabBody(p,part);
        const point = grabWorldPoint(p,part);
        const strength = part === 'head' ? .00017 : part.includes('Foot') ? .000145 : .00013;
        springPull(body,point,{x:anchorX+pin.x,y:standingY+pin.y},strength,.0044);
      }

      if(!rig.pins.head && !activeParts.has('head')){
        springPull(p.head,p.head.position,{x:anchorX,y:standingY-65},.000095,.0046);
      }

      const leftFoot = grabWorldPoint(p,'leftFoot');
      const rightFoot = grabWorldPoint(p,'rightFoot');
      const q = POSES[p.pose] || POSES.stand;
      const base = q[8];
      const midFootX = (leftFoot.x+rightFoot.x)*.5;
      const balanceLean = clamp((midFootX-t.position.x)*.0045-t.velocity.x*.014,-.24,.24);
      const muscle = limbGrab ? .86 : coreGrab ? .9 : 1;

      servo(t,base+balanceLean,.018*muscle);
      servo(p.head,base*.2,.011*muscle);
      [p.uaL,p.faL,p.uaR,p.faR,p.thL,p.shL,p.thR,p.shR].forEach((body,i)=>{
        const strength = i < 4 ? (i%2 ? .0062 : .0072) : (i%2 ? .014 : .0155);
        servo(body,base+q[i],strength*muscle);
      });
    }

    return {drivePuppet};
  }

  global.PuppetalkPuppetDriver={create};
})(typeof window!=='undefined'?window:globalThis);
