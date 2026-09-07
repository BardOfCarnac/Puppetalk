(function(root){
  'use strict';

  const FALLBACK_SCENE={
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

  function create(options={}){
    const {
      ImageClass=root.Image,
      documentRef=root.document,
      dispatch=(type,detail)=>{
        if(typeof root.dispatchEvent!=='function') return;
        if(type==='puppetalk-scene-change' && typeof root.CustomEvent==='function'){
          root.dispatchEvent(new root.CustomEvent(type,{detail}));
        }else if(typeof root.Event==='function') root.dispatchEvent(new root.Event(type));
      },
      addListener=(type,handler,opts)=>root.addEventListener?.(type,handler,opts),
      getViewport=()=>({width:root.innerWidth||320,height:root.innerHeight||360}),
      setTimer=(fn,ms)=>root.setTimeout?.(fn,ms)
    }=options;

    const scenes=new Map([[FALLBACK_SCENE.id,{...FALLBACK_SCENE,floor:{...FALLBACK_SCENE.floor},crops:{...FALLBACK_SCENE.crops}}]]);
    const images=new Map();
    let activeId='default';
    let lastFrame=null;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

    function profileFor(width,height){
      const aspect=Math.max(1,width)/Math.max(1,height);
      if(aspect<.78) return 'tall';
      if(aspect>1.42) return 'wide';
      return 'standard';
    }

    function normalizeScene(input){
      if(!input?.id) return null;
      return {
        ...FALLBACK_SCENE,
        ...input,
        id:String(input.id),
        floor:{...FALLBACK_SCENE.floor,...(input.floor||{})},
        crops:{...FALLBACK_SCENE.crops,...(input.crops||{})},
        supports:Array.isArray(input.supports)&&input.supports.length?[...input.supports]:[...FALLBACK_SCENE.supports]
      };
    }

    function registerScene(input){
      const scene=normalizeScene(input);
      if(!scene) return null;
      scenes.set(scene.id,scene);
      return scene;
    }
    function registerScenes(list){return Array.isArray(list)?list.map(registerScene).filter(Boolean):[];}
    function activeScene(){return scenes.get(activeId)||scenes.get('default');}

    function setScene(idOrScene){
      if(idOrScene&&typeof idOrScene==='object'){
        const scene=registerScene(idOrScene);
        activeId=scene?.id||'default';
      }else{
        const id=String(idOrScene||'default');
        activeId=scenes.has(id)?id:'default';
      }
      lastFrame=null;
      dispatch('puppetalk-scene-change',{scene:activeScene()});
      dispatch('resize');
      return activeScene();
    }

    function imageFor(scene){
      if(!scene?.image||typeof ImageClass!=='function') return null;
      if(images.has(scene.id)) return images.get(scene.id);
      const image=new ImageClass();
      const state={image,ready:false,error:false};
      image.decoding='async';
      image.onload=()=>{state.ready=true;lastFrame=null;dispatch('resize');};
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
      let sw=iw,sh=ih;
      if(imageAspect>viewAspect) sw=ih*viewAspect;
      else sh=iw/viewAspect;
      const zoom=clamp(Number(preset.zoom)||1,1,2.4);
      sw/=zoom;sh/=zoom;
      const fx=clamp(Number(preset.focusX),0,1);
      const fy=clamp(Number(preset.focusY),0,1);
      const sx=clamp(fx*iw-sw*.5,0,Math.max(0,iw-sw));
      const sy=clamp(fy*ih-sh*.5,0,Math.max(0,ih-sh));
      return {profile,iw,ih,sx,sy,sw,sh,width,height};
    }

    function frameFor(width,height){
      const scene=activeScene();
      const profile=profileFor(width,height);
      const state=imageFor(scene);
      if(!state?.ready){
        const floor=scene.floor||FALLBACK_SCENE.floor;
        return {
          scene,profile,width,height,
          baselineY:height*(Number(floor.baseline)||.88),
          horizonY:height*(Number(floor.horizon)||.66),
          floorLeft:width*(Number(floor.left)||.04),
          floorRight:width*(Number(floor.right)||.96),
          imageReady:false
        };
      }
      const crop=cropFor(scene,state.image,width,height);
      const floor=scene.floor||FALLBACK_SCENE.floor;
      const mapY=norm=>((clamp(norm,0,1)*crop.ih-crop.sy)/crop.sh)*height;
      const mapX=norm=>((clamp(norm,0,1)*crop.iw-crop.sx)/crop.sw)*width;
      const baselineY=clamp(mapY(Number(floor.baseline)||.88),height*.76,height*.94);
      const horizonY=clamp(mapY(Number(floor.horizon)||.66),height*.18,baselineY-height*.08);
      return {
        scene,profile,...crop,baselineY,horizonY,
        floorLeft:clamp(mapX(Number(floor.left)||.04),0,width),
        floorRight:clamp(mapX(Number(floor.right)||.96),0,width),
        imageReady:true,image:state.image
      };
    }

    function drawBackdrop(ctx,width,height){
      const frame=frameFor(width,height);
      lastFrame=frame;
      if(documentRef?.body){
        documentRef.body.dataset.sceneProfile=frame.profile;
        documentRef.body.dataset.sceneId=frame.scene.id;
      }
      if(!frame.imageReady||!frame.image) return false;
      ctx.clearRect(0,0,width,height);
      ctx.drawImage(frame.image,frame.sx,frame.sy,frame.sw,frame.sh,0,0,width,height);
      return true;
    }

    function stageFrame(width,height){
      if(!lastFrame||lastFrame.width!==width||lastFrame.height!==height) lastFrame=frameFor(width,height);
      return {
        profile:lastFrame.profile,
        floorY:lastFrame.baselineY,
        horizonY:lastFrame.horizonY,
        floorLeft:lastFrame.floorLeft,
        floorRight:lastFrame.floorRight,
        sceneId:lastFrame.scene.id
      };
    }

    function updateProfile(){
      const {width,height}=getViewport();
      if(documentRef?.body) documentRef.body.dataset.sceneProfile=profileFor(width,height);
      lastFrame=null;
    }
    function installViewportListeners(){
      addListener('resize',updateProfile,{passive:true});
      addListener('orientationchange',()=>setTimer?.(updateProfile,80),{passive:true});
      root.visualViewport?.addEventListener?.('resize',updateProfile,{passive:true});
      updateProfile();
    }

    return {
      profileFor,normalizeScene,registerScene,registerScenes,setScene,getScene:activeScene,
      drawBackdrop,stageFrame,frameFor,cropFor,installViewportListeners
    };
  }

  const camera=create();
  camera.installViewportListeners();
  root.PuppetalkSceneCamera={create,...camera};
})(typeof window!=='undefined'?window:globalThis);
