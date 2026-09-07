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

  const APPROVED_SCENES=[
    {
      id:'cowboys-railroad',label:'Old western town with railroad tracks',
      image:'https://images.unsplash.com/photo-1759234969177-a914255c2324?fit=crop&fm=jpg&q=74&w=1600',
      source:'https://unsplash.com/photos/old-western-town-with-railroad-tracks-and-buildings-1mmSOl66HGE',
      floor:{horizon:.61,baseline:.89,left:.04,right:.96},
      crops:{tall:{focusX:.50,focusY:.60,zoom:1.08},standard:{focusX:.50,focusY:.59,zoom:1.02},wide:{focusX:.50,focusY:.58,zoom:1}}
    },
    {
      id:'cowboys-lumber-yard',label:'Lumber yard and water tower',
      image:'https://images.unsplash.com/photo-1769276124346-57b244a1c6e5?fit=crop&fm=jpg&q=74&w=1600',
      source:'https://unsplash.com/photos/old-wooden-lumber-yard-building-with-water-tower-uj7-cj5OxmI',
      floor:{horizon:.62,baseline:.89,left:.04,right:.96},
      crops:{tall:{focusX:.50,focusY:.58,zoom:1.08},standard:{focusX:.50,focusY:.57,zoom:1.02},wide:{focusX:.50,focusY:.56,zoom:1}}
    },
    {
      id:'seabed-shark',label:'Shark above sandy seabed',
      image:'https://images.unsplash.com/photo-1762717564112-042869adfea9?fit=crop&fm=jpg&q=74&w=1600',
      source:'https://unsplash.com/photos/a-shark-swims-above-a-sandy-ocean-floor-Y6i5__8wmEM',
      floor:{horizon:.59,baseline:.90,left:.04,right:.96},
      crops:{tall:{focusX:.50,focusY:.55,zoom:1.08},standard:{focusX:.50,focusY:.54,zoom:1.02},wide:{focusX:.50,focusY:.53,zoom:1}}
    },
    {
      id:'clifftop-path',label:'Path through grass to the sea',
      image:'https://images.unsplash.com/photo-1682251135248-32a5d6e75a4d?fit=crop&fm=jpg&q=74&w=1600',
      source:'https://unsplash.com/photos/a-path-through-tall-grass-leading-to-the-ocean-hxeifzBanNI',
      floor:{horizon:.57,baseline:.89,left:.04,right:.96},
      crops:{tall:{focusX:.50,focusY:.62,zoom:1.08},standard:{focusX:.50,focusY:.61,zoom:1.02},wide:{focusX:.50,focusY:.60,zoom:1}}
    },
    {
      id:'forest-misty-clearing',label:'Misty green clearing',
      image:'https://images.unsplash.com/photo-1758007604230-51ceb456ed97?fit=crop&fm=jpg&q=74&w=1600',
      source:'https://unsplash.com/photos/misty-green-forest-with-a-clearing-in-foreground-qL1MqlSyu1A',
      floor:{horizon:.61,baseline:.89,left:.04,right:.96},
      crops:{tall:{focusX:.50,focusY:.63,zoom:1.08},standard:{focusX:.50,focusY:.62,zoom:1.02},wide:{focusX:.50,focusY:.61,zoom:1}}
    },
    {
      id:'forest-simple-clearing',label:'Simple woodland clearing',
      image:'https://images.unsplash.com/photo-1754375910434-5de08e27d800?fit=crop&fm=jpg&q=74&w=1600',
      source:'https://unsplash.com/photos/a-forest-clearing-with-trees-lJOo9XGZnls',
      floor:{horizon:.62,baseline:.89,left:.04,right:.96},
      crops:{tall:{focusX:.50,focusY:.63,zoom:1.08},standard:{focusX:.50,focusY:.62,zoom:1.02},wide:{focusX:.50,focusY:.61,zoom:1}}
    },
    {
      id:'ruins-courtyard',label:'Ancient stone ruins with grassy courtyard',
      image:'https://images.unsplash.com/photo-1763388703554-a3659ea16e10?fit=crop&fm=jpg&q=74&w=1600',
      source:'https://unsplash.com/photos/ancient-stone-ruins-with-an-open-courtyard-and-grassy-courtyard-NIrZPwqeaNg',
      floor:{horizon:.60,baseline:.89,left:.04,right:.96},
      crops:{tall:{focusX:.50,focusY:.63,zoom:1.08},standard:{focusX:.50,focusY:.62,zoom:1.02},wide:{focusX:.50,focusY:.61,zoom:1}}
    }
  ];

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
    const failures=new Map();
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
      images.set(scene.id,state);
      image.decoding='async';
      try{ image.referrerPolicy='no-referrer'; }catch{}
      if(documentRef?.body) documentRef.body.dataset.sceneImage='loading';
      image.onload=()=>{
        state.ready=true;
        state.error=false;
        failures.delete(scene.id);
        lastFrame=null;
        if(documentRef?.body) documentRef.body.dataset.sceneImage='ready';
        dispatch('resize');
      };
      image.onerror=()=>{
        state.error=true;
        const count=(failures.get(scene.id)||0)+1;
        failures.set(scene.id,count);
        if(documentRef?.body) documentRef.body.dataset.sceneImage=count<4?'retrying':'error';
        if(count<4 && typeof setTimer==='function'){
          setTimer(()=>{
            if(images.get(scene.id)!==state) return;
            images.delete(scene.id);
            lastFrame=null;
            imageFor(scene);
            dispatch('resize');
          },Math.min(3600,600*Math.pow(2,count-1)));
        }
      };
      image.src=scene.image;
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

  function hashRoom(room){
    const text=String(room||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    let hash=2166136261;
    for(let i=0;i<text.length;i++) hash=Math.imul(hash^text.charCodeAt(i),16777619);
    return hash>>>0;
  }

  const camera=create();
  camera.registerScenes(APPROVED_SCENES);
  camera.installViewportListeners();

  function selectForRoom(room){
    const key=String(room||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(!key) return camera.getScene();
    const scene=APPROVED_SCENES[hashRoom(key)%APPROVED_SCENES.length];
    return camera.setScene(scene?.id||'default');
  }

  root.PuppetalkSceneCamera={create,APPROVED_SCENES,hashRoom,selectForRoom,...camera};
})(typeof window!=='undefined'?window:globalThis);
