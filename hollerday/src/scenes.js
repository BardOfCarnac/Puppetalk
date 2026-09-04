const SCENES=Object.freeze([
  {id:"stage",label:"Stage",image:null,focusX:.5,focusY:.58,zoom:1},
  {id:"western",label:"Western town",image:"https://unsplash.com/photos/1mmSOl66HGE/download?force=true&w=1800",focusX:.5,focusY:.57,zoom:1.04},
  {id:"seabed",label:"Seabed",image:"https://unsplash.com/photos/Y6i5__8wmEM/download?force=true&w=1800",focusX:.5,focusY:.57,zoom:1.02},
  {id:"clifftop",label:"Clifftop",image:"https://unsplash.com/photos/hxeifzBanNI/download?force=true&w=1800",focusX:.5,focusY:.61,zoom:1.05},
  {id:"forest",label:"Forest clearing",image:"https://unsplash.com/photos/qL1MqlSyu1A/download?force=true&w=1800",focusX:.5,focusY:.59,zoom:1.04},
  {id:"ruins",label:"Ruins",image:"https://unsplash.com/photos/NIrZPwqeaNg/download?force=true&w=1800",focusX:.5,focusY:.59,zoom:1.04},
]);
const cache=new Map();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function sceneById(id){return SCENES.find(scene=>scene.id===id)||SCENES[0];}
export function nextSceneId(id){const index=Math.max(0,SCENES.findIndex(scene=>scene.id===id));return SCENES[(index+1)%SCENES.length].id;}
export function sceneLabel(id){return sceneById(id).label;}
export function allScenes(){return [...SCENES];}

function imageState(scene){
  if(!scene.image)return null;
  if(cache.has(scene.id))return cache.get(scene.id);
  const image=new Image();
  const state={image,ready:false,error:false};
  image.decoding="async";
  image.onload=()=>{state.ready=true;window.dispatchEvent(new CustomEvent("hollerday-scene-ready",{detail:{sceneId:scene.id}}));};
  image.onerror=()=>{state.error=true;};
  image.src=scene.image;
  cache.set(scene.id,state);
  return state;
}

export function warmScene(id){imageState(sceneById(id));}

export function drawScene(ctx,id,cameraApi){
  const scene=sceneById(id);
  const state=imageState(scene);
  if(!state?.ready)return false;
  const image=state.image;
  const {camera,worldToScreen}=cameraApi;
  const tl=worldToScreen(0,0),br=worldToScreen(1000,700);
  const dw=br.x-tl.x,dh=br.y-tl.y;
  const iw=Math.max(1,image.naturalWidth||image.width),ih=Math.max(1,image.naturalHeight||image.height);
  const viewAspect=dw/dh,imageAspect=iw/ih;
  let sw=iw,sh=ih;
  if(imageAspect>viewAspect)sw=ih*viewAspect;else sh=iw/viewAspect;
  const zoom=clamp(scene.zoom||1,1,2.4);sw/=zoom;sh/=zoom;
  let sx=(scene.focusX||.5)*iw-sw/2,sy=(scene.focusY||.5)*ih-sh/2;
  sx=clamp(sx,0,Math.max(0,iw-sw));sy=clamp(sy,0,Math.max(0,ih-sh));
  ctx.drawImage(image,sx,sy,sw,sh,tl.x,tl.y,dw,dh);
  // Keep a light stage wash so the line puppets remain legible on photographs.
  ctx.fillStyle="rgba(255,245,214,.10)";ctx.fillRect(tl.x,tl.y,dw,dh);
  return true;
}
