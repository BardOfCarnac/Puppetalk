(function(root){
  'use strict';

  function create({
    props,puppets,clamp,puppetalkAimProjectPropPoint,puppetalkAimProjectPoint,
    jointCutPoint,seamCutPoint,severSeam,severJoint,Body
  }){
    function pointSegmentDistance(point,a,b){
      const abx = b.x-a.x;
      const aby = b.y-a.y;
      const d = abx*abx+aby*aby;
      if(d < .0001) return Math.hypot(point.x-a.x,point.y-a.y);
      const t = clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/d,0,1);
      return Math.hypot(point.x-(a.x+abx*t),point.y-(a.y+aby*t));
    }

    function driveLaserFrisbeeCuts(now){
      for(const prop of props.values()){
        if(prop.type !== 'frisbee') continue;
        const b = prop.body;
        const current = puppetalkAimProjectPropPoint(prop,prop._throwerSlot);
        const previous = prop._frisbeePrev || current;
        prop._frisbeePrev = current;

        if(!prop._cutArmed || prop.heldBy || prop.contest || prop.attachedTo) continue;
        const age = now-(prop._thrownAt||0);
        if(age < 120) continue;

        const linear = Math.hypot(b.velocity?.x||0,b.velocity?.y||0);
        const spin = Math.abs(b.angularVelocity||0);
        const edgeSpeed = linear+spin*23;
        const dangerous = linear >= 5.2 && spin >= .12 && edgeSpeed >= 8.8;
        b.isSensor = !!(prop._cutArmed && dangerous);
        if(!dangerous){
          if(linear < 3.5 && age > 280) prop._cutArmed = false;
          if(!prop._cutArmed) b.isSensor = false;
          continue;
        }

        let best = null;
        for(const p of puppets.values()){
          if(p.joints && p.severedJoints){
            for(const [name,constraint] of Object.entries(p.joints)){
              if(p.severedJoints.has(name)) continue;
              const qRaw = jointCutPoint(constraint);
              if(!qRaw) continue;
              const q = puppetalkAimProjectPoint(p,qRaw,prop._throwerSlot);
              const distance = pointSegmentDistance(q,previous,current);
              if(distance <= 13 && (!best || distance < best.distance)) best = {p,name,kind:'joint',distance};
            }
          }
          if(p.seams && p.brokenSeams){
            for(const [name,constraint] of Object.entries(p.seams)){
              if(p.brokenSeams.has(name)) continue;
              const qRaw = seamCutPoint(p,name);
              if(!qRaw) continue;
              const q = puppetalkAimProjectPoint(p,qRaw,prop._throwerSlot);
              const distance = pointSegmentDistance(q,previous,current);
              const radius = p.seamMeta?.[name]?.radius || 14;
              if(distance <= radius && (!best || distance < best.distance)) best = {p,name,kind:'seam',distance};
            }
          }
        }
        if(!best) continue;

        const cut = best.kind === 'seam' ? severSeam(best.p,best.name) : severJoint(best.p,best.name);
        if(cut){
          prop._cutArmed = false;
          b.isSensor = false;
          Body.setVelocity(b,{x:(b.velocity?.x||0)*.72,y:(b.velocity?.y||0)*.72});
          Body.setAngularVelocity(b,(b.angularVelocity||0)*.55);
        }
      }
    }

    return {pointSegmentDistance,driveLaserFrisbeeCuts};
  }

  root.PuppetalkLaserFrisbee = {create};
})(typeof window !== 'undefined' ? window : globalThis);
