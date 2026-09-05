import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./scene-renderer.js',import.meta.url),'utf8'),context,{filename:'scene-renderer.js'});
const api=context.window.PuppetalkSceneRenderer;
assert.ok(api?.create,'Scene renderer candidate did not install.');

class FakePath2D{constructor(d){this.d=d;}}
const documentRef={
  createElementNS(){
    return {
      d:'',setAttribute(name,value){if(name==='d')this.d=value;},
      getTotalLength(){return 72;},
      getPointAtLength(length){return {x:length,y:length*.25};}
    };
  }
};
const cleanCalls=[];
let displayCalls=0;
let scaleCalls=0;
const renderer=api.create({
  cleanLook:(look,slot)=>{cleanCalls.push([look,slot]);return {headStyle:'spikes',eyes:'dots',nose:'curve',mouth:'line',extra:'none',color:'#cf6c63'};},
  document:documentRef,Path2DClass:FakePath2D,
  getDisplayPoint:()=>((q,w,h)=>{displayCalls++;return {x:q.x*w+7,y:q.y*h+9};}),
  getProjectionRenderScale:()=>((w,h)=>{scaleCalls++;return Math.min(w/900,h/650);})
});
assert.ok(renderer?.drawBackdrop,'Scene renderer factory failed.');

assert.equal(renderer.puppetalkLegacyHeadStyle(null,'tuft'),'tufts');
assert.equal(renderer.puppetalkLegacyHeadStyle(null,'wave'),'swept');
assert.equal(renderer.puppetalkLegacyHeadStyle(null,'mop'),'scallop');
assert.equal(renderer.puppetalkLegacyHeadStyle(null,'cap'),'fringe');
assert.equal(renderer.puppetalkLegacyHeadStyle(null,'crop'),'spikes');
assert.equal(renderer.puppetalkLegacyHeadStyle('long',null),'tallSpikes');
assert.equal(renderer.puppetalkLegacyHeadStyle('wide',null),'burst');
assert.equal(renderer.puppetalkLegacyHeadStyle(null,null),'smooth');
assert.deepEqual(Array.from(renderer.PUPPETALK_LIVE_HEAD_STYLES),['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe']);
assert.equal(renderer.PUPPETALK_LIVE_EYE_NAMES.length,8);
assert.equal(renderer.PUPPETALK_LIVE_NOSE_NAMES.length,6);
assert.equal(renderer.PUPPETALK_LIVE_MOUTH_NAMES.length,8);
assert.deepEqual(Array.from(renderer.PUPPETALK_LIVE_EXTRAS),['none','glasses','moustache','freckles','eyepatch']);

const samples=renderer.puppetalkLiveMouthSamples('line');
assert.equal(samples.length,37,'Frozen mouth renderer samples 37 points.');
assert.equal(renderer.puppetalkLiveMouthSamples('line'),samples,'Mouth samples must remain cached by identity.');
assert.equal(renderer.puppetalkLiveMouthSamples('not-a-mouth'),samples,'Unknown mouth falls back to line cache.');

function makeCtx(nativeRoundRect=false){
  const calls=[];
  const gradient={addColorStop:(...args)=>calls.push(['addColorStop',...args])};
  const ctx={calls,
    clearRect:(...a)=>calls.push(['clearRect',...a]),createRadialGradient:(...a)=>{calls.push(['gradient',...a]);return gradient;},fillRect:(...a)=>calls.push(['fillRect',...a]),
    beginPath:()=>calls.push(['beginPath']),moveTo:(...a)=>calls.push(['moveTo',...a]),lineTo:(...a)=>calls.push(['lineTo',...a]),stroke:(...a)=>calls.push(['stroke',...a]),fill:()=>calls.push(['fill']),closePath:()=>calls.push(['closePath']),
    save:()=>calls.push(['save']),restore:()=>calls.push(['restore']),translate:(...a)=>calls.push(['translate',...a]),scale:(...a)=>calls.push(['scale',...a]),rotate:(...a)=>calls.push(['rotate',...a]),
    arc:(...a)=>calls.push(['arc',...a]),ellipse:(...a)=>calls.push(['ellipse',...a]),bezierCurveTo:(...a)=>calls.push(['bezierCurveTo',...a]),quadraticCurveTo:(...a)=>calls.push(['quadraticCurveTo',...a]),arcTo:(...a)=>calls.push(['arcTo',...a]),
    setLineDash:(...a)=>calls.push(['setLineDash',...a]),fillText:(...a)=>calls.push(['fillText',...a])
  };
  if(nativeRoundRect) ctx.roundRect=(...a)=>calls.push(['roundRect',...a]);
  for(const key of ['fillStyle','strokeStyle','lineWidth','lineCap','lineJoin','globalAlpha','font','textAlign']){
    Object.defineProperty(ctx,key,{set:value=>calls.push([key,value]),get:()=>undefined,configurable:true});
  }
  return ctx;
}

let ctx=makeCtx();
renderer.drawBackdrop(ctx,900,650);
assert.deepEqual(ctx.calls[0],['clearRect',0,0,900,650]);
assert.deepEqual(ctx.calls.filter(c=>c[0]==='addColorStop'),[
  ['addColorStop',0,'#292b30'],['addColorStop',.48,'#17191c'],['addColorStop',1,'#0c0d0f']
]);
assert.ok(ctx.calls.some(c=>c[0]==='fillRect'&&c[3]===900&&c[4]===650));
assert.ok(ctx.calls.filter(c=>c[0]==='stroke').length>10,'Backdrop keeps perspective/grid strokes.');

const nativeCtx=makeCtx(true);
renderer.roundRect(nativeCtx,1,2,30,20,7);
assert.ok(nativeCtx.calls.some(c=>c[0]==='roundRect'),'Native roundRect must be preferred.');
assert.equal(nativeCtx.calls.some(c=>c[0]==='arcTo'),false);
const fallbackCtx=makeCtx(false);
renderer.roundRect(fallbackCtx,1,2,30,20,7);
assert.equal(fallbackCtx.calls.filter(c=>c[0]==='arcTo').length,4,'Fallback roundRect keeps four rounded corners.');

renderer.drawAnatomy(makeCtx(),null,900,650);
assert.equal(cleanCalls.length,0,'Missing anatomy must return before look cleaning.');

const q=(x,y,a=0)=>({x,y,a});
const puppet={
  slot:3,name:'Vale',color:'#729d78',mouth:1,look:{eyes:'anything'},
  torso:q(.5,.5),head:q(.5,.25),
  hl:q(.46,.62),hr:q(.54,.62),kl:q(.44,.78),kr:q(.56,.78),al:q(.43,.91),ar:q(.57,.91),
  sl:q(.44,.4),sr:q(.56,.4),el:q(.37,.52),er:q(.63,.52),wl:q(.30,.61),wr:q(.70,.61)
};
ctx=makeCtx(true);
renderer.drawAnatomy(ctx,puppet,900,650,true,.8);
assert.equal(cleanCalls.length,1);
assert.equal(cleanCalls[0][0],puppet.look);
assert.equal(cleanCalls[0][1],3);
assert.ok(ctx.calls.some(c=>c[0]==='setLineDash'&&Array.isArray(c[1])&&c[1][0]===6),'Highlight keeps dashed own-puppet ring.');
assert.ok(ctx.calls.some(c=>c[0]==='fillText'&&c[1]==='Vale · YOU'),'Highlighted puppet keeps YOU label.');
assert.ok(ctx.calls.some(c=>c[0]==='stroke'&&c[1] instanceof FakePath2D),'Face eyes/nose continue using Path2D.');

const cleanBeforeSplit=cleanCalls.length;
const split={...puppet,brokenSeams:['headMiddle'],segHeadLower:q(.5,.28),segHeadTop:q(.5,.20)};
ctx=makeCtx(true);
renderer.drawAnatomy(ctx,split,900,650,false,1);
assert.equal(cleanCalls.length,cleanBeforeSplit,'Broken head returns before face/look rendering.');
assert.ok(ctx.calls.filter(c=>c[0]==='roundRect').length>=2,'Broken head renders both head segments.');
assert.equal(ctx.calls.some(c=>c[0]==='fillText'),false,'Broken head path returns before name label exactly as V1.');

function drawProp(type,extra={}){
  const prop={id:type,type,x:.4,y:.5,a:.2,...extra};
  const propCtx=makeCtx(true);
  const beforeDisplay=displayCalls,beforeScale=scaleCalls;
  renderer.drawProp(propCtx,prop,900,650);
  assert.ok(displayCalls>beforeDisplay,'Prop renderer uses the display projection when available.');
  assert.ok(scaleCalls>beforeScale,'Prop renderer uses projection render scale when available.');
  return propCtx.calls;
}
let calls=drawProp('ball');
assert.ok(calls.filter(c=>c[0]==='arc').length>=3,'Ball keeps three-circle rendering.');
calls=drawProp('balloon',{scale:.8});
assert.ok(calls.some(c=>c[0]==='quadraticCurveTo'),'Loose balloon keeps string curve.');
calls=drawProp('balloon',{scale:.8,attachedTo:{mode:'balloon',anchor:{x:.2,y:.3}}});
assert.ok(calls.some(c=>c[0]==='quadraticCurveTo'),'Attached balloon keeps anchor string curve.');
calls=drawProp('pump');
assert.ok(calls.filter(c=>c[0]==='roundRect').length>=3,'Pump keeps layered rounded body.');
calls=drawProp('frisbee',{armed:true});
assert.ok(calls.some(c=>c[0]==='strokeStyle'&&c[1]==='#ff4b5c'));
assert.ok(calls.some(c=>c[0]==='strokeStyle'&&c[1]==='#ff7b86'));
calls=drawProp('dart');
assert.ok(calls.some(c=>c[0]==='moveTo'&&c[1]<0),'Dart fallback keeps shaft rendering.');
calls=drawProp('ball',{heldBy:{slot:1,hand:'left'}});
assert.ok(calls.some(c=>c[0]==='strokeStyle'&&c[1]==='rgba(255,255,255,.7)'),'Held prop keeps white ownership ring.');

console.log('Shared scene renderer candidate preserves V1 backdrop, live face helpers, mouth sampling/cache, anatomy split/highlight semantics, prop branches/projection and rounded geometry.');
