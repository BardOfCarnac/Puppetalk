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
  'scene wrist trace fields',
  "        ar:p?.ar?{x:Number(p.ar.x),y:Number(p.ar.y)}:null,",
  [
    "        ar:p?.ar?{x:Number(p.ar.x),y:Number(p.ar.y)}:null,",
    "        wl:p?.wl?{x:Number(p.wl.x),y:Number(p.wl.y)}:null,",
    "        wr:p?.wr?{x:Number(p.wr.x),y:Number(p.wr.y)}:null,"
  ].join('\n')
);

const handHelper=[
  '',
  'async function latestHandScreenPoints(cdp){',
  '  return evaluate(cdp,`(()=>{',
  '    const trace=window.__PUPPETALK_PARITY_TRACE__||[];',
  '    let puppet=null;',
  '    for(let i=trace.length-1;i>=0&&!puppet;i--){',
  '      const e=trace[i];',
  "      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;",
  '      const p=e.scene.puppets?.find(p=>p.slot===0);',
  '      if(p?.wl&&p?.wr)puppet=p;',
  '    }',
  "    const r=document.querySelector('#personal-canvas')?.getBoundingClientRect();",
  '    if(!puppet||!r)return null;',
  '    const screen=q=>({x:r.left+q.x*r.width,y:r.top+q.y*r.height});',
  '    return {',
  '      left:screen(puppet.wl),right:screen(puppet.wr),',
  '      rect:{left:r.left,top:r.top,width:r.width,height:r.height}',
  '    };',
  '  })()`);',
  '}',
  ''
].join('\n');
replaceOnce('hand screen helper insertion','\nasync function waitDepthScene',handHelper+'async function waitDepthScene');

const multiTouch=[
  'async function exerciseMultiTouch(controller,label){',
  "  await controller.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});",
  '  const geometry=await latestHandScreenPoints(controller);',
  '  if(!geometry)throw new Error(`${label} could not resolve hand/canvas geometry for multi-touch.`);',
  '  const {left,right,rect}=geometry;',
  '  const clampX=x=>Math.max(rect.left+18,Math.min(rect.left+rect.width-18,x));',
  '  const clampY=y=>Math.max(rect.top+18,Math.min(rect.top+rect.height-18,y));',
  '  const l2={x:clampX(left.x-38),y:clampY(left.y+12)};',
  '  const r2={x:clampX(right.x+38),y:clampY(right.y-12)};',
  '  const point=(id,p)=>({id,x:p.x,y:p.y,radiusX:2,radiusY:2,force:1});',
  '',
  '  const downStart=await traceLength(controller);',
  "  await controller.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(11,left),point(12,right)]});",
  "  const downRaw=await waitInput(controller,downStart,\"e.input.grabs?.length===2&&e.input.grabs.some(g=>g.part==='leftHand')&&e.input.grabs.some(g=>g.part==='rightHand')\",`${label} two-hand touch down`,5000);",
  '',
  '  const moveStart=await traceLength(controller);',
  "  await controller.call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(11,l2),point(12,r2)]});",
  "  const moveRaw=await waitInput(controller,moveStart,\"e.input.grabs?.length===2&&e.input.grabs.some(g=>g.part==='leftHand')&&e.input.grabs.some(g=>g.part==='rightHand')\",`${label} two-hand touch move`,5000);",
  '',
  '  const upStart=await traceLength(controller);',
  "  await controller.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});",
  "  const upRaw=await waitInput(controller,upStart,\"e.input.grabs?.length===0\",`${label} two-hand touch release`,5000);",
  "  await controller.call('Emulation.setTouchEmulationEnabled',{enabled:false});",
  '',
  '  const down=normalizeInput(downRaw),move=normalizeInput(moveRaw),up=normalizeInput(upRaw);',
  "  const dl=down.grabs.find(g=>g.part==='leftHand'),dr=down.grabs.find(g=>g.part==='rightHand');",
  "  const ml=move.grabs.find(g=>g.part==='leftHand'),mr=move.grabs.find(g=>g.part==='rightHand');",
  '  return {',
  '    down:{parts:down.grabs.map(g=>g.part).sort(),grabCount:down.grabs.length},',
  '    move:{',
  '      parts:move.grabs.map(g=>g.part).sort(),grabCount:move.grabs.length,',
  '      leftMovedLeft:Number(ml?.x)<Number(dl?.x)-.01,',
  '      rightMovedRight:Number(mr?.x)>Number(dr?.x)+.01',
  '    },',
  '    up:{grabCount:up.grabs.length}',
  '  };',
  '}',
  ''
].join('\n');
replaceOnce('multi-touch function insertion','\nasync function exerciseCoreControls', '\n'+multiTouch+'async function exerciseCoreControls');

replaceOnce(
  'multi-touch exercise call',
  [
    '  out.pointerGrab={',
    '    down:{pose:down.pose,poseVersion:down.poseVersion,rag:down.rag,mouth:down.mouth,part:downGrab?.part||null,grabCount:down.grabs.length},',
    '    move:{part:moveGrab?.part||null,grabCount:move.grabs.length,dx:round((moveGrab?.x||0)-(downGrab?.x||0)),dy:round((moveGrab?.y||0)-(downGrab?.y||0))},',
    '    up:{pose:up.pose,poseVersion:up.poseVersion,rag:up.rag,mouth:up.mouth,grabCount:up.grabs.length}',
    '  };',
    '  return out;'
  ].join('\n'),
  [
    '  out.pointerGrab={',
    '    down:{pose:down.pose,poseVersion:down.poseVersion,rag:down.rag,mouth:down.mouth,part:downGrab?.part||null,grabCount:down.grabs.length},',
    '    move:{part:moveGrab?.part||null,grabCount:move.grabs.length,dx:round((moveGrab?.x||0)-(downGrab?.x||0)),dy:round((moveGrab?.y||0)-(downGrab?.y||0))},',
    '    up:{pose:up.pose,poseVersion:up.poseVersion,rag:up.rag,mouth:up.mouth,grabCount:up.grabs.length}',
    '  };',
    '  out.multiTouch=await exerciseMultiTouch(controller,label);',
    '  return out;'
  ].join('\n')
);

replaceOnce(
  'multi-touch explicit contract',
  [
    '  for(const [label,state] of [[\'original\',original],[\'translated\',translated]]){',
    '    const walk=state.walking;',
    "    if(walk?.input?.part!=='torso'||walk.input.screenY!==true||Math.abs(Number(walk.input.dx))<.15||!walk.observed?.torsoRight||!walk.observed?.footTravel||!walk.observed?.footLift){",
    '      throw new Error(`${label} body-drag walking behavior was not observed: ${JSON.stringify(walk)}`);',
    '    }',
    '  }'
  ].join('\n'),
  [
    '  for(const [label,state] of [[\'original\',original],[\'translated\',translated]]){',
    '    const walk=state.walking;',
    "    if(walk?.input?.part!=='torso'||walk.input.screenY!==true||Math.abs(Number(walk.input.dx))<.15||!walk.observed?.torsoRight||!walk.observed?.footTravel||!walk.observed?.footLift){",
    '      throw new Error(`${label} body-drag walking behavior was not observed: ${JSON.stringify(walk)}`);',
    '    }',
    '    const touch=state.controls?.multiTouch;',
    "    if(touch?.down?.grabCount!==2||touch?.down?.parts?.join(',')!=='leftHand,rightHand'||touch?.move?.grabCount!==2||!touch.move.leftMovedLeft||!touch.move.rightMovedRight||touch?.up?.grabCount!==0){",
    '      throw new Error(`${label} two-pointer grab behavior was not observed: ${JSON.stringify(touch)}`);',
    '    }',
    '  }'
  ].join('\n')
);

replaceOnce(
  'parity success summary',
  "  console.log('Stage/controller handshake, body-drag walking, pose/ragdoll controls, centre pulse, direct torso drag, discrete depth gestures and frozen special-item behavior: pass');",
  "  console.log('Stage/controller handshake, body-drag walking, pose/ragdoll controls, centre pulse, direct torso drag, two-pointer grabbing, discrete depth gestures and frozen special-item behavior: pass');"
);

fs.writeFileSync(path,source);
console.log('Added two-pointer browser parity using genuine Chrome touch contacts.');
