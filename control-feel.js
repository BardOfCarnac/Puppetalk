(()=>{
  const NativeBlob = window.Blob;
  if(!NativeBlob || window.PuppetalkControlFeel) return;

  function patchPuppetSource(source){
    if(typeof source !== 'string' || !source.includes('function rootFollow(part)') || !source.includes('function ensureRig(p)')) return source;

    let patched = source;

    patched = patched.replace(
      /  function rootFollow\(part\)\{[\s\S]*?\n  \}\n\n  function drivePuppet/,
`  function rootFollow(part){
    if(part === 'torso') return 1;
    if(part === 'pelvis') return .92;
    if(part.includes('Shoulder')) return .78;
    if(part === 'head') return .66;
    if(part.includes('Hand')) return .40;
    return .27;
  }

  function rootSlack(part){
    if(part === 'torso' || part === 'pelvis') return {free:0,ramp:1};
    if(part.includes('Shoulder')) return {free:24,ramp:48};
    if(part === 'head') return {free:36,ramp:64};
    if(part.includes('Hand')) return {free:58,ramp:82};
    return {free:48,ramp:76};
  }

  function followAfterSlack(part,dx,dy){
    if(part === 'torso' || part === 'pelvis') return 1;
    const slack = rootSlack(part);
    const travel = Math.hypot(dx,dy);
    const t = clamp((travel-slack.free)/slack.ramp,0,1);
    const eased = t*t*(3-2*t);
    return rootFollow(part)*eased;
  }

  function drivePuppet`
    );

    patched = patched.replace(
`      const age = now-session.startedAt;
      const guided = antiTangleTarget(p,grab.part,desired,age);
      const follow = rootFollow(grab.part);
      const rootX = grab.part === 'torso' || grab.part === 'pelvis'
        ? desired.x
        : session.startRootX+(desired.x-session.startDesired.x)*follow;
      const weight = grab.part === 'torso' ? 2 : grab.part === 'pelvis' ? 1.7 : follow;
      rootSum += clamp(rootX,70,W-70)*weight;
      rootWeight += weight;
      if(grab.part === 'torso' || grab.part === 'pelvis') torsoDesired = desired;
      prepared.push({grab,desired,guided,session});`,
`      const age = now-session.startedAt;
      const guided = antiTangleTarget(p,grab.part,desired,age);
      const dx = desired.x-session.startDesired.x;
      const dy = desired.y-session.startDesired.y;
      const follow = followAfterSlack(grab.part,dx,dy);
      const baseFollow = rootFollow(grab.part);
      const followBlend = baseFollow > 0 ? clamp(follow/baseFollow,0,1) : 1;
      const rootX = grab.part === 'torso' || grab.part === 'pelvis'
        ? desired.x
        : session.startRootX+dx*follow;
      const weight = grab.part === 'torso' ? 2 : grab.part === 'pelvis' ? 1.7 : 1;
      rootSum += clamp(rootX,70,W-70)*weight;
      rootWeight += weight;
      if(grab.part === 'torso' || grab.part === 'pelvis') torsoDesired = desired;
      prepared.push({grab,desired,guided,session,followBlend});`
    );

    patched = patched.replace(
`        const followY = part.includes('Shoulder') ? .68 : part === 'head' ? .7 : part.includes('Hand') ? .38 : .28;
        const bodyTargetY = item.session.startTorsoY+(item.desired.y-item.session.startDesired.y)*followY;
        springPull(t,t.position,{x:anchorX,y:bodyTargetY},.000088/grabs.length,.0043);`,
`        const followY = part.includes('Shoulder') ? .68 : part === 'head' ? .7 : part.includes('Hand') ? .38 : .28;
        const followBlend = item.followBlend ?? 1;
        const bodyTargetY = item.session.startTorsoY+(item.desired.y-item.session.startDesired.y)*followY*followBlend;
        springPull(t,t.position,{x:anchorX,y:bodyTargetY},(.000052+.000036*followBlend)/grabs.length,.0045);`
    );

    // The pickup assist should only be a tiny nudge; deliberate knots remain possible.
    patched = patched.replace('const fade = 1-clamp(age/190,0,1);','const fade = 1-clamp(age/120,0,1);');
    patched = patched.replace('const amount = .3*fade;','const amount = .10*fade;');

    // Carry the finger's true viewport Y as well as the stage/canvas coordinate.
    // Depth gating uses this value, so "screen edge" really means the phone edge.
    patched = patched.replace(
      "function syncGrabs(){ input.grabs = [...activePointers.values()].slice(0,2).map(g=>({part:g.part,x:g.x,y:g.y})); }",
      "function syncGrabs(){ input.grabs = [...activePointers.values()].slice(0,2).map(g=>({part:g.part,x:g.x,y:g.y,screenY:g.screenY})); }"
    );
    patched = patched.replace(
      "activePointers.set(event.pointerId,{part:grab.part,label:grab.label,x:p.x,y:p.y});",
      "activePointers.set(event.pointerId,{part:grab.part,label:grab.label,x:p.x,y:p.y,screenY:Math.max(0,Math.min(1,event.clientY/Math.max(innerHeight,1)))});"
    );
    patched = patched.replace(
      "    grab.x = p.x;\n    grab.y = p.y;\n    syncGrabs();",
      "    grab.x = p.x;\n    grab.y = p.y;\n    grab.screenY = Math.max(0,Math.min(1,event.clientY/Math.max(innerHeight,1)));\n    syncGrabs();"
    );

    return patched;
  }

  function PuppetalkBlob(parts=[],options={}){
    let nextParts = parts;
    if(options?.type === 'text/javascript' && parts.length === 1 && typeof parts[0] === 'string'){
      const patched = patchPuppetSource(parts[0]);
      if(patched !== parts[0]) nextParts = [patched];
    }
    return new NativeBlob(nextParts,options);
  }

  PuppetalkBlob.prototype = NativeBlob.prototype;
  Object.setPrototypeOf(PuppetalkBlob,NativeBlob);
  window.Blob = PuppetalkBlob;
  window.PuppetalkControlFeel = {version:28};
})();
