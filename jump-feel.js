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

  function legCanSupport(p,side){
    const prefix = side === 'left' ? 'left' : 'right';
    if(p.severedJoints?.has(prefix+'Hip') || p.severedJoints?.has(prefix+'Knee')) return false;
    if(p.brokenSeams?.has(prefix+'Thigh') || p.brokenSeams?.has(prefix+'Shin')) return false;
    if(p.brokenSeams?.has('torsoLower')) return false;
    return true;
  }

  function drivePuppet(p){`
    );

    patched = patched.replace(
`    const now = performance.now();
    const prepared = [];`,
`    const now = performance.now();
    const air = rig.air || (rig.air = {active:false,grounded:false});
    const leftSupport = grabWorldPoint(p,'leftFoot');
    const rightSupport = grabWorldPoint(p,'rightFoot');
    const contactSlack = 11;
    const leftGrounded = legCanSupport(p,'left') && leftSupport.y >= floorY-contactSlack;
    const rightGrounded = legCanSupport(p,'right') && rightSupport.y >= floorY-contactSlack;
    air.grounded = leftGrounded || rightGrounded;
    // Airborne is now a physical state, not a timed float effect. There is no
    // counter-gravity: once both feet leave the floor, normal Matter gravity owns Y.
    air.active = !p.rag && !air.grounded;

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
  window.PuppetalkJumpFeel = {version:36};
})();
