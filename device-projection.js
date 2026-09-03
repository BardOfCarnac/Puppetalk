(()=>{
  const NativeBlob = window.Blob;
  if(!NativeBlob || window.PuppetalkDeviceProjection) return;

  function patchSource(source){
    if(typeof source !== 'string' || !source.includes('function displayPoint(q,w,h)')) return source;
    let patched = source;

    patched = patched.replace(
      /function displayPoint\(q,w,h\)\{[\s\S]*?\n\}\nfunction displayNorm\(px,py,w,h\)\{[\s\S]*?\n\}\n\nfunction drawBackdrop/,
`let controllerProjection = null;
function sourceStageSize(){
  const source = window.PuppetalkSourceStage;
  const width = Number.isFinite(source?.width) && source.width > 100 ? source.width : 320;
  const height = Number.isFinite(source?.height) && source.height > 100 ? source.height : 360;
  return {width,height};
}
function rebuildControllerProjection(w,h){
  if(mode !== 'controller') return null;
  const source = sourceStageSize();
  const scale = Math.min(w/source.width,h/source.height);
  const displayW = source.width*scale;
  const displayH = source.height*scale;
  const floorY = h*.88;
  const offsetX = (w-displayW)*.5;
  const offsetY = floorY-source.height*.90*scale;
  controllerProjection = {w,h,sourceW:source.width,sourceH:source.height,scale,displayW,displayH,offsetX,offsetY};
  return controllerProjection;
}
function projectionFor(w,h){
  return controllerProjection || rebuildControllerProjection(w,h);
}
function displayPoint(q,w,h){
  if(mode !== 'controller') return {x:q.x*w,y:q.y*h};
  const p = projectionFor(w,h);
  return {x:p.offsetX+q.x*p.sourceW*p.scale,y:p.offsetY+q.y*p.sourceH*p.scale};
}
function displayNorm(px,py,w,h){
  if(mode !== 'controller') return {x:px/w,y:py/h};
  const p = projectionFor(w,h);
  return {x:(px-p.offsetX)/(p.sourceW*p.scale),y:(py-p.offsetY)/(p.sourceH*p.scale)};
}
function projectionRenderScale(w,h){
  if(mode !== 'controller') return Math.min(w/900,h/650);
  const p = projectionFor(w,h);
  return Math.min(w/900,p.displayH/650);
}

function drawBackdrop`
    );

    patched = patched.replace(
      '  const scale = Math.min(w/900,(w*(360/320))/650)*(p.visualScale || 1);',
      '  const scale = projectionRenderScale(w,h)*(p.visualScale || 1);'
    );

    patched = patched.replace(
      '    ch = Math.max(320,stageBox.getBoundingClientRect().height || innerHeight);\n    const dpr = Math.min(devicePixelRatio || 1,2);',
      '    ch = Math.max(320,stageBox.getBoundingClientRect().height || innerHeight);\n    controllerProjection = null;\n    rebuildControllerProjection(cw,ch);\n    const dpr = Math.min(devicePixelRatio || 1,2);'
    );

    patched = patched.replace(
`  addEventListener('resize',resizeCanvas,{passive:true});
  resizeCanvas();
  connect();`,
`  const settleProjection = ()=>{
    controllerProjection = null;
    resizeCanvas();
  };
  addEventListener('resize',settleProjection,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(settleProjection,90),{passive:true});
  addEventListener('puppetalk-stage-viewport',settleProjection,{passive:true});
  window.visualViewport?.addEventListener('resize',settleProjection,{passive:true});
  resizeCanvas();
  requestAnimationFrame(()=>requestAnimationFrame(settleProjection));
  setTimeout(settleProjection,160);
  connect();`
    );

    return patched;
  }

  function DeviceProjectionBlob(parts=[],options={}){
    let nextParts = parts;
    if(options?.type === 'text/javascript' && parts.length === 1 && typeof parts[0] === 'string'){
      const patched = patchSource(parts[0]);
      if(patched !== parts[0]) nextParts = [patched];
    }
    return new NativeBlob(nextParts,options);
  }

  DeviceProjectionBlob.prototype = NativeBlob.prototype;
  Object.setPrototypeOf(DeviceProjectionBlob,NativeBlob);
  window.Blob = DeviceProjectionBlob;
  window.PuppetalkDeviceProjection = {version:32};
})();
