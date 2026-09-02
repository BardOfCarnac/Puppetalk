(()=>{
  const Peer = window.Peer;
  if(!Peer?.prototype) return;

  const rawConnect = Peer.prototype.connect;
  const rawPeerOn = Peer.prototype.on;

  const EDGE = .055;
  const DEPTH_MIN = -.30;
  const DEPTH_MAX = 1.0;
  const DEPTH_RATE = .58;
  const SIGNAL_SCALE = 1/2.15;
  const slotState = new Map();

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const smoothstep = t=>{
    t = clamp(t,0,1);
    return t*t*(3-2*t);
  };

  function stateFor(slot){
    if(!slotState.has(slot)) slotState.set(slot,{
      depth:0,
      drive:0,
      lastTick:performance.now()
    });
    return slotState.get(slot);
  }

  function grabsOf(input){
    if(Array.isArray(input?.grabs)) return input.grabs;
    if(input?.grabbing && input?.grabPart){
      return [{part:input.grabPart,x:input.x,y:input.y,screenY:input.screenY}];
    }
    return [];
  }

  function driveFor(screenY){
    if(!Number.isFinite(screenY)) return 0;
    if(screenY <= EDGE){
      const penetration = smoothstep((EDGE-screenY)/EDGE);
      return -(.38+.62*penetration);
    }
    if(screenY >= 1-EDGE){
      const penetration = smoothstep((screenY-(1-EDGE))/EDGE);
      return .38+.62*penetration;
    }
    return 0;
  }

  function advance(state,now){
    const dt = clamp((now-state.lastTick)/1000,0,.12);
    state.lastTick = now;
    if(!state.drive || dt <= 0) return;
    state.depth = clamp(state.depth+state.drive*DEPTH_RATE*dt,DEPTH_MIN,DEPTH_MAX);
  }

  function mapStageInput(conn,input){
    if(!input) return input;
    const copy = {
      ...input,
      grabs:Array.isArray(input.grabs) ? input.grabs.map(g=>({...g})) : input.grabs
    };
    const grabs = grabsOf(copy);
    const torso = grabs.find(g=>g?.part === 'torso');
    const slot = conn.__puppetalkForegroundSlot;

    if(!Number.isInteger(slot)) return copy;
    const state = stateFor(slot);
    advance(state,performance.now());

    if(!torso){
      state.drive = 0;
      return copy;
    }

    state.drive = driveFor(torso.screenY);

    // The old locomotion layer still uses torso Y as its depth signal. Feed it a
    // synthetic signal derived only from our explicit depth state, never from the
    // ordinary canvas drag. This removes the centre-screen depth leak entirely.
    torso.y = clamp(.5+state.depth*SIGNAL_SCALE,.08,.94);
    if(!Array.isArray(copy.grabs) && copy.grabbing && copy.grabPart === 'torso'){
      copy.y = torso.y;
    }
    return copy;
  }

  function targetScale(depth){
    if(depth >= 0) return clamp(1+depth*1.58,1,2.58);
    return clamp(1+depth*.72,.76,1);
  }

  function targetShift(depth){
    return depth >= 0 ? depth*.245 : depth*.025;
  }

  function tunePoint(point,center,extraScale,extraShift){
    if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;
    return {
      ...point,
      x:center.x+(point.x-center.x)*extraScale,
      y:center.y+(point.y-center.y)*extraScale+extraShift
    };
  }

  function tunePuppet(p,now){
    if(!p?.torso || !Number.isInteger(p.slot)) return p;
    const state = stateFor(p.slot);
    advance(state,now);
    const depth = state.depth;
    if(Math.abs(depth) < .0001) return {...p,depth:0};

    const currentScale = Number.isFinite(p.visualScale) && p.visualScale > 0 ? p.visualScale : 1;
    const desiredScale = targetScale(depth);
    const extraScale = desiredScale/currentScale;
    const locomotionShift = Number.isFinite(p.depth) ? p.depth*.035 : 0;
    const extraShift = targetShift(depth)-locomotionShift;
    const center = {x:p.torso.x,y:p.torso.y};
    const out = {...p,depth,visualScale:desiredScale};

    for(const key of ['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']){
      if(out[key]) out[key] = tunePoint(out[key],center,extraScale,extraShift);
    }
    return out;
  }

  function tuneScene(data){
    if(data?.type !== 'scene' || !Array.isArray(data.puppets)) return data;
    const now = performance.now();
    const puppets = data.puppets.map(p=>tunePuppet(p,now)).sort((a,b)=>(a.depth||0)-(b.depth||0));
    return {...data,puppets};
  }

  function patchConnection(conn,side){
    if(!conn || conn.__puppetalkForegroundPatched) return conn;
    conn.__puppetalkForegroundPatched = true;
    const previousOn = conn.on.bind(conn);
    const previousSend = conn.send.bind(conn);

    conn.on = function(event,handler){
      if(event === 'data' && typeof handler === 'function' && side === 'stage'){
        return previousOn(event,data=>{
          if(data?.type === 'input'){
            return handler({...data,input:mapStageInput(conn,data.input || {})});
          }
          return handler(data);
        });
      }
      return previousOn(event,handler);
    };

    conn.send = function(data){
      if(side === 'stage' && data?.type === 'welcome' && Number.isInteger(data.slot)){
        conn.__puppetalkForegroundSlot = data.slot;
        stateFor(data.slot).lastTick = performance.now();
      }
      if(side === 'stage' && data?.type === 'scene') return previousSend(tuneScene(data));
      return previousSend(data);
    };

    return conn;
  }

  Peer.prototype.connect = function(...args){
    return patchConnection(rawConnect.apply(this,args),'controller');
  };

  Peer.prototype.on = function(event,handler,...rest){
    if(event === 'connection' && typeof handler === 'function'){
      return rawPeerOn.call(this,event,conn=>handler(patchConnection(conn,'stage')),...rest);
    }
    return rawPeerOn.call(this,event,handler,...rest);
  };

  window.PuppetalkForegroundTuning = {
    version:29,
    edge:EDGE,
    minDepth:DEPTH_MIN,
    maxDepth:DEPTH_MAX
  };
})();
