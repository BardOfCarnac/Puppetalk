(function(global){
  'use strict';

  function create({getDimensions,worldPoint,cleanLook}){
    if(typeof getDimensions !== 'function' || typeof worldPoint !== 'function' || typeof cleanLook !== 'function') return null;

    function norm(point){
      const {W,H}=getDimensions();
      return {x:point.x/W,y:point.y/H};
    }

    function segmentState(body){
      const {W,H}=getDimensions();
      return {x:body.position.x/W,y:body.position.y/H,a:body.angle||0};
    }

    function anatomy(p){
      const {W,H}=getDimensions();
      const t=p.torso;
      return {
        slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,severed:[...(p.severedJoints||[])],brokenSeams:[...(p.brokenSeams||[])],
        segTorsoTop:segmentState(p.torsoTop),segTorsoBottom:segmentState(p.torsoBottom),
        segHeadLower:segmentState(p.head),segHeadTop:segmentState(p.headTop),look:cleanLook(p.look,p.slot),
        torso:{x:t.position.x/W,y:t.position.y/H,a:t.angle},
        head:{x:(p.head.position.x+p.headTop.position.x)/(2*W),y:(p.head.position.y+p.headTop.position.y)/(2*H),a:((p.head.angle||0)+(p.headTop.angle||0))*.5},
        sl:norm(worldPoint(t,{x:-24,y:-27})),sr:norm(worldPoint(t,{x:24,y:-27})),
        el:norm(worldPoint(p.uaL2,{x:0,y:13})),er:norm(worldPoint(p.uaR2,{x:0,y:13})),
        wl:norm(worldPoint(p.faL2,{x:0,y:12})),wr:norm(worldPoint(p.faR2,{x:0,y:12})),
        hl:norm(worldPoint(t,{x:-14,y:38})),hr:norm(worldPoint(t,{x:14,y:38})),
        kl:norm(worldPoint(p.thL2,{x:0,y:14.5})),kr:norm(worldPoint(p.thR2,{x:0,y:14.5})),
        al:norm(worldPoint(p.shL2,{x:0,y:13.5})),ar:norm(worldPoint(p.shR2,{x:0,y:13.5})),
        uaLt:norm(worldPoint(p.uaL,{x:0,y:-13})),faLt:norm(worldPoint(p.faL,{x:0,y:-12})),
        uaRt:norm(worldPoint(p.uaR,{x:0,y:-13})),faRt:norm(worldPoint(p.faR,{x:0,y:-12})),
        thLt:norm(worldPoint(p.thL,{x:0,y:-14.5})),shLt:norm(worldPoint(p.shL,{x:0,y:-13.5})),
        thRt:norm(worldPoint(p.thR,{x:0,y:-14.5})),shRt:norm(worldPoint(p.shR,{x:0,y:-13.5})),
        uaLmA:norm(worldPoint(p.uaL,{x:0,y:13})),uaLmB:norm(worldPoint(p.uaL2,{x:0,y:-13})),
        faLmA:norm(worldPoint(p.faL,{x:0,y:12})),faLmB:norm(worldPoint(p.faL2,{x:0,y:-12})),
        uaRmA:norm(worldPoint(p.uaR,{x:0,y:13})),uaRmB:norm(worldPoint(p.uaR2,{x:0,y:-13})),
        faRmA:norm(worldPoint(p.faR,{x:0,y:12})),faRmB:norm(worldPoint(p.faR2,{x:0,y:-12})),
        thLmA:norm(worldPoint(p.thL,{x:0,y:14.5})),thLmB:norm(worldPoint(p.thL2,{x:0,y:-14.5})),
        shLmA:norm(worldPoint(p.shL,{x:0,y:13.5})),shLmB:norm(worldPoint(p.shL2,{x:0,y:-13.5})),
        thRmA:norm(worldPoint(p.thR,{x:0,y:14.5})),thRmB:norm(worldPoint(p.thR2,{x:0,y:-14.5})),
        shRmA:norm(worldPoint(p.shR,{x:0,y:13.5})),shRmB:norm(worldPoint(p.shR2,{x:0,y:-13.5}))
      };
    }

    return {norm,segmentState,anatomy};
  }

  global.PuppetalkCharacterSceneState={create};
})(typeof window!=='undefined'?window:globalThis);
