(function(root){
  'use strict';

  function create({props,cancelPropContest,releasePropHolder,Composite,engine,Vector,clamp,Body}){
    function distancePointToSegment(point,a,b){
      const abx = b.x-a.x;
      const aby = b.y-a.y;
      const denom = abx*abx+aby*aby;
      if(denom <= .0001) return Math.hypot(point.x-a.x,point.y-a.y);
      const t = clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/denom,0,1);
      const x = a.x+abx*t;
      const y = a.y+aby*t;
      return Math.hypot(point.x-x,point.y-y);
    }

    function dartTouchesBalloon(dart,balloon){
      const db = dart?.body;
      const bb = balloon?.body;
      if(!db || !bb) return false;
      const half = 23;
      const left = Vector.rotate({x:-half,y:0},db.angle||0);
      const right = Vector.rotate({x:half,y:0},db.angle||0);
      const a = {x:db.position.x+left.x,y:db.position.y+left.y};
      const b = {x:db.position.x+right.x,y:db.position.y+right.y};
      return distancePointToSegment(bb.position,a,b) <= 20;
    }

    function popBalloon(balloon){
      if(!balloon || balloon.type !== 'balloon' || !props.has(balloon.id)) return false;
      if(balloon.contest) cancelPropContest(balloon);
      if(balloon.heldBy) releasePropHolder(balloon,false);
      balloon.attachedTo = null;
      Composite.remove(engine.world,balloon.body);
      props.delete(balloon.id);
      return true;
    }

    function driveDartBalloonPops(){
      const darts = [];
      const balloons = [];
      for(const prop of props.values()){
        if(prop.type === 'dart' && !prop.heldBy && !prop.contest && !prop.attachedTo) darts.push(prop);
        else if(prop.type === 'balloon') balloons.push(prop);
      }
      if(!darts.length || !balloons.length) return;

      for(const dart of darts){
        const velocity = dart.body?.velocity || {x:0,y:0};
        if(Math.hypot(velocity.x,velocity.y) < 1.15) continue;
        for(const balloon of [...balloons]){
          if(!props.has(balloon.id) || !dartTouchesBalloon(dart,balloon)) continue;
          if(popBalloon(balloon)){
            Body.setVelocity(dart.body,{x:velocity.x*.90,y:velocity.y*.90});
          }
        }
      }
    }

    return {distancePointToSegment,dartTouchesBalloon,popBalloon,driveDartBalloonPops};
  }

  root.PuppetalkBalloonPops = {create};
})(typeof window !== 'undefined' ? window : globalThis);
