(function(root){
function create(deps={}){
  const {
    app,document,POSES,LOOK_PALETTE,LOOK_PARTS,cleanLook,saveLook,savedLook,
    peerId,NAMES,send,savedPlayerName,clamp,drawBackdrop,puppetalkSeatProjection,
    drawProp,drawAnatomy,incompleteInviteShell,controllerShell
  }=deps;
  if(!app || !document || !POSES || !LOOK_PALETTE || !LOOK_PARTS || !cleanLook || !saveLook || !savedLook ||
     !peerId || !NAMES || !send || !savedPlayerName || !clamp || !drawBackdrop || !puppetalkSeatProjection ||
     !drawProp || !drawAnatomy || !incompleteInviteShell || !controllerShell) return null;

  function startController(room){
    if(!root.Peer){
      app.textContent = 'Puppetalk network library failed to load.';
      return;
    }
    if(!room){
      app.innerHTML = incompleteInviteShell();
      return;
    }

    app.innerHTML = controllerShell(room,POSES);
    document.body.classList.add('puppetalk-fullscreen');

    const canvas = document.querySelector('#personal-canvas');
    const ctx = canvas.getContext('2d');
    const stageBox = document.querySelector('#personal-stage');
    const hint = document.querySelector('#stage-hint');
    const youChip = document.querySelector('#you-chip');
    const dot = document.querySelector('#dot');
    const status = document.querySelector('#controller-status');
    const micButton = document.querySelector('#mic');
    const level = document.querySelector('#level');
    const talkButton = document.querySelector('#talk');

    let centreTimer = null;
    const input = {pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[]};

    input.look = savedLook();

    const controllerCanvas = root.PuppetalkControllerCanvas?.create?.({
      canvas,stageBox,ctx,
      getDevicePixelRatio:()=>root.devicePixelRatio || 1,
      addEventListenerFn:(type,handler,opts)=>root.addEventListener(type,handler,opts)
    });
    if(!controllerCanvas) throw new Error('Puppetalk controller canvas lifecycle failed to load.');
    const {getDimensions:getCanvasDimensions} = controllerCanvas;

    const controllerSession = root.PuppetalkControllerSession?.create?.({
      Peer:root.Peer,room,peerId,NAMES,input,send,savedPlayerName,hint,youChip,status,dot,
      setTimeoutFn:(callback,ms)=>root.setTimeout(callback,ms),
      clearTimeoutFn:id=>root.clearTimeout(id)
    });
    if(!controllerSession) throw new Error('Puppetalk controller session failed to load.');
    const {setStatus,transmit,connect,getConn,getSlot,getScene,getPropScene,getLiveVoice} = controllerSession;

    const puppetInteraction = root.PuppetalkControllerPuppetry?.create?.({
      canvas,ctx,hint,input,clamp,
      getScene,getPropScene,getSlot,getDimensions:getCanvasDimensions,
      drawBackdrop,seatProjection:puppetalkSeatProjection,drawProp,drawAnatomy,transmit,
      cancelCentre:()=>{ if(centreTimer){ root.clearTimeout(centreTimer); centreTimer = null; } }
    });
    if(!puppetInteraction) throw new Error('Puppetalk direct puppet interaction failed to load.');
    const {
      activePointers,myPuppet,grabSpots,renderGrabHandles,renderPersonalScene,
      pointerToWorld,pickGrab,describeActiveGrabs
    } = puppetInteraction;
    controllerCanvas.setRender(renderPersonalScene);

    const itemInteraction = root.PuppetalkControllerItems?.create?.({
      document,canvas,send,
      getConn,getSlot,getPropScene,getScene,
      getDimensions:getCanvasDimensions,getMyPuppet:()=>getScene().find(p=>p.slot === getSlot()),
      seatProjection:puppetalkSeatProjection,
      displayPoint:typeof root.displayPoint === 'function' ? root.displayPoint : null,
      storage:root.localStorage
    });
    if(!itemInteraction) throw new Error('Puppetalk controller item interactions failed to load.');
    const {
      controllerSpecialType,controllerSpecialLabel,updateSpecialItemButton,bringOutMySpecialItem,
      heldProp,updateGripButtons,toggleGrip,propDisplayPoint,pickTappedProp,nearestPropHand
    } = itemInteraction;
    controllerSession.setHooks({updateSpecialItemButton,updateGripButtons,renderPersonalScene});

    puppetInteraction.install();

    itemInteraction.installPropTap();

    const characterCreator = root.PuppetalkCharacterCreator?.create?.({
      document,input,LOOK_PALETTE,LOOK_PARTS,cleanLook,saveLook,send,
      getConn,getSlot,savedPlayerName,random:()=>Math.random()
    });
    if(!characterCreator) throw new Error('Puppetalk character creator controller failed to load.');
    characterCreator.install();

    const controllerThrowGesture = root.PuppetalkControllerThrowGesture?.create?.({
      canvas,activePointers,heldProp,pointerToWorld,
      getConn,getSlot,send,
      now:()=>root.performance.now(),queueTask:callback=>root.queueMicrotask(callback)
    });
    if(!controllerThrowGesture) throw new Error('Puppetalk controller throw gesture failed to load.');
    controllerThrowGesture.install();

    const commandPanel = root.PuppetalkControllerCommands?.create?.({
      document,input,activePointers,transmit,connect,
      getCentreTimer:()=>centreTimer,setCentreTimer:value=>{ centreTimer=value; },
      setTimeoutFn:(callback,ms)=>root.setTimeout(callback,ms),
      clearTimeoutFn:id=>root.clearTimeout(id)
    });
    if(!commandPanel) throw new Error('Puppetalk controller command panel failed to load.');
    commandPanel.install();

    itemInteraction.installButtons();
    updateSpecialItemButton(false);

    const controllerAudio = root.PuppetalkControllerAudio?.create?.({
      micButton,level,talkButton,input,transmit,setStatus,clamp,liveVoice:getLiveVoice?.(),
      getUserMedia:constraints=>root.navigator.mediaDevices.getUserMedia(constraints),
      createAudioContext:()=>new root.AudioContext(),
      requestFrame:callback=>root.requestAnimationFrame(callback),
      cancelFrame:id=>root.cancelAnimationFrame(id),
      setTimer:(callback,ms)=>root.setInterval(callback,ms),
      clearTimer:id=>root.clearInterval(id)
    });
    if(!controllerAudio) throw new Error('Puppetalk controller audio failed to load.');
    controllerAudio.install();

    controllerCanvas.start();
    connect();
  }

  return {startController};
}

root.PuppetalkControllerApp={create};
})(typeof window!=='undefined'?window:globalThis);
