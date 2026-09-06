import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} marker.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} marker.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

replaceOnce(
  'scene ankle trace',
  "        torso:p?.torso?{x:Number(p.torso.x),y:Number(p.torso.y),a:Number(p.torso.a||0)}:null,\n        depth:Number.isFinite(p?.depth)?Number(p.depth):null,",
  "        torso:p?.torso?{x:Number(p.torso.x),y:Number(p.torso.y),a:Number(p.torso.a||0)}:null,\n        al:p?.al?{x:Number(p.al.x),y:Number(p.al.y)}:null,\n        ar:p?.ar?{x:Number(p.ar.x),y:Number(p.ar.y)}:null,\n        depth:Number.isFinite(p?.depth)?Number(p.depth):null,"
);

const depthMarker='async function exerciseDepthGestures(controller,stage,label){';
const depthAt=source.indexOf(depthMarker);
if(depthAt<0) throw new Error('Missing depth gesture function marker.');
if(source.indexOf(depthMarker,depthAt+depthMarker.length)>=0) throw new Error('Ambiguous depth gesture function marker.');

const walking=`async function latestWalkingScene(cdp){
  return evaluate(cdp,\`(()=>{
    const trace=window.__PUPPETALK_PARITY_TRACE__||[];
    for(let i=trace.length-1;i>=0;i--){
      const e=trace[i];
      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;
      const p=e.scene.puppets?.find(p=>p.slot===0);
      if(p?.torso&&p?.al&&p?.ar)return {torso:p.torso,al:p.al,ar:p.ar};
    }
    return null;
  })()\`);
}

async function exerciseWalking(controller,label){
  const startScene=await waitEval(controller,\`(()=>{
    const trace=window.__PUPPETALK_PARITY_TRACE__||[];
    for(let i=trace.length-1;i>=0;i--){
      const e=trace[i];
      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;
      const p=e.scene.puppets?.find(p=>p.slot===0);
      if(p?.torso&&p?.al&&p?.ar)return {torso:p.torso,al:p.al,ar:p.ar};
    }
    return null;
  })()\`,\`\${label} walking start scene\`);
  const canvas=await evaluate(controller,\`(()=>{const r=document.querySelector('#personal-canvas')?.getBoundingClientRect();return r?{left:r.left,top:r.top,width:r.width,height:r.height}:null;})()\`);
  if(!canvas)throw new Error(\`\${label} walking canvas unavailable.\`);

  const sx=canvas.left+startScene.torso.x*canvas.width;
  const sy=canvas.top+startScene.torso.y*canvas.height;
  const targetX=Math.min(canvas.left+canvas.width-24,sx+Math.max(190,canvas.width*.24));
  const traceStart=await traceLength(controller);
  await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:sx,y:sy,button:'left',buttons:1,clickCount:1});
  const down=await waitInput(controller,traceStart,"e.input.grabs?.some(g=>g.part==='torso')",\`\${label} walking torso press\`);
  const downGrab=normalizeInput(down).grabs.find(g=>g.part==='torso');

  let moveGrab=null;
  for(let i=1;i<=9;i++){
    const t=i/9;
    const x=sx+(targetX-sx)*t;
    const moveStart=await traceLength(controller);
    await controller.call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y:sy,button:'left',buttons:1});
    const moved=await waitInput(controller,moveStart,"e.input.grabs?.some(g=>g.part==='torso')",\`\${label} walking torso move \${i}\`);
    moveGrab=normalizeInput(moved).grabs.find(g=>g.part==='torso');
    await sleep(65);
  }
  await sleep(520);
  const releaseStart=await traceLength(controller);
  await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:targetX,y:sy,button:'left',buttons:0,clickCount:1});
  await waitInput(controller,releaseStart,"e.input.grabs?.length===0",\`\${label} walking torso release\`);
  await sleep(260);

  const scenes=await evaluate(controller,\`(()=>{
    const out=[];
    for(const e of (window.__PUPPETALK_PARITY_TRACE__||[]).slice(\${traceStart})){
      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;
      const p=e.scene.puppets?.find(p=>p.slot===0);
      if(p?.torso&&p?.al&&p?.ar)out.push({torso:p.torso,al:p.al,ar:p.ar});
    }
    return out;
  })()\`);
  if(!Array.isArray(scenes)||!scenes.length)throw new Error(\`\${label} walking produced no scene samples.\`);

  let torsoDx=-Infinity,leftTravel=0,rightTravel=0,leftLift=0,rightLift=0;
  for(const p of scenes){
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
    sample:{torsoDx:round(torsoDx),footTravel:round(Math.max(leftTravel,rightTravel)),footLift:round(Math.max(leftLift,rightLift)),sceneCount:scenes.length}
  };
}

`;
source=source.slice(0,depthAt)+walking+source.slice(depthAt);

replaceOnce(
  'live session depth order',
  "  // Run depth first on a fresh connected puppet. The mature controller's torso\n  // interactions can leave gesture-derived sends in flight, so ordering this\n  // contract first prevents cross-test contamination without changing behavior.\n  const depth=await exerciseDepthGestures(controller,stage,label);\n  const controls=await exerciseCoreControls(controller,label);",
  "  // Exercise walking before depth so the locomotion contract starts from an\n  // untouched neutral-depth puppet. The substantial horizontal travel also\n  // exceeds the depth gesture's movement cancellation threshold.\n  const walking=await exerciseWalking(controller,label);\n  const depth=await exerciseDepthGestures(controller,stage,label);\n  const controls=await exerciseCoreControls(controller,label);"
);

replaceOnce(
  'live session state walking field',
  "    controls,\n    depth,",
  "    controls,\n    walking,\n    depth,"
);

replaceOnce(
  'parity console summary',
  "Stage/controller handshake, pose/ragdoll controls, centre pulse, direct torso drag, discrete depth gestures and frozen special-item behavior: pass",
  "Stage/controller handshake, body-drag walking, pose/ragdoll controls, centre pulse, direct torso drag, discrete depth gestures and frozen special-item behavior: pass"
);

fs.writeFileSync(path,source);
console.log('Added mature body-drag walking browser parity measurement.');
