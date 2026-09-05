(function(root){
  'use strict';

  function create(options={}){
    const {
      document,input,activePointers,transmit,connect,
      getCentreTimer,setCentreTimer,
      setTimeoutFn=(callback,ms)=>setTimeout(callback,ms),
      clearTimeoutFn=id=>clearTimeout(id)
    }=options;
    if(!document || !input || !activePointers || !transmit || !connect || !getCentreTimer || !setCentreTimer) return null;

    function handlePoseClick(event){
      const button=event.target.closest('button');
      if(!button) return;
      if(button.dataset.pose){
        input.pose=button.dataset.pose;
        input.poseVersion=(input.poseVersion||0)+1;
        input.rag=false;
        document.querySelectorAll('[data-pose]').forEach(b=>b.classList.toggle('active',b===button));
        const rag=document.querySelector('[data-rag]');
        rag.classList.remove('active');
        rag.textContent='Go limp';
        transmit(true);
        return;
      }
      if(button.hasAttribute('data-rag')){
        input.rag=!input.rag;
        button.classList.toggle('active',input.rag);
        button.textContent=input.rag?'Recover':'Go limp';
        transmit(true);
      }
    }

    function centre(){
      if(activePointers.size) return;
      input.grabs=[{part:'torso',x:.5,y:.55}];
      transmit(true);
      const current=getCentreTimer();
      if(current) clearTimeoutFn(current);
      const timer=setTimeoutFn(()=>{
        input.grabs=[];
        transmit(true);
        setCentreTimer(null);
      },150);
      setCentreTimer(timer);
    }

    function install(){
      document.querySelector('#poses').addEventListener('click',handlePoseClick);
      document.querySelector('#centre').addEventListener('click',centre);
      document.querySelector('#retry').addEventListener('click',connect);
    }

    return {handlePoseClick,centre,install};
  }

  root.PuppetalkControllerCommands={create};
})(typeof window!=='undefined'?window:globalThis);
