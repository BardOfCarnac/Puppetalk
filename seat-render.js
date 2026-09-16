// Puppetalk six-seat shared-floor view pass.
// Physics/network state stays canonical. Each player's lateral position and seven
// depth stages describe one shared 2D floor; controllers rotate that floor into
// their own seat frame for drawing and hit-testing.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_SEGMENTED_PUPPET_V1') || source.includes('PUPPETALK_SEAT_RENDER_V1')) return source;
    source = source.replace(
      '  // PUPPETALK_SEGMENTED_PUPPET_V1',
      '  // PUPPETALK_SEGMENTED_PUPPET_V1\n  // PUPPETALK_SEAT_RENDER_V1'
    );

    const controllerNeedle = `function startController(room){`;
    const helpers = `const PUPPETALK_SEAT_ORDER = [0,3,1,4,2,5];
const PUPPETALK_DEPTH_HALF_SPAN = 1/Math.sqrt(3);
const PUPPETALK_FOREGROUND_TUNED_KEYS = new Set(['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']);
const puppetalkPropOwners = new Map();

function puppetalkSeatAngle(slot){
  const seat=PUPPETALK_SEAT_ORDER[slot] ?? slot ?? 0;
  return seat*Math.PI/3;
}
function puppetalkHomeX(slot){ return .5; }
function puppetalkDepthPlanes(){
  const planes=window.PuppetalkForegroundTuning?.planes;
  return Array.isArray(planes) && planes.length>1 ? planes : [-.48,-.32,-.16,0,.33,.66,1];
}
function puppetalkDepthToFloor(depth){
  const planes=puppetalkDepthPlanes();
  const last=planes.length-1;
  if(depth<=planes[0]) return -PUPPETALK_DEPTH_HALF_SPAN;
  if(depth>=planes[last]) return PUPPETALK_DEPTH_HALF_SPAN;
  let i=0;
  while(i<last-1 && depth>planes[i+1]) i++;
  const a=planes[i],b=planes[i+1];
  const mix=Math.abs(b-a)>.000001 ? (depth-a)/(b-a) : 0;
  const index=i+Math.max(0,Math.min(1,mix));
  return ((index/last)*2-1)*PUPPETALK_DEPTH_HALF_SPAN;
}
function puppetalkFloorToDepth(forward){
  const planes=puppetalkDepthPlanes();
  const last=planes.length-1;
  const norm=Math.max(0,Math.min(1,(forward+PUPPETALK_DEPTH_HALF_SPAN)/(PUPPETALK_DEPTH_HALF_SPAN*2)));
  const index=norm*last;
  const i=Math.min(last-1,Math.floor(index));
  const mix=index-i;
  return planes[i]+(planes[i+1]-planes[i])*mix;
}
function puppetalkRawPoint(point,center,scale,shift){
  if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;
  const safe=Math.max(.0001,scale||1);
  return {...point,x:center.x+(point.x-center.x)/safe,y:center.y+(point.y-shift-center.y)/safe};
}
function puppetalkViewPoint(point,rawCenter,targetCenter,targetScale,targetShift){
  if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;
  return {...point,x:targetCenter.x+(point.x-rawCenter.x)*targetScale,y:rawCenter.y+(point.y-rawCenter.y)*targetScale+targetShift};
}
function puppetalkProjectPuppet(p,viewerSlot){
  if(!p?.torso || !Number.isInteger(p.slot) || !Number.isInteger(viewerSlot)) return {puppet:p,meta:null};
  const depthApi=window.PuppetalkDepthState;
  const rawDepth=Number.isFinite(p.depth)?p.depth:0;
  const rawScale=Number.isFinite(p.visualScale)?p.visualScale:(depthApi?.scaleForDepth?.(rawDepth)||1);
  const rawShift=depthApi?.shiftForDepth?.(rawDepth)||0;
  const rawCenter={x:p.torso.x,y:p.torso.y-rawShift};
  let delta=puppetalkSeatAngle(p.slot)-puppetalkSeatAngle(viewerSlot);
  while(delta>Math.PI) delta-=Math.PI*2;
  while(delta< -Math.PI) delta+=Math.PI*2;
  const c=Math.cos(delta),s=Math.sin(delta);

  // Shared floor coordinates. A player's normal screen X is their lateral floor
  // coordinate; the seven depth stages are seven equally spaced cross-stage planes.
  const localSide=rawCenter.x-.5;
  const localForward=puppetalkDepthToFloor(rawDepth);
  const viewSide=localSide*c+localForward*s;
  const viewForward=localForward*c-localSide*s;
  const viewDepth=puppetalkFloorToDepth(viewForward);
  const targetScale=depthApi?.scaleForDepth?.(viewDepth)||1;
  const targetShift=depthApi?.shiftForDepth?.(viewDepth)||0;
  const targetCenter={x:.5+viewSide,y:rawCenter.y};
  const out={...p,depth:viewDepth,visualScale:targetScale};
  for(const [key,value] of Object.entries(p)){
    if(!value || Array.isArray(value) || typeof value!=='object') continue;
    if(!Number.isFinite(value.x) || !Number.isFinite(value.y)) continue;
    // foreground-tuning v36 only projects the original visible points. New seam
    // endpoints/segment centres arrive raw, so do not "undo" a transform they never had.
    const raw=PUPPETALK_FOREGROUND_TUNED_KEYS.has(key)
      ? puppetalkRawPoint(value,rawCenter,rawScale,rawShift)
      : value;
    out[key]=puppetalkViewPoint(raw,rawCenter,targetCenter,targetScale,targetShift);
  }
  return {puppet:out,meta:{slot:p.slot,rawCenter,targetCenter,targetScale,targetShift}};
}
function puppetalkProjectProp(prop,metaBySlot){
  if(!prop || !Number.isFinite(prop.x) || !Number.isFinite(prop.y)) return prop;
  const explicit=Number.isInteger(prop?.heldBy?.slot)?prop.heldBy.slot:Number.isInteger(prop?.attachedTo?.slot)?prop.attachedTo.slot:null;
  if(Number.isInteger(explicit)) puppetalkPropOwners.set(prop.id,explicit);
  const owner=Number.isInteger(explicit)?explicit:puppetalkPropOwners.get(prop.id);
  const meta=metaBySlot.get(owner);
  if(!meta) return prop;
  const project=q=>puppetalkViewPoint(q,meta.rawCenter,meta.targetCenter,meta.targetScale,meta.targetShift);
  const out={...prop,...project(prop)};
  if(prop.attachedTo?.anchor && Number.isFinite(prop.attachedTo.anchor.x) && Number.isFinite(prop.attachedTo.anchor.y)){
    out.attachedTo={...prop.attachedTo,anchor:project(prop.attachedTo.anchor)};
  }
  return out;
}
function puppetalkSeatProjection(puppets,props,viewerSlot){
  if(!Number.isInteger(viewerSlot)) return {puppets,props};
  const metaBySlot=new Map();
  const projected=(puppets||[]).map(p=>{
    const r=puppetalkProjectPuppet(p,viewerSlot);
    if(r.meta) metaBySlot.set(r.meta.slot,r.meta);
    return r.puppet;
  }).sort((a,b)=>(a.depth||0)-(b.depth||0));
  return {puppets:projected,props:(props||[]).map(prop=>puppetalkProjectProp(prop,metaBySlot))};
}

${controllerNeedle}`;
    if(!source.includes(controllerNeedle)) throw new Error('Seat render patch failed: controller hook');
    source = source.replace(controllerNeedle,helpers);

    const renderNeedle = `  function renderPersonalScene(){
    drawBackdrop(ctx,cw,ch);
    propScene.forEach(prop=>drawProp(ctx,prop,cw,ch));
    if(!scene.length) return;
    scene.filter(p=>p.slot !== slot).forEach(p=>drawAnatomy(ctx,p,cw,ch,false,.48));
    const mine = myPuppet();
    if(mine){
      drawAnatomy(ctx,mine,cw,ch,true,1);
      renderGrabHandles(mine);
    }
  }`;
    const renderCode = `  function renderPersonalScene(){
    drawBackdrop(ctx,cw,ch);
    const view=puppetalkSeatProjection(scene,propScene,slot);
    view.props.forEach(prop=>drawProp(ctx,prop,cw,ch));
    if(!view.puppets.length) return;
    view.puppets.filter(p=>p.slot !== slot).forEach(p=>drawAnatomy(ctx,p,cw,ch,false,.48));
    const mine = view.puppets.find(p=>p.slot === slot);
    if(mine){
      drawAnatomy(ctx,mine,cw,ch,true,1);
      renderGrabHandles(mine);
    }
  }`;
    if(!source.includes(renderNeedle)) throw new Error('Seat render patch failed: controller renderer');
    source = source.replace(renderNeedle,renderCode);

    const propLoopNeedle = `    for(const prop of propScene){`;
    const propLoopCode = `    const viewProps=puppetalkSeatProjection(scene,propScene,slot).props;
    for(const prop of viewProps){`;
    if(!source.includes(propLoopNeedle)) throw new Error('Seat render patch failed: prop hit testing');
    source = source.replace(propLoopNeedle,propLoopCode);

    return source;
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
