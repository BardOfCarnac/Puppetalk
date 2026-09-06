import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(from,to,label){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} anchor.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} anchor.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

replaceOnce(
`    message:data?.message||null,
    input:data?.type==='input'?{`,
`    message:data?.message||null,
    direction:Number.isFinite(data?.direction)?Number(data.direction):null,
    input:data?.type==='input'?{`,
'fake transport direction trace'
);

replaceOnce(
`      grabs:Array.isArray(data.input?.grabs)?data.input.grabs.map(g=>({part:g?.part||null,x:Number(g?.x),y:Number(g?.y)})):[]`,
`      grabs:Array.isArray(data.input?.grabs)?data.input.grabs.map(g=>({
        part:g?.part||null,
        x:Number(g?.x),
        y:Number(g?.y),
        screenY:Number.isFinite(g?.screenY)?Number(g.screenY):null
      })):[]`,
'input screenY trace'
);

replaceOnce(
`      puppets:Array.isArray(data.puppets)?data.puppets.map(p=>({slot:p?.slot,torso:p?.torso?{x:Number(p.torso.x),y:Number(p.torso.y),a:Number(p.torso.a||0)}:null})):[],`,
`      puppets:Array.isArray(data.puppets)?data.puppets.map(p=>({
        slot:p?.slot,
        torso:p?.torso?{x:Number(p.torso.x),y:Number(p.torso.y),a:Number(p.torso.a||0)}:null,
        depth:Number.isFinite(p?.depth)?Number(p.depth):null,
        visualScale:Number.isFinite(p?.visualScale)?Number(p.visualScale):null,
        depthPlane:Number.isInteger(p?.depthPlane)?p.depthPlane:null
      })):[],`,
'scene depth trace'
);

const geometryAnchor=`async function exerciseCoreControls(controller,label){`;
const depthHelpers=`async function latestTorsoScreenPoint(cdp){
  return evaluate(cdp,\`(()=>{
    const trace=window.__PUPPETALK_PARITY_TRACE__||[];
    let torso=null;
    for(let i=trace.length-1;i>=0&&!torso;i--){
      const e=trace[i];
      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;
      const p=e.scene.puppets?.find(p=>p.slot===0);
      if(p?.torso)torso=p.torso;
    }
    const r=document.querySelector('#personal-canvas')?.getBoundingClientRect();
    if(!torso||!r)return null;
    const stageH=r.width*(360/320);
    const offsetY=r.height*.79-stageH*.90;
    return {
      x:r.left+torso.x*r.width,
      y:r.top+offsetY+torso.y*stageH
    };
  })()\`);
}

async function waitDepthScene(cdp,start,plane,extra,label,timeout=3500){
  return waitEval(cdp,\`(()=>{
    const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(\${start});
    for(const e of entries){
      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;
      const p=e.scene.puppets?.find(p=>p.slot===0);
      if(p&&p.depthPlane===\${plane}&&(\${extra})){
        return {depthPlane:p.depthPlane,depth:Number(p.depth),visualScale:Number(p.visualScale)};
      }
    }
    return null;
  })()\`,label,timeout);
}

async function exerciseDepthGestures(controller,label){
  await waitEval(controller,\`(document.querySelector('.depth-gesture-guide')?.textContent||'').includes('3 quick taps')\`,\`\${label} depth gesture guide\`);
  const guide=await evaluate(controller,\`(document.querySelector('.depth-gesture-guide')?.textContent||'').trim()\`);
  let point=await latestTorsoScreenPoint(controller);
  if(!point)throw new Error(\`\${label} could not resolve torso screen point for depth gesture.\`);

  const closerStart=await traceLength(controller);
  for(let i=0;i<3;i++){
    await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
    await sleep(35);
    await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
    await sleep(45);
  }
  await waitEval(controller,\`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(\${closerStart}).some(e=>e.event==='send'&&e.type==='depth-step'&&e.direction===1)\`,\`\${label} closer depth-step\`);
  const closer=await waitDepthScene(controller,closerStart,5,\`Number(p.depth)>.005&&Number(p.visualScale)>1\`,\`\${label} closer depth plane\`);

  point=await latestTorsoScreenPoint(controller);
  if(!point)throw new Error(\`\${label} could not resolve torso screen point after moving closer.\`);
  const awayStart=await traceLength(controller);
  await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
  await sleep(300);
  await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
  await waitEval(controller,\`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(\${awayStart}).some(e=>e.event==='send'&&e.type==='depth-step'&&e.direction===-1)\`,\`\${label} away depth-step\`);
  const away=await waitDepthScene(controller,awayStart,4,\`Math.abs(Number(p.depth))<.02&&Math.abs(Number(p.visualScale)-1)<.04\`,\`\${label} neutral depth plane return\`,5000);

  return {
    guide,
    closer:{direction:1,plane:closer.depthPlane,depthPositive:closer.depth>0,scaleAboveOne:closer.visualScale>1},
    away:{direction:-1,plane:away.depthPlane,nearNeutral:Math.abs(away.depth)<.02,scaleNearOne:Math.abs(away.visualScale-1)<.04}
  };
}

`;
replaceOnce(geometryAnchor,depthHelpers+geometryAnchor,'depth helper insertion');

replaceOnce(
`  const controls=await exerciseCoreControls(controller,label);\n\n  const specialStart=await traceLength(controller);`,
`  const controls=await exerciseCoreControls(controller,label);\n  const depth=await exerciseDepthGestures(controller,label);\n\n  const specialStart=await traceLength(controller);`,
'depth exercise call'
);

replaceOnce(
`    controls,\n    beforeButton:before.buttonText,`,
`    controls,\n    depth,\n    beforeButton:before.buttonText,`,
'depth state output'
);

replaceOnce(
`  console.log('Stage/controller handshake, complete pose/ragdoll message sequences, centre pulse, direct torso drag and frozen special-item behavior: pass');`,
`  console.log('Stage/controller handshake, pose/ragdoll controls, centre pulse, direct torso drag, discrete depth gestures and frozen special-item behavior: pass');`,
'pass summary'
);

fs.writeFileSync(path,source);
console.log('Extended live browser parity with mature quick-tap/long-tap depth-plane behavior.');
