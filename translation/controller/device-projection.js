(function(root){
  'use strict';

  function create(options={}){
    const {
      getMode=()=> 'controller',
      getSourceStage=()=>root.PuppetalkSourceStage,
      getSceneCamera=()=>root.PuppetalkSceneCamera
    }=options;

    function sourceStageSize(){
      const source=getSourceStage();
      const width=Number.isFinite(source?.width)&&source.width>100?source.width:320;
      const height=Number.isFinite(source?.height)&&source.height>100?source.height:360;
      return {width,height};
    }

    function rebuildControllerProjection(w,h){
      if(getMode()!=='controller') return null;
      const source=sourceStageSize();
      const camera=getSceneCamera()?.stageFrame?.(w,h)||null;
      const sceneHasPhoto=!!(camera?.sceneId&&camera.sceneId!=='default');
      const floorY=Number.isFinite(camera?.floorY)?camera.floorY:h*.88;
      const floorLeft=sceneHasPhoto&&Number.isFinite(camera?.floorLeft)?camera.floorLeft:0;
      const floorRight=sceneHasPhoto&&Number.isFinite(camera?.floorRight)?camera.floorRight:w;
      const usableW=Math.max(w*.36,floorRight-floorLeft);
      const sourceFloor=.90;
      const topPad=Math.max(4,h*.018);
      const bottomPad=Math.max(4,h*.018);
      const scaleByWidth=usableW/source.width;
      const scaleByTop=Math.max(.35,(floorY-topPad)/(source.height*sourceFloor));
      const scaleByBottom=Math.max(.35,(h-bottomPad-floorY)/(source.height*(1-sourceFloor)));
      const scale=Math.max(.35,Math.min(scaleByWidth,scaleByTop,scaleByBottom));
      const displayW=source.width*scale;
      const displayH=source.height*scale;
      const floorCenter=sceneHasPhoto?(floorLeft+floorRight)*.5:w*.5;
      const offsetX=floorCenter-displayW*.5;
      const offsetY=floorY-source.height*sourceFloor*scale;
      return {
        w,h,sourceW:source.width,sourceH:source.height,scale,displayW,displayH,offsetX,offsetY,
        floorY,floorLeft,floorRight,profile:camera?.profile||'standard',sceneId:camera?.sceneId||'default'
      };
    }

    // V1 cached this value and invalidated it on viewport/scene events. Recomputing the
    // same formula on demand is deliberately equivalent and avoids stale projection
    // state while the translated modules are being separated from the old Blob patch.
    function projectionFor(w,h){
      return rebuildControllerProjection(w,h);
    }

    function displayPoint(q,w,h){
      if(getMode()!=='controller') return {x:q.x*w,y:q.y*h};
      const p=projectionFor(w,h);
      return {x:p.offsetX+q.x*p.sourceW*p.scale,y:p.offsetY+q.y*p.sourceH*p.scale};
    }

    function displayNorm(px,py,w,h){
      if(getMode()!=='controller') return {x:px/w,y:py/h};
      const p=projectionFor(w,h);
      return {x:(px-p.offsetX)/(p.sourceW*p.scale),y:(py-p.offsetY)/(p.sourceH*p.scale)};
    }

    function projectionRenderScale(w,h){
      if(getMode()!=='controller') return 1;
      return projectionFor(w,h)?.scale||1;
    }

    return {sourceStageSize,rebuildControllerProjection,projectionFor,displayPoint,displayNorm,projectionRenderScale};
  }

  function currentMode(){
    try{
      const Params=root.URLSearchParams||URLSearchParams;
      return new Params(root.location?.search||'').get('mode')==='controller'?'controller':'stage';
    }catch{
      return 'stage';
    }
  }

  const defaultProjection=create({getMode:currentMode});
  root.PuppetalkControllerProjection={create,defaultProjection};

  // Compatibility bridge for translated pieces that still consume the effective
  // V1 runtime names. device-projection.js created these as local app functions;
  // the translation exposes the same behaviour until every consumer is explicit.
  root.displayPoint=defaultProjection.displayPoint;
  root.displayNorm=defaultProjection.displayNorm;
  root.projectionRenderScale=defaultProjection.projectionRenderScale;
})(typeof window!=='undefined'?window:globalThis);
