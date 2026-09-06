import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} marker.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} marker.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

const start='async function latestWalkingScene(cdp){';
const end='\nasync function exerciseDepthGestures(controller,stage,label){';
const a=source.indexOf(start);
const b=source.indexOf(end,a);
if(a<0||b<0) throw new Error('Could not locate walking parity block.');
if(source.indexOf(start,a+start.length)>=0) throw new Error('Walking parity block is ambiguous.');

const replacement=String.raw`async function installStageWalkingProbe(stage,label){
  await evaluate(stage,
    `(()=>{
      if(window.__PUPPETALK_PARITY_ENGINE_PROBE__)return true;
      const M=window.Matter;
      if(!M?.Engine?.update)return false;
      const raw=M.Engine.update;
      M.Engine.update=function(engine,...args){
        window.__PUPPETALK_PARITY_ENGINE__=engine;
        return raw.call(this,engine,...args);
      };
      window.__PUPPETALK_PARITY_ENGINE_PROBE__=true;
      return true;
    })()`
  );
  await waitEval(stage,`!!window.__PUPPETALK_PARITY_ENGINE__`,`${label} stage walking engine`,4000);
}

async function stageWalkingState(stage){
  return evaluate(stage,`(()=>{
    const engine=window.__PUPPETALK_PARITY_ENGINE__;
    if(!engine?.world?.bodies)return null;
    const bodies=engine.world.bodies.filter(b=>!b.isStatic&&b.plugin?.puppetalkPart);
    const part=name=>bodies.find(b=>b.plugin?.puppetalkPart===name);
    const torso=part('torso'),left=part('shL'),right=part('shR');
    if(!torso||!left||!right)return null;
    const end=(body,length=25)=>({
      x:body.position.x-Math.sin(body.angle)*length,
      y:body.position.y+Math.cos(body.angle)*length
    });
    const canvas=document.querySelector('canvas');
    const W=Math.max(1,canvas?.clientWidth||canvas?.width||1024);
    const H=Math.max(1,canvas?.clientHeight||canvas?.height||768);
    const l=end(left),r=end(right);
    return {
      torso:{x:torso.position.x/W,y:torso.position.y/H},
      al:{x:l.x/W,y:l.y/H},
      ar:{x:r.x/W,y:r.y/H}
    };
  })()`);
}

async function exerciseWalking(controller,stage,label){
  await installStageWalkingProbe(stage,label);
  const startScene=await waitEval(stage,`(()=>{
    const engine=window.__PUPPETALK_PARITY_ENGINE__;
    if(!engine?.world?.bodies)return null;
    const bodies=engine.world.bodies.filter(b=>!b.isStatic&&b.plugin?.puppetalkPart);
    const part=name=>bodies.find(b=>b.plugin?.puppetalkPart===name);
    const torso=part('torso'),left=part('shL'),right=part('shR');
    if(!torso||!left||!right)return null;
    const end=(body,length=25)=>({x:body.position.x-Math.sin(body.angle)*length,y:body.position.y+Math.cos(body.angle)*length});
    const canvas=document.querySelector('canvas');
    const W=Math.max(1,canvas?.clientWidth||canvas?.width||1024),H=Math.max(1,canvas?.clientHeight||canvas?.height||768);
    const l=end(left),r=end(right);
    return {torso:{x:torso.position.x/W,y:torso.position.y/H},al:{x:l.x/W,y:l.y/H},ar:{x:r.x/W,y:r.y/H}};
  })()`,`${label} walking start stage state`);

  const canvas=await evaluate(controller,`(()=>{const r=document.querySelector('#personal-canvas')?.getBoundingClientRect();return r?{left:r.left,top:r.top,width:r.width,height:r.height}:null;})()`);
  if(!canvas)throw new Error(`${label} walking canvas unavailable.`);
  const controllerTorso=await latestTorsoScreenPoint(controller);
  if(!controllerTorso)throw new Error(`${label} walking controller torso unavailable.`);
  const sx=controllerTorso.x,sy=controllerTorso.y;
  const targetX=Math.min(canvas.left+canvas.width-24,sx+Math.max(190,canvas.width*.24));
  const traceStart=await traceLength(controller);
  const samples=[startScene];

  await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:sx,y:sy,button:'left',buttons:1,clickCount:1});
  const down=await waitInput(controller,traceStart,"e.input.grabs?.some(g=>g.part==='torso')",`${label} walking torso press`);
  const downGrab=(down.grabs||[]).find(g=>g.part==='torso');

  let moveGrab=null;
  for(let i=1;i<=9;i++){
    const t=i/9;
    const x=sx+(targetX-sx)*t;
    const moveStart=await traceLength(controller);
    await controller.call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y:sy,button:'left',buttons:1});
    const moved=await waitInput(controller,moveStart,"e.input.grabs?.some(g=>g.part==='torso')",`${label} walking torso move ${i}`);
    moveGrab=(moved.grabs||[]).find(g=>g.part==='torso');
    await sleep(65);
    const sample=await stageWalkingState(stage);
    if(sample)samples.push(sample);
  }
  for(let i=0;i<9;i++){
    await sleep(60);
    const sample=await stageWalkingState(stage);
    if(sample)samples.push(sample);
  }
  const releaseStart=await traceLength(controller);
  await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:targetX,y:sy,button:'left',buttons:0,clickCount:1});
  await waitInput(controller,releaseStart,"e.input.grabs?.length===0",`${label} walking torso release`);
  for(let i=0;i<5;i++){
    await sleep(60);
    const sample=await stageWalkingState(stage);
    if(sample)samples.push(sample);
  }

  let torsoDx=-Infinity,leftTravel=0,rightTravel=0,leftLift=0,rightLift=0;
  for(const p of samples){
    torsoDx=Math.max(torsoDx,Number(p.torso.x)-Number(startScene.torso.x));
    leftTravel=Math.max(leftTravel,Math.abs(Number(p.al.x)-Number(startScene.al.x)));
    rightTravel=Math.max(rightTravel,Math.abs(Number(p.ar.x)-Number(startScene.ar.x)));
    leftLift=Math.max(leftLift,Number(startScene.al.y)-Number(p.al.y));
    rightLift=Math.max(rightLift,Number(startScene.ar.y)-Number(p.ar.y));
  }
  const dragDx=(moveGrab?.x||0)-(downGrab?.x||0);
  return {
    input:{part:downGrab?.part||null,dx:round(dragDx),screenY:Number.isFinite(moveGrab?.screenY)},
    observed:{
      torsoRight:torsoDx>.02,
      footTravel:Math.max(leftTravel,rightTravel)>.012,
      footLift:Math.max(leftLift,rightLift)>.004
    },
    sample:{torsoDx:round(torsoDx),footTravel:round(Math.max(leftTravel,rightTravel)),footLift:round(Math.max(leftLift,rightLift)),sceneCount:samples.length}
  };
}
`;
source=source.slice(0,a)+replacement+source.slice(b);
replaceOnce(
  'walking stage argument',
  '  const walking=await exerciseWalking(controller,label);',
  '  const walking=await exerciseWalking(controller,stage,label);'
);
fs.writeFileSync(path,source);
console.log('Moved walking parity observation to stage-side Matter bodies.');
