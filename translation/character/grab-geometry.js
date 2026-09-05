// Behaviour-preserving grab geometry extracted from frozen V1.
// Matter.Vector is injected so this module stays explicit about its sole physics dependency.
(() => {
  function create(Vector){
    if(!Vector?.rotate) throw new Error('Puppetalk grab geometry requires Matter.Vector.');

    function worldPoint(body,local){
      const r = Vector.rotate(local,body.angle);
      return {x:body.position.x+r.x,y:body.position.y+r.y};
    }

    function grabBody(p,part){
      if(part === 'head') return p.head;
      if(part === 'leftHand') return p.faL2 || p.faL;
      if(part === 'rightHand') return p.faR2 || p.faR;
      if(part === 'leftFoot') return p.shL2 || p.shL;
      if(part === 'rightFoot') return p.shR2 || p.shR;
      return p.torso;
    }

    function grabWorldPoint(p,part){
      if(part === 'pelvis') return worldPoint(p.torso,{x:0,y:34});
      if(part === 'leftShoulder') return worldPoint(p.torso,{x:-24,y:-27});
      if(part === 'rightShoulder') return worldPoint(p.torso,{x:24,y:-27});
      if(part === 'leftHand') return worldPoint(p.faL2 || p.faL,{x:0,y:12});
      if(part === 'rightHand') return worldPoint(p.faR2 || p.faR,{x:0,y:12});
      if(part === 'leftFoot') return worldPoint(p.shL2 || p.shL,{x:0,y:13.5});
      if(part === 'rightFoot') return worldPoint(p.shR2 || p.shR,{x:0,y:13.5});
      return grabBody(p,part).position;
    }

    return {worldPoint,grabBody,grabWorldPoint};
  }

  window.PuppetalkGrabGeometry = {create};
})();