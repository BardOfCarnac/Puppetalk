// Puppetalk dart / balloon interaction.
// Fast moving darts puncture loose, held, or attached balloons.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_DART_STICK_V1') ||
       !source.includes('PUPPETALK_BALLOON_TIE_V1') ||
       source.includes('PUPPETALK_DART_BALLOON_POP_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_DART_STICK_V1',
      '  // PUPPETALK_DART_STICK_V1\n  // PUPPETALK_DART_BALLOON_POP_V1'
    );

    const driveNeedle = `  function driveProps(){`;
    const helpers = `  function distancePointToSegment(point,a,b){
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
          // Keep the dart travelling so a particularly good throw can puncture a cluster.
          Body.setVelocity(dart.body,{x:velocity.x*.90,y:velocity.y*.90});
        }
      }
    }
  }

${driveNeedle}`;
    if(!source.includes(driveNeedle)) throw new Error('Dart balloon pop patch failed: driveProps');
    source = source.replace(driveNeedle,helpers);

    const endNeedle = `      syncAttachedProp(prop);\n    });\n  }\n\n  function propState(prop){`;
    const endCode = `      syncAttachedProp(prop);\n    });\n    driveDartBalloonPops();\n  }\n\n  function propState(prop){`;
    if(!source.includes(endNeedle)) throw new Error('Dart balloon pop patch failed: drive loop hook');
    source = source.replace(endNeedle,endCode);

    return source;
  }

  window.fetch = async (...args)=>{
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text),{
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    });
  };
})();
