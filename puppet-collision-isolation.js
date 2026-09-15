// Puppet bodies may overlap each other without transmitting Matter collision forces.
// They still collide normally with the stage bounds and ordinary props.
(() => {
  const M = window.Matter;
  if(!M?.Bodies || window.PuppetalkPuppetCollisionIsolation) return;

  const {Bodies} = M;
  const PUPPET_CATEGORY = 0x0002;
  const NON_PUPPET_MASK = 0xFFFFFFFD; // every category except 0x0002

  function isolate(body){
    if((body?.collisionFilter?.group || 0) < 0){
      body.collisionFilter.category = PUPPET_CATEGORY;
      body.collisionFilter.mask = NON_PUPPET_MASK;
    }
    return body;
  }

  const rawRectangle = Bodies.rectangle.bind(Bodies);
  const rawCircle = Bodies.circle.bind(Bodies);
  const rawFromVertices = Bodies.fromVertices?.bind(Bodies);

  Bodies.rectangle = (...args)=>isolate(rawRectangle(...args));
  Bodies.circle = (...args)=>isolate(rawCircle(...args));
  if(rawFromVertices){
    Bodies.fromVertices = (...args)=>{
      const body = rawFromVertices(...args);
      if(Array.isArray(body)) return body.map(isolate);
      return isolate(body);
    };
  }

  window.PuppetalkPuppetCollisionIsolation = {
    version:1,
    category:PUPPET_CATEGORY,
    mask:NON_PUPPET_MASK
  };
})();
