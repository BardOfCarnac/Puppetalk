(()=>{
  const M = window.Matter;
  if(!M) return;

  const {Body,Engine,Constraint} = M;
  const originalCreate = Engine.create.bind(Engine);
  const originalUpdate = Engine.update.bind(Engine);
  const originalConstraintCreate = Constraint.create.bind(Constraint);

  function angleDelta(a,b){
    let d = a-b;
    while(d > Math.PI) d -= Math.PI*2;
    while(d < -Math.PI) d += Math.PI*2;
    return d;
  }

  function scaleVelocity(body,factor){
    Body.setVelocity(body,{x:body.velocity.x*factor,y:body.velocity.y*factor});
    Body.setAngularVelocity(body,body.angularVelocity*factor);
  }

  function jointLimit(constraint){
    const a = constraint.bodyA;
    const b = constraint.bodyB;
    if(!a || !b || a.isStatic || b.isStatic) return null;

    // Neck: one of the connected bodies is the circular head.
    if(a.circleRadius || b.circleRadius) return 1.0;

    const p = constraint.pointA || {x:0,y:0};
    // Shoulder joints originate high and wide on the torso.
    if(Math.abs(p.x) > 20 && p.y < -15) return 2.35;
    // Hip joints originate low and wide on the torso.
    if(Math.abs(p.x) > 9 && p.y > 28) return 1.75;
    // Elbows and knees connect the two long limb segments.
    return 2.25;
  }

  function enforceJointLimits(engine){
    for(const c of engine.world.constraints){
      const limit = jointLimit(c);
      if(!limit) continue;
      const a = c.bodyA;
      const b = c.bodyB;
      const rel = angleDelta(b.angle,a.angle);
      const excess = Math.abs(rel)-limit;
      if(excess <= 0) continue;

      const sign = Math.sign(rel) || 1;
      const correction = Math.min(.07,excess*.055);
      Body.setAngularVelocity(b,b.angularVelocity-sign*correction);
      Body.setAngularVelocity(a,a.angularVelocity+sign*correction*.35);

      // Never allow a joint to wrap right through itself. This emergency correction
      // only engages well beyond the soft limit, before Matter can enter a flip loop.
      if(excess > .48){
        Body.setAngle(b,a.angle+sign*(limit+.16));
        Body.setAngularVelocity(b,b.angularVelocity*.35);
      }
    }
  }

  function stabilizeGroups(engine){
    const groups = new Map();
    for(const body of engine.world.bodies){
      if(body.isStatic) continue;
      const group = body.collisionFilter?.group || 0;
      if(group >= 0) continue;
      if(!groups.has(group)) groups.set(group,[]);
      groups.get(group).push(body);
    }

    if(!engine._puppetalkHeat) engine._puppetalkHeat = new Map();

    for(const [group,bodies] of groups){
      let hottestSpeed = 0;
      let hottestAngular = 0;
      for(const body of bodies){
        hottestSpeed = Math.max(hottestSpeed,Math.hypot(body.velocity.x,body.velocity.y));
        hottestAngular = Math.max(hottestAngular,Math.abs(body.angularVelocity));
      }

      const runaway = hottestSpeed > 9 || hottestAngular > .24;
      let heat = engine._puppetalkHeat.get(group) || 0;
      heat = runaway ? heat+1 : Math.max(0,heat-1);

      // Ordinary governor: trim only the peaks, leaving normal floppy motion alone.
      for(const body of bodies){
        const speed = Math.hypot(body.velocity.x,body.velocity.y);
        if(speed > 7.2){
          const f = 7.2/speed;
          Body.setVelocity(body,{x:body.velocity.x*f,y:body.velocity.y*f});
        }
        if(Math.abs(body.angularVelocity) > .18){
          Body.setAngularVelocity(body,Math.sign(body.angularVelocity)*.18);
        }
      }

      // If several consecutive frames are still explosive, dissipate the stored
      // energy aggressively. The puppet should visibly settle instead of becoming
      // a permanently vibrating spider-person.
      if(heat >= 3){
        bodies.forEach(body=>scaleVelocity(body,.22));
        heat = 0;
      }
      engine._puppetalkHeat.set(group,heat);
    }
  }

  function stabilize(engine){
    enforceJointLimits(engine);
    stabilizeGroups(engine);
  }

  Engine.create = function(options={}){
    const engine = originalCreate(options);
    engine.positionIterations = Math.max(engine.positionIterations || 6,8);
    engine.velocityIterations = Math.max(engine.velocityIterations || 4,6);
    engine.constraintIterations = Math.max(engine.constraintIterations || 2,4);
    return engine;
  };

  Constraint.create = function(options={}){
    if(options.bodyA && options.bodyB){
      options = {
        ...options,
        stiffness:Math.min(options.stiffness ?? 1,.90),
        damping:Math.max(options.damping ?? 0,.20)
      };
    }
    return originalConstraintCreate(options);
  };

  Engine.update = function(engine,delta=1000/60,correction){
    // A long mobile frame is much more dangerous than a slightly slow simulation.
    // Keep the solver step bounded rather than feeding a 25ms lurch into stiff joints.
    const safeDelta = Math.min(delta,1000/60);
    const result = originalUpdate(engine,safeDelta,correction);
    stabilize(engine);
    return result;
  };

  window.PuppetalkStability = {version:21};
})();
