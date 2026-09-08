(function(root){
  'use strict';

  function create(options={}){
    const {
      getMode=()=> 'controller',
      getSourceStage=()=>root.PuppetalkSourceStage,
      getSceneCamera=()=>root.PuppetalkSceneCamera
    }=options;

    let controllerProjection=null;
    let sceneBounds=null;
    let sceneSignature='';

    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

    function sourceStageSize(){
      const source=getSourceStage();
      const width=Number.isFinite(source?.width)&&source.width>100?source.width:320;
      const height=Number.isFinite(source?.height)&&source.height>100?source.height:360;
      return {width,height};
    }

    function invalidateControllerProjection(){
      controllerProjection=null;
    }

    function boundsForPuppets(puppets,source=sourceStageSize()){
      const xs=[];
      const ys=[];
      for(const puppet of Array.isArray(puppets)?puppets:[]){
        for(const value of Object.values(puppet||{})){
          if(!value || Array.isArray(value) || typeof value!=='object') continue;
          if(Number.isFinite(value.x) && Number.isFinite(value.y)){
            xs.push(value.x);
            ys.push(value.y);
          }
        }
      }
      if(!xs.length||!ys.length) return null;
      const marginX=58/Math.max(1,source.width);
      const marginY=42/Math.max(1,source.height);
      return {
        minX:Math.min(...xs)-marginX,
        maxX:Math.max(...xs)+marginX,
        minY:Math.min(...ys)-marginY,
        maxY:Math.max(...ys)+marginY
      };
    }

    function signatureFor(puppets){
      return (Array.isArray(puppets)?puppets:[])
        .map(p=>Number.isInteger(p?.slot)?p.slot:null)
        .filter(Number.isInteger)
        .sort((a,b)=>a-b)
        .join(',');
    }

    function observeScene(puppets){
      const signature=signatureFor(puppets);
      if(signature===sceneSignature && sceneBounds) return false;
      sceneSignature=signature;
      sceneBounds=boundsForPuppets(puppets);
      controllerProjection=null;
      return true;
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
      const topPad=Math.max(8,h*.025);
      const bottomPad=Math.max(8,h*.025);
      const floorCenter=sceneHasPhoto?(floorLeft+floorRight)*.5:w*.5;

      let scale;
      let offsetX;
      const bounds=sceneBounds;
      if(bounds){
        // The old projection fitted the entire host viewport into every controller.
        // A landscape host therefore made the puppets tiny on every invited phone,
        // and a narrow controller could still place a newly projected seat offscreen.
        // Frame the actual ensemble instead. One or two puppets stay at a comfortable
        // near-1:1 scale; only a genuinely spread-out group makes the view zoom out.
        const sceneW=Math.max(120,(bounds.maxX-bounds.minX)*source.width);
        const sceneCenterX=(bounds.minX+bounds.maxX)*.5*source.width;
        const fitX=Math.max(.35,(usableW-Math.max(20,w*.05))/sceneW);

        const above=Math.max(70,(sourceFloor-bounds.minY)*source.height);
        const below=Math.max(1,(bounds.maxY-sourceFloor)*source.height);
        const fitTop=Math.max(.35,(floorY-topPad)/above);
        const fitBottom=below>1?Math.max(.35,(h-bottomPad-floorY)/below):99;
        const comfortableScale=1.12;
        scale=Math.max(.35,Math.min(comfortableScale,fitX,fitTop,fitBottom));
        offsetX=floorCenter-sceneCenterX*scale;
      }else{
        // Before the first scene arrives, retain the conservative whole-stage fit.
        const scaleByWidth=usableW/source.width;
        const scaleByTop=Math.max(.35,(floorY-topPad)/(source.height*sourceFloor));
        const scaleByBottom=Math.max(.35,(h-bottomPad-floorY)/(source.height*(1-sourceFloor)));
        scale=Math.max(.35,Math.min(scaleByWidth,scaleByTop,scaleByBottom));
        const displayW=source.width*scale;
        offsetX=floorCenter-displayW*.5;
      }

      const displayW=source.width*scale;
      const displayH=source.height*scale;
      const offsetY=floorY-source.height*sourceFloor*scale;
      controllerProjection={
        w,h,sourceW:source.width,sourceH:source.height,scale,displayW,displayH,offsetX,offsetY,
        floorY,floorLeft,floorRight,profile:camera?.profile||'standard',sceneId:camera?.sceneId||'default',
        ensembleBounds:bounds?{...bounds}:null
      };
      return controllerProjection;
    }

    function projectionFor(w,h){
      return controllerProjection||rebuildControllerProjection(w,h);
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

    return {
      sourceStageSize,invalidateControllerProjection,rebuildControllerProjection,
      projectionFor,displayPoint,displayNorm,projectionRenderScale,
      boundsForPuppets,observeScene,getSceneBounds:()=>sceneBounds
    };
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
