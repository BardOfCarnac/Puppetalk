(()=>{
  const NativeBlob = window.Blob;
  if(!NativeBlob || window.PuppetalkDeviceProjection) return;

  function patchSource(source){
    if(typeof source !== 'string' || !source.includes('function displayPoint(q,w,h)')) return source;
    let patched = source;

    patched = patched.replace(
      /function displayPoint\(q,w,h\)\{[\s\S]*?\n\}\nfunction displayNorm\(px,py,w,h\)\{[\s\S]*?\n\}\n\nfunction drawBackdrop/,
`var controllerProjection = null;
function sourceStageSize(){
  const source = window.PuppetalkSourceStage;
  const width = Number.isFinite(source?.width) && source.width > 100 ? source.width : 320;
  const height = Number.isFinite(source?.height) && source.height > 100 ? source.height : 360;
  return {width,height};
}
function rebuildControllerProjection(w,h){
  if(mode !== 'controller') return null;
  const source = sourceStageSize();
  const camera = window.PuppetalkSceneCamera?.stageFrame?.(w,h) || null;
  const sceneHasPhoto = camera?.sceneId && camera.sceneId !== 'default';
  const floorY = Number.isFinite(camera?.floorY) ? camera.floorY : h*.88;
  const floorLeft = sceneHasPhoto && Number.isFinite(camera?.floorLeft) ? camera.floorLeft : 0;
  const floorRight = sceneHasPhoto && Number.isFinite(camera?.floorRight) ? camera.floorRight : w;
  const usableW = Math.max(w*.36,floorRight-floorLeft);
  const sourceFloor = .90;
  const topPad = Math.max(4,h*.018);
  const bottomPad = Math.max(4,h*.018);
  const scaleByWidth = usableW/source.width;
  const scaleByTop = Math.max(.35,(floorY-topPad)/(source.height*sourceFloor));
  const scaleByBottom = Math.max(.35,(h-bottomPad-floorY)/(source.height*(1-sourceFloor)));
  const scale = Math.max(.35,Math.min(scaleByWidth,scaleByTop,scaleByBottom));
  const displayW = source.width*scale;
  const displayH = source.height*scale;
  const floorCenter = sceneHasPhoto ? (floorLeft+floorRight)*.5 : w*.5;
  const offsetX = floorCenter-displayW*.5;
  const offsetY = floorY-source.height*sourceFloor*scale;
  controllerProjection = {
    w,h,sourceW:source.width,sourceH:source.height,scale,displayW,displayH,offsetX,offsetY,
    floorY,floorLeft,floorRight,profile:camera?.profile || 'standard',sceneId:camera?.sceneId || 'default'
  };
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
  // Scene points are source-world pixels multiplied by this exact projection scale.
  // Keep all visible body geometry on that same scale so the flat 2.5D puppet never
  // changes proportions between devices.
  if(mode !== 'controller') return 1;
  return projectionFor(w,h)?.scale || 1;
}

function drawBackdrop`
    );

    patched = patched.replace(
      '  const scale = Math.min(w/900,(w*(360/320))/650)*(p.visualScale || 1);',
      '  const scale = projectionRenderScale(w,h)*(p.visualScale || 1);'
    );

    // Visual silhouette only. Joint positions, limb reach, physics and hit areas remain
    // unchanged; these values match the slimmer character preview.
    patched = patched
      .replace('  chain([p.hl,p.kl,p.al],p.color,17);','  chain([p.hl,p.kl,p.al],p.color,11.6);')
      .replace('  chain([p.hr,p.kr,p.ar],p.color,17);','  chain([p.hr,p.kr,p.ar],p.color,11.6);')
      .replace('  chain([p.sl,p.el,p.wl],p.color,15);','  chain([p.sl,p.el,p.wl],p.color,10.2);')
      .replace('  chain([p.sr,p.er,p.wr],p.color,15);','  chain([p.sr,p.er,p.wr],p.color,10.2);')
      .replace('  const tw = Math.max(20,48*scale);','  const tw = Math.max(16,34.5*scale);')
      .replace('  const hr = Math.max(13,26*scale);','  const hr = Math.max(11,22*scale);');

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
  addEventListener('puppetalk-scene-change',settleProjection,{passive:true});
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
  window.PuppetalkDeviceProjection = {version:36};
})();
