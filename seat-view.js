// Puppetalk seat-relative view projection.
// Keeps the familiar rectangular stage, but rotates each other player's local
// sideways/depth movement into the viewer's seat orientation (2-6 players).
(()=>{
  const Peer = window.Peer;
  const depth = window.PuppetalkDepthState;
  const tuning = window.PuppetalkForegroundTuning;
  if(!Peer?.prototype || !depth || window.PuppetalkSeatView) return;

  const previousConnect = Peer.prototype.connect;
  const TWO_PI = Math.PI*2;
  const DEPTH_X = .28; // one full local depth unit expressed in normalized screen width
  const FOREGROUND_TUNED = new Set(['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']);
  const propOwners = new Map();

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const homeX=slot=>.16+slot*.135;

  function seatAngles(puppets){
    const slots=[...new Set((puppets||[]).map(p=>p?.slot).filter(Number.isInteger))].sort((a,b)=>a-b);
    const out=new Map();
    const n=Math.max(1,slots.length);
    slots.forEach((slot,index)=>out.set(slot,TWO_PI*index/n));
    return out;
  }

  function relativeSeatAngle(slot,viewerSlot,angles){
    if(slot===viewerSlot) return 0;
    const a=angles.get(slot);
    const v=angles.get(viewerSlot);
    if(!Number.isFinite(a)||!Number.isFinite(v)) return 0;
    let d=a-v;
    while(d>Math.PI) d-=TWO_PI;
    while(d< -Math.PI) d+=TWO_PI;
    return d;
  }

  function nearestPlane(value){
    const planes=Array.isArray(tuning?.planes)?tuning.planes:[];
    if(!planes.length) return undefined;
    let best=0;
    let distance=Infinity;
    planes.forEach((p,index)=>{
      const d=Math.abs(p-value);
      if(d<distance){distance=d;best=index;}
    });
    return best;
  }

  function rawPointFromForeground(point,center,scale,shift){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)) return point;
    const safe=Math.max(.0001,scale||1);
    return {
      ...point,
      x:center.x+(point.x-center.x)/safe,
      y:center.y+(point.y-shift-center.y)/safe
    };
  }

  function projectRawPoint(point,rawCenter,targetCenter,targetScale,targetShift){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)) return point;
    return {
      ...point,
      x:targetCenter.x+(point.x-rawCenter.x)*targetScale,
      y:rawCenter.y+(point.y-rawCenter.y)*targetScale+targetShift
    };
  }

  function projectPuppet(p,viewerSlot,angles){
    if(!p?.torso||!Number.isInteger(p.slot)) return {puppet:p,meta:null};

    const rawDepth=Number.isFinite(p.depth)?p.depth:0;
    const rawScale=Number.isFinite(p.visualScale)?p.visualScale:depth.scaleForDepth(rawDepth);
    const rawShift=depth.shiftForDepth(rawDepth);
    const rawCenter={x:p.torso.x,y:p.torso.y-rawShift};
    const delta=relativeSeatAngle(p.slot,viewerSlot,angles);
    const c=Math.cos(delta);
    const s=Math.sin(delta);

    // Treat each puppet's current displacement from its spawn lane as movement in
    // that player's own local floor coordinates. Rotating only the displacement
    // preserves the familiar rectangular neutral layout and keeps the viewer's own
    // puppet exactly aligned with their existing controls.
    const localSide=rawCenter.x-homeX(p.slot);
    const localForward=rawDepth*DEPTH_X;
    const viewSide=localSide*c+localForward*s;
    const viewForward=localForward*c-localSide*s;
    const targetX=homeX(p.slot)+viewSide;
    const minDepth=Number.isFinite(tuning?.minDepth)?tuning.minDepth:-.48;
    const maxDepth=Number.isFinite(tuning?.maxDepth)?tuning.maxDepth:1;
    const viewDepth=clamp(viewForward/DEPTH_X,minDepth,maxDepth);
    const targetScale=depth.scaleForDepth(viewDepth);
    const targetShift=depth.shiftForDepth(viewDepth);
    const targetCenter={x:targetX,y:rawCenter.y};

    const out={...p,depth:viewDepth,visualScale:targetScale};
    const plane=nearestPlane(viewDepth);
    if(Number.isInteger(plane)) out.depthPlane=plane;

    for(const [key,value] of Object.entries(p)){
      if(key==='pieces'||key==='look'||key==='depth'||key==='visualScale'||key==='depthPlane') continue;
      if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)) continue;
      const raw=FOREGROUND_TUNED.has(key)
        ? rawPointFromForeground(value,rawCenter,rawScale,rawShift)
        : value;
      out[key]=projectRawPoint(raw,rawCenter,targetCenter,targetScale,targetShift);
    }

    if(Array.isArray(p.pieces)){
      out.pieces=p.pieces.map(piece=>{
        const rawC=piece?.c?rawPointFromForeground(piece.c,rawCenter,rawScale,rawShift):piece?.c;
        const rawV=Array.isArray(piece?.v)
          ? piece.v.map(q=>rawPointFromForeground(q,rawCenter,rawScale,rawShift))
          : piece?.v;
        return {
          ...piece,
          c:rawC?projectRawPoint(rawC,rawCenter,targetCenter,targetScale,targetShift):rawC,
          v:Array.isArray(rawV)?rawV.map(q=>projectRawPoint(q,rawCenter,targetCenter,targetScale,targetShift)):rawV
        };
      });
    }

    return {
      puppet:out,
      meta:{slot:p.slot,rawCenter,targetCenter,targetScale,targetShift}
    };
  }

  function projectProp(prop,metaBySlot){
    if(!prop||!Number.isFinite(prop.x)||!Number.isFinite(prop.y)) return prop;
    const explicit=Number.isInteger(prop?.heldBy?.slot)
      ? prop.heldBy.slot
      : Number.isInteger(prop?.attachedTo?.slot)
        ? prop.attachedTo.slot
        : null;
    if(Number.isInteger(explicit)) propOwners.set(prop.id,explicit);
    const owner=Number.isInteger(explicit)?explicit:propOwners.get(prop.id);
    const meta=metaBySlot.get(owner);
    if(!meta) return prop;
    return {
      ...prop,
      x:meta.targetCenter.x+(prop.x-meta.rawCenter.x)*meta.targetScale,
      y:meta.rawCenter.y+(prop.y-meta.rawCenter.y)*meta.targetScale+meta.targetShift
    };
  }

  function projectScene(data,viewerSlot){
    if(data?.type!=='scene'||!Array.isArray(data.puppets)||!Number.isInteger(viewerSlot)) return data;
    const angles=seatAngles(data.puppets);
    if(!angles.has(viewerSlot)) return data;
    const metaBySlot=new Map();
    const puppets=data.puppets.map(p=>{
      const result=projectPuppet(p,viewerSlot,angles);
      if(result.meta) metaBySlot.set(result.meta.slot,result.meta);
      return result.puppet;
    }).sort((a,b)=>(a.depth||0)-(b.depth||0));
    const props=Array.isArray(data.props)?data.props.map(prop=>projectProp(prop,metaBySlot)):data.props;
    return {...data,puppets,props,seatCount:angles.size,viewerSeat:viewerSlot};
  }

  function patchControllerConnection(conn){
    if(!conn||conn.__puppetalkSeatViewPatched) return conn;
    conn.__puppetalkSeatViewPatched=true;
    const previousOn=conn.on.bind(conn);
    let viewerSlot=null;
    let lastInput=null;
    let lastOutput=null;

    conn.on=function(event,handler){
      if(event==='data'&&typeof handler==='function'){
        return previousOn(event,data=>{
          if(data?.type==='welcome'&&Number.isInteger(data.slot)) viewerSlot=data.slot;
          if(data?.type==='scene'&&Number.isInteger(viewerSlot)){
            // Several app layers may register data handlers. Transform one incoming
            // scene object only once and reuse the result for all of them.
            if(data===lastInput&&lastOutput) return handler(lastOutput);
            lastInput=data;
            lastOutput=projectScene(data,viewerSlot);
            return handler(lastOutput);
          }
          return handler(data);
        });
      }
      return previousOn(event,handler);
    };
    return conn;
  }

  Peer.prototype.connect=function(...args){
    return patchControllerConnection(previousConnect.apply(this,args));
  };

  window.PuppetalkSeatView={version:1,maxPlayers:6};
})();
