(function(root){
  'use strict';

  const camera=root.PuppetalkSceneCamera;
  if(!camera || camera.__puppetalkLandscapeFrameInstalled) return;
  if(typeof camera.frameFor!=='function' || typeof camera.cropFor!=='function' || typeof camera.drawBackdrop!=='function') return;

  const originalFrameFor=camera.frameFor.bind(camera);
  const originalDrawBackdrop=camera.drawBackdrop.bind(camera);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const valueOr=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;

  // Very-wide phone screens were forcing the photograph to crop away most of
  // its vertical content. Treat landscape as a full-height 16:10-ish stage and
  // use the surplus width as peripheral/control space instead.
  function sceneRectFor(width,height,profile){
    const w=Math.max(1,width);
    const h=Math.max(1,height);
    if(profile!=='wide') return {x:0,y:0,width:w,height:h,constrained:false};
    const maxAspect=1.60;
    const sceneWidth=Math.min(w,h*maxAspect);
    return {
      x:(w-sceneWidth)*.5,
      y:0,
      width:sceneWidth,
      height:h,
      constrained:sceneWidth<w-1
    };
  }

  function frameFor(width,height){
    const base=originalFrameFor(width,height);
    const rect=sceneRectFor(width,height,base?.profile);
    if(!rect.constrained || !base?.imageReady || !base.image){
      return {...base,sceneRect:rect};
    }

    const crop=camera.cropFor(base.scene,base.image,rect.width,rect.height);
    const floor=base.scene?.floor||{};
    const mapY=norm=>rect.y+((clamp(norm,0,1)*crop.ih-crop.sy)/crop.sh)*rect.height;
    const mapX=norm=>rect.x+((clamp(norm,0,1)*crop.iw-crop.sx)/crop.sw)*rect.width;
    const baselineY=clamp(mapY(valueOr(floor.baseline,.88)),rect.y+rect.height*.76,rect.y+rect.height*.94);
    const horizonY=clamp(mapY(valueOr(floor.horizon,.66)),rect.y+rect.height*.18,baselineY-rect.height*.08);

    return {
      ...base,
      ...crop,
      width,
      height,
      sceneRect:rect,
      baselineY,
      horizonY,
      floorLeft:clamp(mapX(valueOr(floor.left,.04)),rect.x,rect.x+rect.width),
      floorRight:clamp(mapX(valueOr(floor.right,.96)),rect.x,rect.x+rect.width),
      imageReady:true,
      image:base.image
    };
  }

  function drawBackdrop(ctx,width,height){
    const frame=frameFor(width,height);
    if(!frame?.imageReady || !frame.image) return originalDrawBackdrop(ctx,width,height);
    const rect=frame.sceneRect;
    if(!rect?.constrained) return originalDrawBackdrop(ctx,width,height);

    // Keep the outer landscape gutters visually related to the room, but make
    // the central full-height scene unmistakably the active photographic stage.
    const surround=originalFrameFor(width,height);
    ctx.clearRect(0,0,width,height);
    if(surround?.imageReady && surround.image){
      ctx.save();
      ctx.globalAlpha=.58;
      try{ctx.filter='blur(12px) brightness(.58)';}catch{}
      ctx.drawImage(surround.image,surround.sx,surround.sy,surround.sw,surround.sh,-12,-12,width+24,height+24);
      ctx.restore();
      ctx.save();
      ctx.fillStyle='rgba(5,6,8,.22)';
      ctx.fillRect(0,0,width,height);
      ctx.restore();
    }else{
      ctx.fillStyle='#0b0c0e';
      ctx.fillRect(0,0,width,height);
    }

    ctx.drawImage(
      frame.image,
      frame.sx,frame.sy,frame.sw,frame.sh,
      rect.x,rect.y,rect.width,rect.height
    );
    return true;
  }

  function stageFrame(width,height){
    const frame=frameFor(width,height);
    return {
      profile:frame.profile,
      floorY:frame.baselineY,
      horizonY:frame.horizonY,
      floorLeft:frame.floorLeft,
      floorRight:frame.floorRight,
      sceneId:frame.scene?.id||'default',
      sceneRect:frame.sceneRect
    };
  }

  camera.frameFor=frameFor;
  camera.drawBackdrop=drawBackdrop;
  camera.stageFrame=stageFrame;
  camera.__puppetalkLandscapeFrameInstalled=true;

  root.PuppetalkLandscapeSceneFrame={sceneRectFor,frameFor,stageFrame};
})(typeof window!=='undefined'?window:globalThis);
