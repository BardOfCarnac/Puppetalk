import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

const helperFrom=`async function latestPropAndCanvas(cdp,propId){
  return evaluate(cdp,\`(()=>{
    const trace=window.__PUPPETALK_PARITY_TRACE__||[];
    let prop=null;
    for(let i=trace.length-1;i>=0&&!prop;i--){
      const e=trace[i];
      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;
      const q=e.scene.props?.find(p=>p.id===\${JSON.stringify(propId)});
      if(q)prop=q;
    }
    const r=document.querySelector('#personal-canvas')?.getBoundingClientRect();
    return prop&&r?{prop,rect:{left:r.left,top:r.top,width:r.width,height:r.height}}:null;
  })()\`);
}
`;
const helperTo=`async function latestPropAndCanvas(cdp,propId){
  return evaluate(cdp,\`(()=>{
    const trace=window.__PUPPETALK_PARITY_TRACE__||[];
    let prop=null;
    for(let i=trace.length-1;i>=0&&!prop;i--){
      const e=trace[i];
      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;
      const q=e.scene.props?.find(p=>p.id===\${JSON.stringify(propId)});
      if(q)prop=q;
    }
    const r=document.querySelector('#personal-canvas')?.getBoundingClientRect();
    if(!prop||!r)return null;
    const source=window.PuppetalkSourceStage;
    const sourceW=Number.isFinite(source?.width)&&source.width>100?source.width:320;
    const sourceH=Number.isFinite(source?.height)&&source.height>100?source.height:360;
    const camera=window.PuppetalkSceneCamera?.stageFrame?.(r.width,r.height)||null;
    const sceneHasPhoto=!!(camera?.sceneId&&camera.sceneId!=='default');
    const floorY=Number.isFinite(camera?.floorY)?camera.floorY:r.height*.88;
    const floorLeft=sceneHasPhoto&&Number.isFinite(camera?.floorLeft)?camera.floorLeft:0;
    const floorRight=sceneHasPhoto&&Number.isFinite(camera?.floorRight)?camera.floorRight:r.width;
    const usableW=Math.max(r.width*.36,floorRight-floorLeft);
    const sourceFloor=.90;
    const topPad=Math.max(4,r.height*.018);
    const bottomPad=Math.max(4,r.height*.018);
    const scaleByWidth=usableW/sourceW;
    const scaleByTop=Math.max(.35,(floorY-topPad)/(sourceH*sourceFloor));
    const scaleByBottom=Math.max(.35,(r.height-bottomPad-floorY)/(sourceH*(1-sourceFloor)));
    const scale=Math.max(.35,Math.min(scaleByWidth,scaleByTop,scaleByBottom));
    const displayW=sourceW*scale;
    const floorCenter=sceneHasPhoto?(floorLeft+floorRight)*.5:r.width*.5;
    const offsetX=floorCenter-displayW*.5;
    const offsetY=floorY-sourceH*sourceFloor*scale;
    return {
      prop,
      point:{x:r.left+offsetX+prop.x*sourceW*scale,y:r.top+offsetY+prop.y*sourceH*scale},
      projection:{sourceW,sourceH,scale,offsetX,offsetY},
      rect:{left:r.left,top:r.top,width:r.width,height:r.height}
    };
  })()\`);
}

async function latestProjectedHandScreenPoints(cdp){
  return evaluate(cdp,\`(()=>{
    const trace=window.__PUPPETALK_PARITY_TRACE__||[];
    let puppet=null;
    for(let i=trace.length-1;i>=0&&!puppet;i--){
      const e=trace[i];
      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;
      const p=e.scene.puppets?.find(p=>p.slot===0);
      if(p?.wl&&p?.wr)puppet=p;
    }
    const r=document.querySelector('#personal-canvas')?.getBoundingClientRect();
    if(!puppet||!r)return null;
    const source=window.PuppetalkSourceStage;
    const sourceW=Number.isFinite(source?.width)&&source.width>100?source.width:320;
    const sourceH=Number.isFinite(source?.height)&&source.height>100?source.height:360;
    const camera=window.PuppetalkSceneCamera?.stageFrame?.(r.width,r.height)||null;
    const sceneHasPhoto=!!(camera?.sceneId&&camera.sceneId!=='default');
    const floorY=Number.isFinite(camera?.floorY)?camera.floorY:r.height*.88;
    const floorLeft=sceneHasPhoto&&Number.isFinite(camera?.floorLeft)?camera.floorLeft:0;
    const floorRight=sceneHasPhoto&&Number.isFinite(camera?.floorRight)?camera.floorRight:r.width;
    const usableW=Math.max(r.width*.36,floorRight-floorLeft);
    const topPad=Math.max(4,r.height*.018),bottomPad=Math.max(4,r.height*.018);
    const scale=Math.max(.35,Math.min(
      usableW/sourceW,
      Math.max(.35,(floorY-topPad)/(sourceH*.90)),
      Math.max(.35,(r.height-bottomPad-floorY)/(sourceH*.10))
    ));
    const floorCenter=sceneHasPhoto?(floorLeft+floorRight)*.5:r.width*.5;
    const offsetX=floorCenter-sourceW*scale*.5;
    const offsetY=floorY-sourceH*.90*scale;
    const screen=q=>({x:r.left+offsetX+q.x*sourceW*scale,y:r.top+offsetY+q.y*sourceH*scale});
    return {left:screen(puppet.wl),right:screen(puppet.wr),rect:{left:r.left,top:r.top,width:r.width,height:r.height}};
  })()\`);
}
`;
if(!source.includes(helperFrom))throw new Error('Missing latestPropAndCanvas helper.');
source=source.replace(helperFrom,helperTo);

const clickFrom=`    const px=geometry.rect.left+geometry.prop.x*geometry.rect.width;
    const py=geometry.rect.top+geometry.prop.y*geometry.rect.height;
    await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:px,y:py,button:'left',buttons:1,clickCount:1});
    await sleep(18);
    await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:px,y:py,button:'left',buttons:0,clickCount:1});
`;
const clickTo=`    const px=geometry.point.x;
    const py=geometry.point.y;
    await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:px,y:py,button:'left',buttons:1,clickCount:1});
    await sleep(18);
    await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:px,y:py,button:'left',buttons:0,clickCount:1});
`;
if(!source.includes(clickFrom))throw new Error('Missing prop-flow click coordinates.');
source=source.replace(clickFrom,clickTo);

const handFrom=`  const hands=await latestHandScreenPoints(controller);
  if(!hands)throw new Error(\`\${label} could not resolve throwing hand geometry.\`);
`;
const handTo=`  const hands=await latestProjectedHandScreenPoints(controller);
  if(!hands)throw new Error(\`\${label} could not resolve projected throwing hand geometry.\`);
`;
if(!source.includes(handFrom))throw new Error('Missing prop-flow hand geometry call.');
source=source.replace(handFrom,handTo);

fs.writeFileSync(path,source);
console.log('Aligned live prop pickup and throw gestures with the controller device projection.');
