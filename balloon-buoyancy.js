// Puppetalk cumulative balloon buoyancy tuning.
// Keeps local limb tug, but enough attached balloons must lift the whole puppet.
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

    // A couple should only make the puppet lighter; the lift curve then rises so
    // roughly 5-6 balloons begin winning against the standing rig and 7-8 plainly
    // carry the puppet. Fade thrust at higher upward speed so it floats instead of
    // accelerating like a rocket.
    const puppet = puppets.get(a.slot);
    const upwardSpeed = Math.max(0,-(puppet?.torso?.velocity?.y || 0));
    const speedFade = clamp(1-upwardSpeed/11,.46,1);
    const lift = (.0038 + Math.max(0,count-2)*.00075) * speedFade;
    const sway = Math.sin(now*.0016+(a.phase||0))*.00032;

    // Most force stays at the real attachment point so balloons can pull limbs and
    // tip the body. A smaller share goes through the torso so accumulated buoyancy
    // actually raises the whole articulated puppet rather than only stretching it.
    const torso = puppet?.torso;
    const localShare = torso && torso !== a.body ? .72 : 1;
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
