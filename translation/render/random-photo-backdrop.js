(function(root){
  'use strict';

  const camera=root.PuppetalkSceneCamera;
  const renderer=root.PuppetalkSceneRenderer;
  if(!camera || !renderer?.create) return;

  const params=new URLSearchParams(root.location?.search || '');
  const room=String(params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  if(room) camera.selectForRoom?.(room);

  if(renderer.__puppetalkPhotoBackdropInstalled) return;
  const originalCreate=renderer.create.bind(renderer);

  renderer.create=function(options={}){
    const api=originalCreate(options);
    if(!api || typeof api.drawBackdrop!=='function') return api;
    const proceduralBackdrop=api.drawBackdrop.bind(api);
    api.drawBackdrop=function(ctx,width,height){
      if(camera.drawBackdrop?.(ctx,width,height)) return true;
      proceduralBackdrop(ctx,width,height);
      return false;
    };
    return api;
  };

  renderer.__puppetalkPhotoBackdropInstalled=true;
  root.PuppetalkPhotoBackdrop={
    room,
    scene:()=>camera.getScene?.() || null
  };
})(typeof window!=='undefined'?window:globalThis);
