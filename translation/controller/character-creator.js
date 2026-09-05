(function(root){
  'use strict';

  function create(options={}){
    const {
      document,input,LOOK_PALETTE,LOOK_PARTS,cleanLook,saveLook,send,
      getConn,getSlot,savedPlayerName,random=()=>Math.random()
    }=options;
    if(!document || !input || !LOOK_PALETTE || !LOOK_PARTS || !cleanLook || !saveLook || !send || !getConn || !getSlot || !savedPlayerName) return null;

    function renderCreator(){
      const card=document.querySelector('#character-card');
      if(!card) return;
      for(const key of ['headStyle','eyes','nose','mouth','extra']){
        const el=document.querySelector('#look-'+key);
        if(el) el.textContent=input.look[key];
      }
      const colors=document.querySelector('#character-colors');
      if(colors && !colors.childElementCount){
        LOOK_PALETTE.forEach(color=>{
          const b=document.createElement('button');
          b.type='button';
          b.className='character-swatch';
          b.dataset.color=color;
          b.style.setProperty('--swatch',color);
          b.title=color;
          b.addEventListener('click',()=>{input.look.color=color;sendLook();});
          colors.appendChild(b);
        });
      }
      colors?.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color===input.look.color));
      const preview=document.querySelector('#character-preview');
      if(preview){
        preview.style.setProperty('--puppet-color',input.look.color);
        preview.dataset.head=input.look.head;
        preview.dataset.eyes=input.look.eyes;
        preview.dataset.hair=input.look.hair;
        preview.dataset.extra=input.look.extra;
      }
    }

    function sendLook(){
      input.look=cleanLook(input.look,getSlot()||0);
      saveLook(input.look);
      send(getConn(),{type:'look',look:input.look,name:savedPlayerName()});
      renderCreator();
    }

    function cycleLook(key){
      const list=LOOK_PARTS[key];
      if(!list) return;
      const i=list.indexOf(input.look[key]);
      input.look[key]=list[(i+1)%list.length];
      sendLook();
    }

    function randomizeLook(){
      const pick=a=>a[Math.floor(random()*a.length)];
      input.look={
        color:pick(LOOK_PALETTE),
        headStyle:pick(LOOK_PARTS.headStyle),
        eyes:pick(LOOK_PARTS.eyes),
        nose:pick(LOOK_PARTS.nose),
        mouth:pick(LOOK_PARTS.mouth),
        extra:pick(LOOK_PARTS.extra)
      };
      sendLook();
    }

    function install(){
      document.querySelector('#character-card')?.addEventListener('click',event=>{
        const b=event.target.closest('[data-look]');
        if(b) cycleLook(b.dataset.look);
      });
      document.querySelector('#character-random')?.addEventListener('click',randomizeLook);
      renderCreator();
    }

    return {sendLook,cycleLook,renderCreator,randomizeLook,install};
  }

  root.PuppetalkCharacterCreator={create};
})(typeof window!=='undefined'?window:globalThis);
