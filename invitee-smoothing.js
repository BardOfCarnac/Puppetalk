// Puppetalk invitee display smoothing.
// The host remains the only physics authority. Invitees render intermediate visual frames
// between authoritative scene packets so a ~15Hz network stream does not look like ~15fps.
// No client physics or collision prediction is performed here.
(()=>{
  const NativeBlob = window.Blob;
  if(!NativeBlob || window.PuppetalkInviteeSmoothing) return;

  function patchSource(source){
    if(typeof source !== 'string' || !source.includes('function startController(room)')) return source;
    if(source.includes('PUPPETALK_INVITEE_SMOOTHING_V2')) return source;

    const stateNeedle = `  let scene = [];
  let micStop = null;`;
    const stateCode = `  let scene = [];
  // PUPPETALK_INVITEE_SMOOTHING_V2
  const smoothInviteeScene = new URLSearchParams(location.search).get('host') !== '1';
  let sceneBlendFrom = null;
  let sceneBlendTo = null;
  let sceneBlendStartedAt = 0;
  let sceneBlendDuration = 52;
  let sceneLastPacketAt = 0;
  let sceneBlendActive = false;
  let sceneSmoothingRaf = 0;
  const scenePoint = value => value && Number.isFinite(value.x) && Number.isFinite(value.y);
  const sceneLerp = (a,b,t) => a+(b-a)*t;
  const sceneEase = t => {
    t = clamp(t,0,1);
    return 1-Math.pow(1-t,3);
  };
  const sceneAngle = (a,b,t) => {
    if(!Number.isFinite(a) || !Number.isFinite(b)) return Number.isFinite(b) ? b : a;
    let d = b-a;
    while(d > Math.PI) d -= Math.PI*2;
    while(d < -Math.PI) d += Math.PI*2;
    return a+d*t;
  };
  function blendScenePoint(a,b,t){
    if(!scenePoint(b)) return b;
    if(!scenePoint(a)) return {...b};
    const out = {...b,x:sceneLerp(a.x,b.x,t),y:sceneLerp(a.y,b.y,t)};
    if(Number.isFinite(a.a) && Number.isFinite(b.a)) out.a = sceneAngle(a.a,b.a,t);
    return out;
  }
  function blendScenePuppet(a,b,t){
    if(!b) return a;
    if(!a || a.slot !== b.slot) return b;
    const out = {...b};
    for(const [key,value] of Object.entries(b)){
      if(scenePoint(value)) out[key] = blendScenePoint(a[key],value,t);
    }
    if(Number.isFinite(a.depth) && Number.isFinite(b.depth)) out.depth = sceneLerp(a.depth,b.depth,t);
    if(Number.isFinite(a.visualScale) && Number.isFinite(b.visualScale)) out.visualScale = sceneLerp(a.visualScale,b.visualScale,t);
    return out;
  }
  function blendSceneArrays(from,to,now){
    if(!Array.isArray(to)) return Array.isArray(from) ? from : [];
    if(!Array.isArray(from) || !from.length) return to;
    const elapsed = Math.max(0,now-sceneBlendStartedAt);
    const remoteT = sceneEase(elapsed/Math.max(1,sceneBlendDuration));
    // The guest's own puppet gets a shorter visual blend so controls still feel immediate.
    const ownT = sceneEase(elapsed/Math.max(1,Math.min(sceneBlendDuration,30)));
    const previous = new Map(from.map(p=>[p?.slot,p]));
    return to.map(next=>blendScenePuppet(previous.get(next?.slot),next,next?.slot===slot ? ownT : remoteT));
  }
  function currentSmoothedScene(now=performance.now()){
    if(!smoothInviteeScene || !sceneBlendTo) return scene;
    return blendSceneArrays(sceneBlendFrom,sceneBlendTo,now);
  }
  function tickSmoothedScene(now){
    sceneSmoothingRaf = requestAnimationFrame(tickSmoothedScene);
    if(!smoothInviteeScene || !sceneBlendTo || !sceneBlendActive) return;
    scene = currentSmoothedScene(now);
    renderPersonalScene();
    if(now-sceneBlendStartedAt >= sceneBlendDuration){
      scene = sceneBlendTo;
      sceneBlendFrom = sceneBlendTo;
      sceneBlendActive = false;
      renderPersonalScene();
    }
  }
  function queueAuthoritativeScene(nextScene){
    const incoming = Array.isArray(nextScene) ? nextScene : [];
    if(!smoothInviteeScene){
      scene = incoming;
      renderPersonalScene();
      return;
    }
    if(!sceneSmoothingRaf) sceneSmoothingRaf = requestAnimationFrame(tickSmoothedScene);
    const now = performance.now();
    if(!sceneBlendTo){
      scene = incoming;
      sceneBlendFrom = incoming;
      sceneBlendTo = incoming;
      sceneBlendStartedAt = now;
      sceneLastPacketAt = now;
      sceneBlendActive = false;
      renderPersonalScene();
      return;
    }
    // Begin the next blend from what was actually on screen, not from the last packet.
    // This prevents a jittery correction when network packet spacing varies.
    sceneBlendFrom = currentSmoothedScene(now);
    sceneBlendTo = incoming;
    const interval = sceneLastPacketAt ? now-sceneLastPacketAt : 66;
    sceneLastPacketAt = now;
    sceneBlendDuration = clamp(interval*.82,34,62);
    sceneBlendStartedAt = now;
    sceneBlendActive = true;
  }

  let micStop = null;`;
    if(!source.includes(stateNeedle)) throw new Error('Invitee smoothing patch failed: controller scene state');
    source = source.replace(stateNeedle,stateCode);

    const receiveNeedle = `        if(msg?.type === 'scene'){
          scene = Array.isArray(msg.puppets) ? msg.puppets : [];
          renderPersonalScene();
        }`;
    const receiveCode = `        if(msg?.type === 'scene'){
          queueAuthoritativeScene(msg.puppets);
        }`;
    if(!source.includes(receiveNeedle)) throw new Error('Invitee smoothing patch failed: scene receive hook');
    source = source.replace(receiveNeedle,receiveCode);

    return source;
  }

  function InviteeSmoothingBlob(parts=[],options={}){
    let nextParts = parts;
    if(options?.type === 'text/javascript' && parts.length === 1 && typeof parts[0] === 'string'){
      const patched = patchSource(parts[0]);
      if(patched !== parts[0]) nextParts = [patched];
    }
    return new NativeBlob(nextParts,options);
  }

  InviteeSmoothingBlob.prototype = NativeBlob.prototype;
  Object.setPrototypeOf(InviteeSmoothingBlob,NativeBlob);
  window.Blob = InviteeSmoothingBlob;
  window.PuppetalkInviteeSmoothing = {
    version:2,
    hostUnaffected:true,
    authoritativePhysics:true,
    remoteBlendRangeMs:[34,62],
    ownBlendMaxMs:30
  };
})();
