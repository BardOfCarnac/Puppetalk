(()=>{
  const Peer = window.Peer;
  if(!Peer?.prototype) return;

  const rawConnect = Peer.prototype.connect;
  const rawPeerOn = Peer.prototype.on;

  // These are viewport coordinates, not stage-canvas coordinates.
  const TOP_EDGE = .08;
  const BOTTOM_EDGE = .92;
  const DEPTH_SPAN = .72;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const smoothstep = t=>{
    t = clamp(t,0,1);
    return t*t*(3-2*t);
  };

  function grabsOf(input){
    if(Array.isArray(input?.grabs)) return input.grabs;
    if(input?.grabbing && input?.grabPart){
      return [{part:input.grabPart,x:input.x,y:input.y,screenY:input.screenY}];
    }
    return [];
  }

  function edgeMappedInput(conn,input){
    if(!input) return input;
    const copy = {
      ...input,
      grabs:Array.isArray(input.grabs) ? input.grabs.map(g=>({...g})) : input.grabs
    };
    const grabs = grabsOf(copy);
    const torso = grabs.find(g=>g?.part === 'torso');

    if(!torso || !Number.isFinite(torso.y)){
      conn.__puppetalkDepthGesture = null;
      return copy;
    }

    const edgeY = Number.isFinite(torso.screenY) ? torso.screenY : null;
    const freshGesture = !conn.__puppetalkDepthGesture;
    if(freshGesture){
      conn.__puppetalkDepthGesture = {virtualY:.5};
    }
    const gesture = conn.__puppetalkDepthGesture;

    // The first packet only establishes the neutral origin. After that, depth can
    // change ONLY when the captured finger reaches the actual phone-screen edge.
    // Once changed, the virtual depth drag stays latched until release, so moving
    // the finger back through the middle cannot undo it accidentally.
    if(!freshGesture && edgeY != null){
      if(edgeY >= BOTTOM_EDGE){
        const penetration = smoothstep((edgeY-BOTTOM_EDGE)/(1-BOTTOM_EDGE));
        const candidate = .5 + DEPTH_SPAN*penetration;
        gesture.virtualY = Math.max(gesture.virtualY,candidate);
      }else if(edgeY <= TOP_EDGE){
        const penetration = smoothstep((TOP_EDGE-edgeY)/TOP_EDGE);
        const candidate = .5 - DEPTH_SPAN*penetration;
        gesture.virtualY = Math.min(gesture.virtualY,candidate);
      }
    }

    torso.y = gesture.virtualY;
    if(!Array.isArray(copy.grabs) && copy.grabbing && copy.grabPart === 'torso'){
      copy.y = gesture.virtualY;
    }
    return copy;
  }

  function targetScale(depth){
    if(depth >= 0) return clamp(1+depth*1.55,1,2.62);
    return clamp(1+depth*.72,.72,1);
  }

  function targetShift(depth){
    return depth >= 0 ? depth*.235 : depth*.03;
  }

  function tunePoint(point,center,extraScale,extraShift){
    if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;
    return {
      ...point,
      x:center.x+(point.x-center.x)*extraScale,
      y:center.y+(point.y-center.y)*extraScale+extraShift
    };
  }

  function tunePuppet(p){
    const depth = Number.isFinite(p?.depth) ? p.depth : 0;
    if(!p?.torso || Math.abs(depth) < .0001) return p;

    const currentScale = Number.isFinite(p.visualScale) && p.visualScale > 0 ? p.visualScale : 1;
    const desiredScale = targetScale(depth);
    const extraScale = desiredScale/currentScale;
    const baseShift = depth*.035;
    const extraShift = targetShift(depth)-baseShift;
    const center = {x:p.torso.x,y:p.torso.y};
    const out = {...p,visualScale:desiredScale};

    for(const key of ['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']){
      if(out[key]) out[key] = tunePoint(out[key],center,extraScale,extraShift);
    }
    return out;
  }

  function tuneScene(data){
    if(data?.type !== 'scene' || !Array.isArray(data.puppets)) return data;
    return {...data,puppets:data.puppets.map(tunePuppet)};
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
            return handler({...data,input:edgeMappedInput(conn,data.input || {})});
          }
          return handler(data);
        });
      }
      return previousOn(event,handler);
    };

    conn.send = function(data){
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

  window.PuppetalkForegroundTuning = {version:28,topEdge:TOP_EDGE,bottomEdge:BOTTOM_EDGE};
})();
