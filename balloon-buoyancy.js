// Puppetalk cumulative balloon buoyancy tuning.
// Keeps local limb tug, but four balloons lift and a full cluster pins the puppet overhead.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_BALLOON_TIE_V1') || source.includes('PUPPETALK_BALLOON_BUOYANCY_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_BALLOON_TIE_V1',
      '  // PUPPETALK_BALLOON_TIE_V1\n  // PUPPETALK_BALLOON_BUOYANCY_V1'
    );

    const needle = `  function driveAttachedBalloon(prop,now){
    const a = prop?.attachedTo;
    if(prop?.type !== 'balloon' || a?.mode !== 'balloon' || !a.body) return;
    const anchor = worldOffset(a.body,a.offset);
    // Around six balloons can overcome a standing puppet's total weight; one should
    // mainly tug at its individual limb/body segment.
    const lift = .00305;
    const sway = Math.sin(now*.0016+(a.phase||0))*.00032;
    Body.applyForce(a.body,anchor,{x:sway,y:-lift});
  }`;

    const replacement = `  function driveAttachedBalloon(prop,now){
    const a = prop?.attachedTo;
    if(prop?.type !== 'balloon' || a?.mode !== 'balloon' || !a.body) return;
    const anchor = worldOffset(a.body,a.offset);

    let count = 0;
    for(const candidate of props.values()){
      if(candidate?.type === 'balloon' &&
         candidate.attachedTo?.mode === 'balloon' &&
         candidate.attachedTo?.slot === a.slot) count++;
    }

    // Four balloons are the intentional take-off threshold. One or two mostly tug;
    // three make the puppet conspicuously light; the fourth gives enough combined
    // buoyancy to beat gravity + standing support. Beyond that the curve rises hard
    // so eight balloons keep hauling until the puppet is pressed against the ceiling.
    let baseLift;
    if(count <= 1) baseLift = .0034;
    else if(count === 2) baseLift = .0045;
    else if(count === 3) baseLift = .0062;
    else if(count === 4) baseLift = .0115;
    else baseLift = .0115 + (count-4)*.0018;

    const puppet = puppets.get(a.slot);
    const upwardSpeed = Math.max(0,-(puppet?.torso?.velocity?.y || 0));
    // Retain some terminal-speed damping, but never fade lift enough for a large
    // balloon cluster to lose against the standing rig before it reaches the ceiling.
    const speedFade = clamp(1-upwardSpeed/13,.55,1);
    const lift = baseLift * speedFade;
    const sway = Math.sin(now*.0016+(a.phase||0))*.00032;

    // Preserve visibly local limb pulling, while passing more force through the torso
    // once take-off begins so four balloons attached around the limbs raise the whole
    // articulated body rather than merely stretching it upward.
    const torso = puppet?.torso;
    const localShare = torso && torso !== a.body ? (count >= 4 ? .64 : .76) : 1;
    Body.applyForce(a.body,anchor,{x:sway,y:-lift*localShare});
    if(torso && torso !== a.body){
      Body.applyForce(torso,torso.position,{x:0,y:-lift*(1-localShare)});
    }
  }`;

    if(!source.includes(needle)) throw new Error('Balloon buoyancy patch failed: lift function');
    return source.replace(needle,replacement);
  }

  window.fetch = async (...args)=>{
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text),{
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    });
  };
})();
