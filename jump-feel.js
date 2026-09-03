(()=>{
  const NativeBlob = window.Blob;
  if(!NativeBlob || window.PuppetalkJumpFeel) return;

  function patchPuppetSource(source){
    if(typeof source !== 'string' || !source.includes('function followAfterSlack(part,dx,dy)') || !source.includes('function drivePuppet(p)')) return source;
    let patched = source;

    patched = patched.replace(
      '\n\n  function drivePuppet(p){',
`\n\n  function airborneBodies(p){
    return [p.torso,p.head,p.uaL,p.faL,p.uaR,p.faR,p.thL,p.shL,p.thR,p.shR].filter(Boolean);
  }

  function drivePuppet(p){`
    );

    patched = patched.replace(
`    const now = performance.now();
    const prepared = [];`,
`    const now = performance.now();
    const air = rig.air || (rig.air = {
      active:false,
      wasPelvis:false,
      startedAt:0,
      until:0,
      lastTorsoVy:0
    });
    const pelvisGrab = grabs.find(g=>g.part === 'pelvis');

    if(p.rag){
      air.active = false;
      air.wasPelvis = false;
    }else if(pelvisGrab){
      air.wasPelvis = true;
      air.active = false;
      air.lastTorsoVy = t.velocity.y;
    }else if(air.wasPelvis){
      air.wasPelvis = false;
      const lift = standingY-t.position.y;
      if(lift > 10){
        air.active = true;
        air.startedAt = now;
        air.until = now+720;
        const carry = clamp(air.lastTorsoVy,-5.4,1.1);
        if(carry < -.25){
          Body.setVelocity(t,{x:t.velocity.x,y:Math.min(t.velocity.y,carry)});
        }
      }
    }

    if(air.active){
      const age = now-air.startedAt;
      const landed = age > 180 && t.position.y >= standingY-1 && t.velocity.y >= 0;
      if(now >= air.until || landed){
        air.active = false;
      }else{
        const floatFade = 1-clamp(age/620,0,1);
        const counterGravity = .00038+.00020*floatFade;
        for(const body of airborneBodies(p)){
          Body.applyForce(body,body.position,{x:0,y:-body.mass*counterGravity});
        }
      }
    }

    const prepared = [];`
    );

    patched = patched.replace(
      '    if(!coreGrab){\n      springPull(t,t.position,{x:anchorX,y:standingY},limbGrab ? .00011 : .00015,.0049);',
      '    if(!coreGrab && !rig.air?.active){\n      springPull(t,t.position,{x:anchorX,y:standingY},limbGrab ? .00011 : .00015,.0049);'
    );

    patched = patched.replace(
      "    if(!activeParts.has('leftFoot') && !rig.pins.leftFoot){",
      "    if(!activeParts.has('leftFoot') && !rig.pins.leftFoot && !rig.air?.active){"
    );
    patched = patched.replace(
      "    if(!activeParts.has('rightFoot') && !rig.pins.rightFoot){",
      "    if(!activeParts.has('rightFoot') && !rig.pins.rightFoot && !rig.air?.active){"
    );

    patched = patched.replace(
      "      springPull(body,point,{x:anchorX+pin.x,y:standingY+pin.y},strength,.0044);",
      "      const airOffsetY = rig.air?.active ? t.position.y-standingY : 0;\n      springPull(body,point,{x:anchorX+pin.x,y:standingY+pin.y+airOffsetY},strength,.0044);"
    );

    patched = patched.replace(
      "      springPull(p.head,p.head.position,{x:anchorX,y:standingY-65},.000095,.0046);",
      "      const headY = rig.air?.active ? t.position.y-65 : standingY-65;\n      springPull(p.head,p.head.position,{x:anchorX,y:headY},.000095,.0046);"
    );

    return patched;
  }

  function JumpFeelBlob(parts=[],options={}){
    let nextParts = parts;
    if(options?.type === 'text/javascript' && parts.length === 1 && typeof parts[0] === 'string'){
      const patched = patchPuppetSource(parts[0]);
      if(patched !== parts[0]) nextParts = [patched];
    }
    return new NativeBlob(nextParts,options);
  }

  JumpFeelBlob.prototype = NativeBlob.prototype;
  Object.setPrototypeOf(JumpFeelBlob,NativeBlob);
  window.Blob = JumpFeelBlob;
  window.PuppetalkJumpFeel = {version:35};
})();
