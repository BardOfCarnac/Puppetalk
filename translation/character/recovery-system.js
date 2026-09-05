// Behaviour-preserving sever/recovery mutations extracted from frozen V1.
// This module deliberately preserves V1's shared repairRequested flag semantics.
(() => {
  function create({Composite,Body,engine,makePuppet,jointGap,jointWorldPoint,angleDelta,clamp}){
    if(!Composite?.add || !Composite?.remove || !Body?.applyForce || !engine?.world){
      throw new Error('Puppetalk recovery system requires Matter composite/body operations.');
    }
    if(typeof makePuppet!=='function' || typeof jointGap!=='function' || typeof jointWorldPoint!=='function' || typeof angleDelta!=='function' || typeof clamp!=='function'){
      throw new Error('Puppetalk recovery system requires rig and geometry helpers.');
    }

    function severJoint(p,name){
      if(!p?.joints?.[name] || p.severedJoints?.has(name)) return false;
      const c = p.joints[name];
      Composite.remove(engine.world,c);
      p.severedJoints.add(name);
      p.repairRequested = false;
      return true;
    }

    function repairSeveredJoints(p){
      if(!p?.repairRequested || !p.severedJoints?.size) return;
      for(const name of [...p.severedJoints]){
        const c = p.joints?.[name];
        if(!c || jointGap(c) > 34) continue;
        Composite.add(engine.world,c);
        p.severedJoints.delete(name);
      }
      if(!p.severedJoints.size) p.repairRequested = false;
    }

    function handleJointRecovery(slot,msg){
      if(msg?.type !== 'input') return;
      const version = Number.isInteger(msg.input?.recoverVersion) ? msg.input.recoverVersion : null;
      if(version === null) return;
      const p = makePuppet(slot);
      if(version > (p.recoverVersion||0)){
        p.recoverVersion = version;
        p.repairRequested = true;
      }
    }

    function severSeam(p,name){
      if(!p?.seams?.[name] || p.brokenSeams?.has(name)) return false;
      Composite.remove(engine.world,p.seams[name]);
      p.brokenSeams.add(name);
      p.repairRequested = false;
      return true;
    }

    function repairBrokenSeams(p){
      if(!p?.repairRequested || !p.brokenSeams?.size) return;
      for(const name of [...p.brokenSeams]){
        const c=p.seams?.[name];
        if(!c?.bodyA || !c?.bodyB) continue;
        const a=jointWorldPoint(c,'A');
        const b=jointWorldPoint(c,'B');
        if(!a || !b) continue;
        const dx=b.x-a.x,dy=b.y-a.y;
        const gap=Math.hypot(dx,dy);
        if(gap < 20){
          Composite.add(engine.world,c);
          p.brokenSeams.delete(name);
          continue;
        }
        const pull=Math.min(.00032,.00011+gap*.0000024);
        const ma=Math.max(.2,c.bodyA.mass||1),mb=Math.max(.2,c.bodyB.mass||1);
        Body.applyForce(c.bodyA,a,{x:dx*pull*ma,y:dy*pull*ma});
        Body.applyForce(c.bodyB,b,{x:-dx*pull*mb,y:-dy*pull*mb});
        const rel=angleDelta(c.bodyB.angle||0,c.bodyA.angle||0);
        c.bodyA.torque += clamp(rel*.0025,-.012,.012);
        c.bodyB.torque -= clamp(rel*.0025,-.012,.012);
      }
      if(!p.brokenSeams.size && !p.severedJoints?.size) p.repairRequested=false;
    }

    return {severJoint,repairSeveredJoints,handleJointRecovery,severSeam,repairBrokenSeams};
  }

  window.PuppetalkRecoverySystem = {create};
})();