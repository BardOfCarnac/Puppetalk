// Keeps body-slice geometry in the same visual depth plane as its puppet.
(()=>{
  const Peer=window.Peer;
  const depth=window.PuppetalkDepthState;
  if(!Peer?.prototype||!depth||window.PuppetalkSliceDepthCompat) return;

  const previousOn=Peer.prototype.on;

  function tunePoint(point,center,scale,shift){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)) return point;
    return {
      ...point,
      x:center.x+(point.x-center.x)*scale,
      y:center.y+(point.y-center.y)*scale+shift
    };
  }
  function tunePieces(data){
    if(data?.type!=='scene'||!Array.isArray(data.puppets)) return data;
    return {
      ...data,
      puppets:data.puppets.map(p=>{
        if(!Array.isArray(p?.pieces)||!p.pieces.length||!p.torso||!Number.isInteger(p.slot)) return p;
        const d=depth.getDepthForSlot(p.slot);
        if(Math.abs(d)<.0001) return p;
        const scale=depth.scaleForDepth(d);
        const shift=depth.shiftForDepth(d);
        const center={x:p.torso.x,y:p.torso.y};
        return {
          ...p,
          pieces:p.pieces.map(piece=>({
            ...piece,
            c:tunePoint(piece.c,center,scale,shift),
            v:Array.isArray(piece.v)?piece.v.map(q=>tunePoint(q,center,scale,shift)):piece.v
          }))
        };
      })
    };
  }
  function patchStageConnection(conn){
    if(!conn||conn.__puppetalkSliceDepthPatched) return conn;
    conn.__puppetalkSliceDepthPatched=true;
    const previousSend=conn.send.bind(conn);
    conn.send=function(data){ return previousSend(tunePieces(data)); };
    return conn;
  }

  Peer.prototype.on=function(event,handler,...rest){
    if(event==='connection'&&typeof handler==='function'){
      return previousOn.call(this,event,conn=>handler(patchStageConnection(conn)),...rest);
    }
    return previousOn.call(this,event,handler,...rest);
  };

  window.PuppetalkSliceDepthCompat={version:1};
})();
