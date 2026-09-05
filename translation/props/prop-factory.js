(function(root){
  'use strict';

  function create({Bodies,Composite,engine,props,getDimensions}){
    let nextPropId = 1;

    function makeProp(type,x,y){
      const id = `prop-${nextPropId++}`;
      let body;
      let gripPoint = {x:0,y:0};
      if(type === 'ball'){
        body = Bodies.circle(x,y,16,{density:.0008,restitution:.9,friction:.24,frictionAir:.006});
      }else if(type === 'balloon'){
        body = Bodies.circle(x,y,18,{density:.00018,restitution:.38,friction:.18,frictionAir:.028});
      }else if(type === 'frisbee'){
        body = Bodies.circle(x,y,23,{density:.00062,restitution:.72,friction:.18,frictionAir:.004});
        gripPoint = {x:-15,y:0};
      }else if(type === 'pump'){
        body = Bodies.rectangle(x,y,44,60,{isStatic:true,restitution:.05,friction:.9,chamfer:{radius:5}});
        gripPoint = {x:0,y:0};
      }else{
        body = Bodies.rectangle(x,y,44,6,{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});
        gripPoint = {x:-13,y:0};
      }
      body.label = `puppetalk-prop:${id}:${type}`;
      const prop = {id,type,body,gripPoint,heldBy:null,contest:null,attachedTo:null};
      props.set(id,prop);
      Composite.add(engine.world,body);
      return prop;
    }

    function ensureTestProps(){
      // A normal table begins empty; players introduce their own item deliberately.
    }

    function ensureLegacyTestProps(){
      if(props.size) return;
      const {W,H} = getDimensions();
      const y = Math.max(82,Math.min(H*.38,H-180));
      makeProp('ball',W*.34,y);
      for(let i=0;i<6;i++) makeProp('dart',W*(.45+i*.045),y+18+(i%2)*20);
      makeProp('frisbee',W*.59,y-34);
      makeProp('pump',W*.73,H-68);
    }

    return {makeProp,ensureTestProps,ensureLegacyTestProps};
  }

  root.PuppetalkPropFactory = {create};
})(typeof window !== 'undefined' ? window : globalThis);
