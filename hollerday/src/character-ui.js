import {
  PUPPET_COLOURS,
  CHARACTER_PARTS,
  SPECIAL_ITEMS,
  getLocalProfile,
  saveLocalProfile,
} from "./config.js";
import { drawPuppet } from "./rig.js";

const itemLabels={frisbee:"Laser frisbee",pump:"Balloon pump",ball:"Ball",dart:"Sticky darts"};
const pretty=value=>String(value).replace(/([a-z])([A-Z])/g,"$1 $2");
const pick=list=>list[Math.floor(Math.random()*list.length)];

function randomProfile(playerId,currentName="Puppet"){
  return{
    id:playerId,
    name:currentName||"Puppet",
    colour:pick(PUPPET_COLOURS),
    headStyle:pick(CHARACTER_PARTS.headStyle),
    eyes:pick(CHARACTER_PARTS.eyes),
    nose:pick(CHARACTER_PARTS.nose),
    mouth:pick(CHARACTER_PARTS.mouth),
    extra:pick(CHARACTER_PARTS.extra),
    specialItem:pick(SPECIAL_ITEMS),
  };
}

function fakePuppet(profile,mouth=0){
  const x=160,y=114;
  return{
    id:"preview",ownerPlayerId:profile.id,profile,
    behaviour:{mode:"active",pose:"stand",depth:0,mouth},
    parts:{
      torso:{x,y,angle:0},head:{x,y:y-65,angle:0},
      upperArmL:{x:x-37,y:y-17,angle:.12},lowerArmL:{x:x-42,y:y+30,angle:.05},
      upperArmR:{x:x+37,y:y-17,angle:-.12},lowerArmR:{x:x+42,y:y+30,angle:-.05},
      upperLegL:{x:x-14,y:y+65,angle:.04},lowerLegL:{x:x-14,y:y+118,angle:.02},
      upperLegR:{x:x+14,y:y+65,angle:-.04},lowerLegR:{x:x+14,y:y+118,angle:-.02},
    }
  };
}

export function setupCharacterEditor(playerId){
  const canvas=document.querySelector("#characterPreview");
  const nameInput=document.querySelector("#characterName");
  const editButton=document.querySelector("#editCharacter");
  const editor=document.querySelector("#characterEditor");
  const rerollButton=document.querySelector("#rerollCharacter");
  const talkButton=document.querySelector("#previewTalk");
  if(!canvas||!nameInput||!editor)return null;

  let profile=getLocalProfile(playerId);
  let mouth=0;
  let rerollUsed=sessionStorage.getItem("hollerday.rerollUsed")==="1";
  const ctx=canvas.getContext("2d");

  function draw(){
    const rect=canvas.getBoundingClientRect();
    const dpr=Math.min(devicePixelRatio||1,2);
    const width=Math.max(280,Math.round(rect.width||320));
    const height=Math.max(205,Math.round(rect.height||220));
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const scale=Math.min(2.2,Math.min(width/220,height/300)*.92);
    const cameraApi={camera:{scale},worldToScreen(x,y){return{x:width/2+(x-160)*scale,y:height*.49+(y-114)*scale};}};
    drawPuppet(ctx,fakePuppet(profile,mouth),cameraApi);
  }

  function persist(){saveLocalProfile(profile);draw();renderControls();}
  function setPart(key,value){profile={...profile,[key]:value};persist();}

  function choiceButton(key,value,label=value){
    const button=document.createElement("button");button.type="button";
    button.className="characterChoice"+(profile[key]===value?" active":"");
    button.textContent=pretty(label);button.addEventListener("click",()=>setPart(key,value));return button;
  }

  function renderControls(){
    const colours=document.querySelector("#characterColours");
    if(colours){colours.innerHTML="";for(const colour of PUPPET_COLOURS){const button=document.createElement("button");button.type="button";button.className="characterSwatch"+(profile.colour===colour?" active":"");button.style.setProperty("--swatch",colour);button.setAttribute("aria-label",colour);button.addEventListener("click",()=>setPart("colour",colour));colours.append(button);}}
    for(const [key,values] of Object.entries(CHARACTER_PARTS)){
      const row=document.querySelector(`[data-character-key="${key}"]`);if(!row)continue;row.innerHTML="";for(const value of values)row.append(choiceButton(key,value));
    }
    const items=document.querySelector("#characterItems");if(items){items.innerHTML="";for(const item of SPECIAL_ITEMS)items.append(choiceButton("specialItem",item,itemLabels[item]||item));}
    if(rerollButton){rerollButton.disabled=rerollUsed;rerollButton.textContent=rerollUsed?"Reroll used":"Reroll · 1 left";}
  }

  nameInput.value=profile.name||"";
  nameInput.addEventListener("input",()=>{profile={...profile,name:String(nameInput.value||"").trim().replace(/\s+/g," ").slice(0,24)||"Puppet"};saveLocalProfile(profile);draw();});
  editButton?.addEventListener("click",()=>{const open=!editor.classList.contains("open");editor.classList.toggle("open",open);editButton.textContent=open?"Done editing":"Edit character";});
  rerollButton?.addEventListener("click",()=>{if(rerollUsed)return;rerollUsed=true;sessionStorage.setItem("hollerday.rerollUsed","1");profile=randomProfile(playerId,profile.name);persist();});
  const talkOn=()=>{mouth=2;draw();};const talkOff=()=>{mouth=0;draw();};
  talkButton?.addEventListener("pointerdown",event=>{talkButton.setPointerCapture?.(event.pointerId);talkOn();});
  for(const eventName of ["pointerup","pointercancel","pointerleave"])talkButton?.addEventListener(eventName,talkOff);
  window.addEventListener("resize",draw);

  renderControls();draw();
  return{getProfile(){return getLocalProfile(playerId);},redraw:draw};
}