(()=>{
  if(window.PuppetalkSceneCamera) return;

  const NativeBlob = window.Blob;
  const scenes = new Map();
  const images = new Map();
  let activeId = 'default';
  let lastFrame = null;

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  const FALLBACK_SCENE = {
    id:'default',
    label:'Default stage',
    floor:{horizon:.66,baseline:.88,left:.04,right:.96},
    crops:{
      tall:{focusX:.5,focusY:.62,zoom:1},
      standard:{focusX:.5,focusY:.60,zoom:1},
      wide:{focusX:.5,focusY:.58,zoom:1}
    },
    supports:['tall','standard','wide']
  };
  scenes.set(FALLBACK_SCENE.id,FALLBACK_SCENE);

  function profileFor(width,height){
    const aspect=Math.max(1,width)/Math.max(1,height);
    if(aspect < .78) return 'tall';
    if(aspect > 1.42) return 'wide';
    return 'standard';
  }

  function normalizeScene(input){
    if(!input || !input.id) return null;
    const floor=input.floor || {};
    return {
      ...FALLBACK_SCENE,
      ...input,
      id:String(input.id),
      floor:{...FALLBACK_SCENE.floor,...floor},
      crops:{...FALLBACK_SCENE.crops,...(input.crops||{})},
      supports:Array.isArray(input.supports)&&input.supports.length
        ? [...input.supports]
        : [...FALLBACK_SCENE.supports]
    };
  }

  function registerScene(input){
    const scene=normalizeScene(input);
    if(!scene) return null;
    scenes.set(scene.id,scene);
    return scene;
  }

  function registerScenes(list){
    if(!Array.isArray(list)) return [];
    return list.map(registerScene).filter(Boolean);
  }

  function activeScene(){
    return scenes.get(activeId) || FALLBACK_SCENE;
  }

  function setScene(idOrScene){
    if(idOrScene && typeof idOrScene === 'object'){
      const scene=registerScene(idOrScene);
      if(scene) activeId=scene.id;
    }else if(scenes.has(String(idOrScene))){
      activeId=String(idOrScene);
    }else{
      activeId='default';
    }
    lastFrame=null;
    window.dispatchEvent(new CustomEvent('puppetalk-scene-change',{detail:{scene:activeScene()}}));
    window.dispatchEvent(new Event('resize'));
    return activeScene();
  }

  function imageFor(scene){
    if(!scene?.image) return null;
    if(images.has(scene.id)) return images.get(scene.id);
    const image=new Image();
    const state={image,ready:false,error:false};
    image.decoding='async';
    image.onload=()=>{
      state.ready=true;
      lastFrame=null;
      window.dispatchEvent(new Event('resize'));
    };
    image.onerror=()=>{state.error=true;};
    image.src=scene.image;
    images.set(scene.id,state);
    return state;
  }

  function cropFor(scene,image,width,height){
    const profile=profileFor(width,height);
    const preset={...FALLBACK_SCENE.crops[profile],...(scene?.crops?.[profile]||{})};
    const iw=Math.max(1,image.naturalWidth||image.width||1);
    const ih=Math.max(1,image.naturalHeight||image.height||1);
    const viewAspect=Math.max(1,width)/Math.max(1,height);
    const imageAspect=iw/ih;
    let sw=iw;
    let sh=ih;

    if(imageAspect > viewAspect) sw=ih*viewAspect;
    else sh=iw/viewAspect;

    const zoom=clamp(Number(preset.zoom)||1,1,2.4);
    sw/=zoom;
    sh/=zoom;

    const fx=clamp(Number(preset.focusX),0,1);
    const fy=clamp(Number(preset.focusY),0,1);
    let sx=fx*iw-sw*.5;
    let sy=fy*ih-sh*.5;
    sx=clamp(sx,0,Math.max(0,iw-sw));
    sy=clamp(sy,0,Math.max(0,ih-sh));

    return {profile,iw,ih,sx,sy,sw,sh,width,height};
  }

  function frameFor(width,height){
    const scene=activeScene();
    const profile=profileFor(width,height);
    const state=imageFor(scene);
    if(!state?.ready){
      return {
        scene,profile,width,height,
        baselineY:height*.88,
        horizonY:height*.66,
        floorLeft:width*.04,
        floorRight:width*.96,
        imageReady:false
      };
    }

    const crop=cropFor(scene,state.image,width,height);
    const floor=scene.floor || FALLBACK_SCENE.floor;
    const mapY=norm=>((clamp(norm,0,1)*crop.ih-crop.sy)/crop.sh)*height;
    const mapX=norm=>((clamp(norm,0,1)*crop.iw-crop.sx)/crop.sw)*width;
    const baselineY=clamp(mapY(Number(floor.baseline)||.88),height*.76,height*.94);
    const horizonY=clamp(mapY(Number(floor.horizon)||.66),height*.18,baselineY-height*.08);
    return {
      scene,profile,...crop,
      baselineY,
      horizonY,
      floorLeft:clamp(mapX(Number(floor.left)||.04),0,width),
      floorRight:clamp(mapX(Number(floor.right)||.96),0,width),
      imageReady:true,
      image:state.image
    };
  }

  function drawBackdrop(ctx,width,height){
    const frame=frameFor(width,height);
    lastFrame=frame;
    document.body.dataset.sceneProfile=frame.profile;
    document.body.dataset.sceneId=frame.scene.id;
    if(!frame.imageReady || !frame.image) return false;
    ctx.clearRect(0,0,width,height);
    ctx.drawImage(frame.image,frame.sx,frame.sy,frame.sw,frame.sh,0,0,width,height);
    return true;
  }

  function stageFrame(width,height){
    if(!lastFrame || lastFrame.width!==width || lastFrame.height!==height){
      lastFrame=frameFor(width,height);
    }
    return {
      profile:lastFrame.profile,
      floorY:lastFrame.baselineY,
      horizonY:lastFrame.horizonY,
      floorLeft:lastFrame.floorLeft,
      floorRight:lastFrame.floorRight,
      sceneId:lastFrame.scene.id
    };
  }

  function patchSource(source){
    if(typeof source!=='string' || !source.includes('function drawBackdrop(ctx,w,h){')) return source;
    if(source.includes('PuppetalkSceneCamera?.drawBackdrop')) return source;
    return source.replace(
      'function drawBackdrop(ctx,w,h){',
      "function drawBackdrop(ctx,w,h){\n  if(window.PuppetalkSceneCamera?.drawBackdrop?.(ctx,w,h)) return;"
    );
  }

  function SceneCameraBlob(parts=[],options={}){
    let nextParts=parts;
    if(options?.type==='text/javascript' && parts.length===1 && typeof parts[0]==='string'){
      const patched=patchSource(parts[0]);
      if(patched!==parts[0]) nextParts=[patched];
    }
    return new NativeBlob(nextParts,options);
  }
  SceneCameraBlob.prototype=NativeBlob.prototype;
  Object.setPrototypeOf(SceneCameraBlob,NativeBlob);
  window.Blob=SceneCameraBlob;

  function updateProfile(){
    const profile=profileFor(innerWidth,innerHeight);
    if(document.body) document.body.dataset.sceneProfile=profile;
    lastFrame=null;
  }
  addEventListener('resize',updateProfile,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(updateProfile,80),{passive:true});
  window.visualViewport?.addEventListener('resize',updateProfile,{passive:true});
  updateProfile();

  window.PuppetalkSceneCamera={
    version:1,
    profileFor,
    registerScene,
    registerScenes,
    setScene,
    getScene:activeScene,
    drawBackdrop,
    stageFrame,
    frameFor
  };
})();
