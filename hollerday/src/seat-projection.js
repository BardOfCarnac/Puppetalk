import { WORLD } from "./config.js";

const SEAT_ORDER=[0,3,1,4,2,5];
const DEPTH_X=.28;
const MIN_DEPTH=-.48;
const MAX_DEPTH=1;
const SPAWN_X=[500,360,640,240,760,120,880];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function seatAngle(seat){const ordered=SEAT_ORDER[seat]??seat??0;return ordered*Math.PI/3;}
function homeX(seat){return SPAWN_X[seat%SPAWN_X.length]??500;}
function normalizeAngle(value){while(value>Math.PI)value-=Math.PI*2;while(value< -Math.PI)value+=Math.PI*2;return value;}

function projectCoordinates(x,depth,seat,viewerSeat){
  if(!Number.isFinite(seat)||!Number.isFinite(viewerSeat)||seat===viewerSeat)return{x,depth};
  const delta=normalizeAngle(seatAngle(seat)-seatAngle(viewerSeat));
  const c=Math.cos(delta),s=Math.sin(delta);
  const localSide=(x-homeX(seat))/WORLD.width;
  const localForward=(Number(depth)||0)*DEPTH_X;
  const viewSide=localSide*c+localForward*s;
  const viewForward=localForward*c-localSide*s;
  return{x:homeX(seat)+viewSide*WORLD.width,depth:clamp(viewForward/DEPTH_X,MIN_DEPTH,MAX_DEPTH)};
}

export function projectSnapshotForViewer(snapshot,viewerPuppetId){
  if(!snapshot?.puppets?.length||!viewerPuppetId)return snapshot;
  const viewerSeat=snapshot.puppets.findIndex(puppet=>puppet.id===viewerPuppetId);
  if(viewerSeat<0)return snapshot;
  const ownerSeat=new Map(snapshot.puppets.map((puppet,index)=>[puppet.ownerPlayerId,index]));

  const puppets=snapshot.puppets.map((puppet,seat)=>{
    if(seat===viewerSeat)return puppet;
    const torso=puppet.parts?.torso;
    if(!torso)return puppet;
    const projected=projectCoordinates(torso.x,puppet.behaviour?.depth,seat,viewerSeat);
    const dx=projected.x-torso.x;
    const parts={};
    for(const [name,state] of Object.entries(puppet.parts||{}))parts[name]={...state,x:state.x+dx};
    return{...puppet,parts,behaviour:{...puppet.behaviour,depth:projected.depth},viewSeat:seat};
  });

  const props=(snapshot.props||[]).map(prop=>{
    const owner=ownerSeat.get(prop.heldBy?.playerId||prop.ownerPlayerId);
    if(!Number.isFinite(owner)||owner===viewerSeat)return prop;
    const projected=projectCoordinates(prop.x,prop.depth,owner,viewerSeat);
    return{...prop,x:projected.x,depth:projected.depth};
  });

  return{...snapshot,puppets,props,viewerSeat};
}
