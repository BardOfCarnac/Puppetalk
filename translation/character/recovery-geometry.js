// Behaviour-preserving joint/seam geometry extracted from frozen V1.
// Matter.Vector is injected explicitly; this module does not alter constraints or repair state.
(() => {
  function create(Vector){
    if(!Vector?.rotate) throw new Error('Puppetalk recovery geometry requires Matter.Vector.');

    function jointWorldPoint(constraint,side){
      const body = side === 'A' ? constraint?.bodyA : constraint?.bodyB;
      const point = side === 'A' ? constraint?.pointA : constraint?.pointB;
      if(!body || !point) return null;
      const r = Vector.rotate(point,body.angle||0);
      return {x:body.position.x+r.x,y:body.position.y+r.y};
    }

    function jointGap(constraint){
      const a = jointWorldPoint(constraint,'A');
      const b = jointWorldPoint(constraint,'B');
      return a && b ? Math.hypot(a.x-b.x,a.y-b.y) : Infinity;
    }

    function jointCutPoint(constraint){
      const a = jointWorldPoint(constraint,'A');
      const b = jointWorldPoint(constraint,'B');
      if(!a || !b) return null;
      return {x:(a.x+b.x)*.5,y:(a.y+b.y)*.5};
    }

    function seamCutPoint(p,name){
      const c = p?.seams?.[name];
      return c ? jointCutPoint(c) : null;
    }

    return {jointWorldPoint,jointGap,jointCutPoint,seamCutPoint};
  }

  window.PuppetalkRecoveryGeometry = {create};
})();