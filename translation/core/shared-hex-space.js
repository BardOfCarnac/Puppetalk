(function(root){
  'use strict';

  const TAU=Math.PI*2;
  const EPS=1e-7;
  const LEVELS=Object.freeze([-1,-.5,-.25,0,.25,.5,1]);
  const SEAT_ORDER=Object.freeze([0,3,1,4,2,5]);
  const VERTICES=Object.freeze(Array.from({length:6},(_,i)=>{
    const a=i*Math.PI/3;
    return Object.freeze({x:Math.cos(a),y:Math.sin(a)});
  }));

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dot=(a,b)=>a.x*b.x+a.y*b.y;
  const dist2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;

  function seatIndex(slot){
    return Number.isInteger(slot) ? (SEAT_ORDER[slot] ?? slot) : 0;
  }

  function seatAngle(slot){ return seatIndex(slot)*Math.PI/3; }

  function basis(slot){
    const a=seatAngle(slot);
    const d={x:Math.cos(a),y:Math.sin(a)};
    return {d,r:{x:-d.y,y:d.x}};
  }

  function projectWorld(point,viewerSlot){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)) return {x:0,z:0};
    const {d,r}=basis(viewerSlot);
    return {x:dot(point,r),z:dot(point,d)};
  }

  function unprojectView(side,depth,viewerSlot){
    const {d,r}=basis(viewerSlot);
    return {x:r.x*side+d.x*depth,y:r.y*side+d.y*depth};
  }

  function insideHex(point){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)) return false;
    for(let i=0;i<6;i++){
      const a=VERTICES[i],b=VERTICES[(i+1)%6];
      const cross=(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x);
      if(cross<-EPS) return false;
    }
    return true;
  }

  function nearestPointOnSegment(point,a,b){
    const vx=b.x-a.x,vy=b.y-a.y;
    const d=vx*vx+vy*vy;
    if(d<EPS) return {x:a.x,y:a.y};
    const t=clamp(((point.x-a.x)*vx+(point.y-a.y)*vy)/d,0,1);
    return {x:a.x+vx*t,y:a.y+vy*t};
  }

  function clampToHex(point){
    if(insideHex(point)) return {x:point.x,y:point.y};
    let best={x:VERTICES[0].x,y:VERTICES[0].y},bestD=Infinity;
    for(let i=0;i<6;i++){
      const q=nearestPointOnSegment(point,VERTICES[i],VERTICES[(i+1)%6]);
      const d=dist2(point,q);
      if(d<bestD){bestD=d;best=q;}
    }
    return best;
  }

  function rangeAt(viewerSlot,depth){
    const z=clamp(Number(depth)||0,-1,1);
    const xs=[];
    for(let i=0;i<6;i++){
      const a=projectWorld(VERTICES[i],viewerSlot);
      const b=projectWorld(VERTICES[(i+1)%6],viewerSlot);
      if(Math.abs(a.z-z)<EPS) xs.push(a.x);
      if(Math.abs(b.z-z)<EPS) xs.push(b.x);
      if((z-a.z)*(z-b.z)<-EPS){
        const t=(z-a.z)/(b.z-a.z);
        xs.push(a.x+(b.x-a.x)*t);
      }
    }
    if(!xs.length) return {min:0,max:0,width:0};
    const min=Math.min(...xs),max=Math.max(...xs);
    return {min,max,width:max-min};
  }

  function worldFromView(screenX,depth,viewerSlot){
    const z=clamp(Number(depth)||0,-1,1);
    const range=rangeAt(viewerSlot,z);
    const n=clamp(Number(screenX)||0,0,1);
    const side=range.width>EPS ? range.min+range.width*n : 0;
    return clampToHex(unprojectView(side,z,viewerSlot));
  }

  function screenXFromWorld(point,viewerSlot){
    const q=projectWorld(point,viewerSlot);
    const range=rangeAt(viewerSlot,q.z);
    if(range.width<EPS) return .5;
    return clamp((q.x-range.min)/range.width,0,1);
  }

  function viewFromWorld(point,viewerSlot){
    const q=projectWorld(point,viewerSlot);
    return {screenX:screenXFromWorld(point,viewerSlot),side:q.x,depth:q.z};
  }

  function worldVelocityFromView(lateral,depth,viewerSlot){
    const {d,r}=basis(viewerSlot);
    return {x:r.x*lateral+d.x*depth,y:r.y*lateral+d.y*depth};
  }

  function viewVelocityFromWorld(velocity,viewerSlot){
    const {d,r}=basis(viewerSlot);
    return {lateral:dot(velocity,r),depth:dot(velocity,d)};
  }

  function nearestPlaneIndex(depth){
    let best=0,bestD=Infinity;
    LEVELS.forEach((value,index)=>{
      const d=Math.abs(depth-value);
      if(d<bestD){bestD=d;best=index;}
    });
    return best;
  }

  function nearestPlane(depth){ return LEVELS[nearestPlaneIndex(depth)]; }

  function segmentIntersection(a,b,c,d){
    const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y;
    const den=rx*sy-ry*sx;
    if(Math.abs(den)<EPS) return null;
    const qx=c.x-a.x,qy=c.y-a.y;
    const t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;
    if(t<-EPS||t>1+EPS||u<-EPS||u>1+EPS) return null;
    return {x:a.x+t*rx,y:a.y+t*ry};
  }

  function crossingNodes(){
    const pairs=[];
    for(let i=0;i<6;i++) for(let j=i+1;j<6;j++) pairs.push([i,j]);
    const nodes=VERTICES.map(p=>({x:p.x,y:p.y}));
    for(let i=0;i<pairs.length;i++) for(let j=i+1;j<pairs.length;j++){
      const p=segmentIntersection(
        VERTICES[pairs[i][0]],VERTICES[pairs[i][1]],
        VERTICES[pairs[j][0]],VERTICES[pairs[j][1]]
      );
      if(p&&!nodes.some(q=>dist2(p,q)<1e-10)) nodes.push(p);
    }
    return nodes;
  }

  const NODES=Object.freeze(crossingNodes().map(p=>Object.freeze(p)));

  function nearestNode(point){
    let best=NODES[0],bestD=Infinity;
    for(const node of NODES){
      const d=dist2(point,node);
      if(d<bestD){bestD=d;best=node;}
    }
    return {x:best.x,y:best.y};
  }

  root.PuppetalkSharedHex=Object.freeze({
    LEVELS,SEAT_ORDER,VERTICES,NODES,EPS,
    seatIndex,seatAngle,basis,projectWorld,unprojectView,
    insideHex,clampToHex,rangeAt,worldFromView,screenXFromWorld,viewFromWorld,
    worldVelocityFromView,viewVelocityFromWorld,nearestPlaneIndex,nearestPlane,nearestNode
  });
})(typeof window!=='undefined'?window:globalThis);
