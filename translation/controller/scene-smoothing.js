(function(root){
  'use strict';

  const DEFAULT_RESPONSE_MS=46;
  const SMOOTH_NUMBERS=new Set([
    'x','y','a','depth','visualScale','viewDepth','viewScale','inflation','scale','tug'
  ]);

  function cloneValue(value){
    if(Array.isArray(value)) return value.map(cloneValue);
    if(value && typeof value==='object'){
      const out={};
      for(const [key,next] of Object.entries(value)) out[key]=cloneValue(next);
      return out;
    }
    return value;
  }

  function angleToward(from,to,alpha){
    const tau=Math.PI*2;
    let delta=(to-from)%tau;
    if(delta>Math.PI) delta-=tau;
    if(delta< -Math.PI) delta+=tau;
    return from+delta*alpha;
  }

  function blendValue(current,target,key,alpha){
    if(typeof target==='number' && Number.isFinite(target) && typeof current==='number' && Number.isFinite(current) && SMOOTH_NUMBERS.has(key)){
      return key==='a'?angleToward(current,target,alpha):current+(target-current)*alpha;
    }
    if(target && typeof target==='object' && !Array.isArray(target)){
      const source=current && typeof current==='object' && !Array.isArray(current)?current:{};
      const out={};
      for(const [childKey,next] of Object.entries(target)) out[childKey]=blendValue(source[childKey],next,childKey,alpha);
      return out;
    }
    return cloneValue(target);
  }

  function blendList(current,target,keyName,alpha){
    const currentByKey=new Map((current||[]).map(item=>[item?.[keyName],item]));
    return (target||[]).map(item=>{
      const key=item?.[keyName];
      const before=currentByKey.get(key);
      return before?blendValue(before,item,'entity',alpha):cloneValue(item);
    });
  }

  function create(options={}){
    const now=typeof options.now==='function'?options.now:()=>root.performance?.now?.()||Date.now();
    const responseMs=Number.isFinite(options.responseMs)&&options.responseMs>0?options.responseMs:DEFAULT_RESPONSE_MS;
    let target={puppets:[],props:[]};
    let presented=null;
    let lastSample=null;

    function pushScene(scene={}){
      target={
        puppets:Array.isArray(scene.puppets)?scene.puppets:[],
        props:Array.isArray(scene.props)?scene.props:[]
      };
      if(!presented){
        presented=cloneValue(target);
        lastSample=now();
      }
      return target;
    }

    function sample(time=now()){
      if(!presented){
        presented=cloneValue(target);
        lastSample=time;
        return presented;
      }
      const previous=Number.isFinite(lastSample)?lastSample:time;
      const dt=Math.max(0,Math.min(100,time-previous));
      lastSample=time;
      if(dt<=0) return presented;
      const alpha=1-Math.exp(-dt/responseMs);
      presented={
        puppets:blendList(presented.puppets,target.puppets,'slot',alpha),
        props:blendList(presented.props,target.props,'id',alpha)
      };
      return presented;
    }

    function snap(){
      presented=cloneValue(target);
      lastSample=now();
      return presented;
    }

    return {pushScene,sample,snap,getTarget:()=>target,getPresented:()=>presented||target,responseMs};
  }

  root.PuppetalkControllerSceneSmoothing={create,cloneValue,blendValue,angleToward,DEFAULT_RESPONSE_MS};
})(typeof window!=='undefined'?window:globalThis);
