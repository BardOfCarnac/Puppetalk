(()=>{
  const Peer = window.Peer;
  if(!Peer?.prototype) return;

  const rawConnect = Peer.prototype.connect;
  const rawPeerOn = Peer.prototype.on;

  const DEPTH_MIN = -.28;
  const DEPTH_MAX = 1.0;
  const CLOSER_STEP = .25;
  const AWAY_STEP = .20;
  const QUICK_TAP_MAX_MS = 180;
  const LONG_TAP_MIN_MS = 235;
  const LONG_TAP_MAX_MS = 410;
  const QUICK_TAP_COUNT = 3;
  const QUICK_TAP_WINDOW_MS = 760;
  const MAX_GESTURE_TRAVEL = .045;
  const slotState = new Map();

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  function stateFor(slot){
    if(!slotState.has(slot)) slotState.set(slot,{
      depth:0,
      target:0,
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

  function torsoGrab(input){
    return grabsOf(input).find(g=>g?.part === 'torso') || null;
  }

  function advance(state,now){
    const dt = clamp((now-state.lastTick)/1000,0,.15);
    state.lastTick = now;
    if(dt <= 0) return;
    const response = 1-Math.exp(-7.2*dt);
    state.depth += (state.target-state.depth)*response;
    if(Math.abs(state.target-state.depth) < .00035) state.depth = state.target;
  }

  function stepDepth(slot,direction){
    if(!Number.isInteger(slot) || !Number.isFinite(direction)) return;
    const state = stateFor(slot);
    advance(state,performance.now());
    const amount = direction > 0 ? CLOSER_STEP : AWAY_STEP;
    state.target = clamp(state.target+Math.sign(direction)*amount,DEPTH_MIN,DEPTH_MAX);
  }

  function targetScale(depth){
    if(depth >= 0) return clamp(1+depth*1.58,1,2.58);
    return clamp(1+depth*.72,.80,1);
  }

  function targetShift(depth){
    return depth >= 0 ? depth*.245 : depth*.025;
  }

  function tunePoint(point,center,scale,shift){
    if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;
    return {
      ...point,
      x:center.x+(point.x-center.x)*scale,
      y:center.y+(point.y-center.y)*scale+shift
    };
  }

  function tunePuppet(p,now){
    if(!p?.torso || !Number.isInteger(p.slot)) return p;
    const state = stateFor(p.slot);
    advance(state,now);
    const depth = state.depth;
    if(Math.abs(depth) < .0001) return {...p,depth:0,visualScale:1};

    const scale = targetScale(depth);
    const shift = targetShift(depth);
    const center = {x:p.torso.x,y:p.torso.y};
    const out = {...p,depth,visualScale:scale};
    for(const key of ['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']){
      if(out[key]) out[key] = tunePoint(out[key],center,scale,shift);
    }
    return out;
  }

  function tuneScene(data){
    if(data?.type !== 'scene' || !Array.isArray(data.puppets)) return data;
    const now = performance.now();
    const puppets = data.puppets.map(p=>tunePuppet(p,now)).sort((a,b)=>(a.depth||0)-(b.depth||0));
    return {
      ...data,
      stageViewport:{width:Math.max(1,innerWidth),height:Math.max(1,innerHeight)},
      puppets
    };
  }

  function clearQuickTaps(conn){
    conn.__puppetalkQuickTaps = [];
  }

  function registerQuickTap(conn,now,sendRaw){
    const recent = (Array.isArray(conn.__puppetalkQuickTaps) ? conn.__puppetalkQuickTaps : [])
      .filter(time=>now-time <= QUICK_TAP_WINDOW_MS);
    recent.push(now);
    if(recent.length >= QUICK_TAP_COUNT){
      clearQuickTaps(conn);
      sendRaw({type:'depth-step',direction:1});
      return;
    }
    conn.__puppetalkQuickTaps = recent;
  }

  function observeControllerGesture(conn,input,sendRaw){
    const torso = torsoGrab(input);
    const now = performance.now();
    let gesture = conn.__puppetalkDepthGesture;

    if(torso && Number.isFinite(torso.screenY)){
      if(!gesture){
        gesture = conn.__puppetalkDepthGesture = {
          startedAt:now,
          startX:Number.isFinite(torso.x)?torso.x:.5,
          startY:Number.isFinite(torso.y)?torso.y:.5,
          maxTravel:0
        };
      }else{
        const dx=(Number.isFinite(torso.x)?torso.x:gesture.startX)-gesture.startX;
        const dy=(Number.isFinite(torso.y)?torso.y:gesture.startY)-gesture.startY;
        gesture.maxTravel=Math.max(gesture.maxTravel,Math.hypot(dx,dy));
      }
      return;
    }

    if(!gesture) return;
    conn.__puppetalkDepthGesture = null;
    const duration = now-gesture.startedAt;

    if(gesture.maxTravel > MAX_GESTURE_TRAVEL){
      clearQuickTaps(conn);
      return;
    }

    if(duration <= QUICK_TAP_MAX_MS){
      registerQuickTap(conn,now,sendRaw);
      return;
    }

    if(duration >= LONG_TAP_MIN_MS && duration <= LONG_TAP_MAX_MS){
      clearQuickTaps(conn);
      sendRaw({type:'depth-step',direction:-1});
      return;
    }

    clearQuickTaps(conn);
  }

  function updateSourceStage(data){
    const next=data?.stageViewport;
    if(!next || !Number.isFinite(next.width) || !Number.isFinite(next.height)) return;
    const prev=window.PuppetalkSourceStage;
    if(prev && prev.width===next.width && prev.height===next.height) return;
    window.PuppetalkSourceStage={width:next.width,height:next.height};
    window.dispatchEvent(new Event('puppetalk-stage-viewport'));
  }

  function patchConnection(conn,side){
    if(!conn || conn.__puppetalkForegroundPatched) return conn;
    conn.__puppetalkForegroundPatched = true;
    const previousOn = conn.on.bind(conn);
    const previousSend = conn.send.bind(conn);

    conn.on = function(event,handler){
      if(event === 'data' && typeof handler === 'function'){
        return previousOn(event,data=>{
          if(side === 'controller'){
            if(data?.type === 'scene') updateSourceStage(data);
            return handler(data);
          }
          if(side === 'stage' && data?.type === 'depth-step' && Number.isInteger(conn.__puppetalkForegroundSlot)){
            stepDepth(conn.__puppetalkForegroundSlot,data.direction);
            return handler(data);
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
      if(side === 'controller' && data?.type === 'input' && data.input){
        observeControllerGesture(conn,data.input,previousSend);
      }
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

  window.PuppetalkDepthState = {
    getDepthForSlot(slot){
      if(!Number.isInteger(slot)) return 0;
      const state=stateFor(slot);
      advance(state,performance.now());
      return state.depth;
    },
    scaleForDepth:targetScale,
    shiftForDepth:targetShift
  };
  window.PuppetalkForegroundTuning = {
    version:34,
    minDepth:DEPTH_MIN,
    maxDepth:DEPTH_MAX,
    closerStep:CLOSER_STEP,
    awayStep:AWAY_STEP,
    quickTapCount:QUICK_TAP_COUNT
  };
})();
