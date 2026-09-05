// Behaviour-preserving low-level puppet force helpers extracted from frozen V1.
// Dependencies are injected explicitly so force coefficients remain easy to audit.
(() => {
  function create({Body,clamp,angleDelta}){
    if(!Body?.applyForce || !clamp || !angleDelta){
      throw new Error('Puppetalk drive forces require Body.applyForce, clamp and angleDelta.');
    }

    function servo(body,target,strength=.006){
      body.torque += clamp(angleDelta(target,body.angle)*strength-body.angularVelocity*strength*.72,-.028,.028);
    }

    function springPull(body,point,target,stiffness,damping=.003){
      const mass = Math.max(.2,body.mass || 1);
      Body.applyForce(body,point,{
        x:((target.x-point.x)*stiffness-body.velocity.x*damping)*mass,
        y:((target.y-point.y)*stiffness-body.velocity.y*damping)*mass
      });
    }

    return {servo,springPull};
  }

  window.PuppetalkDriveForces = {create};
})();