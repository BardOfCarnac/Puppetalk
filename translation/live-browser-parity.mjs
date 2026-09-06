import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base=process.env.PUPPETALK_PARITY_BASE||'http://127.0.0.1:8082';
const port=9223;
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'puppetalk-parity-chrome-'));
const chrome=spawn('google-chrome',[
  '--headless','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,'--window-size=1024,768','about:blank'
],{stdio:['ignore','ignore','pipe']});
chrome.stderr.on('data',()=>{});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const round=v=>Number(Number(v).toFixed(4));
async function waitDebugger(){
  for(let i=0;i<120;i++){
    try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);if(r.ok)return;}catch{}
    await sleep(100);
  }
  throw new Error('Chrome DevTools endpoint did not start.');
}

const fakePeerSource=String.raw`(()=>{
  const channelName='puppetalk-parity-peer-v1';
  let autoId=0;
  const trace=window.__PUPPETALK_PARITY_TRACE__=[];
  const note=(event,extra={})=>trace.push({at:performance.now(),event,...extra});
  const msgInfo=data=>({
    type:data?.type||null,
    action:data?.action||null,
    propId:data?.propId||null,
    ok:data?.ok??null,
    message:data?.message||null,
    direction:Number.isFinite(data?.direction)?Number(data.direction):null,
    input:data?.type==='input'?{
      pose:data.input?.pose||null,
      poseVersion:Number.isInteger(data.input?.poseVersion)?data.input.poseVersion:null,
      rag:!!data.input?.rag,
      mouth:Number.isInteger(data.input?.mouth)?data.input.mouth:null,
      grabs:Array.isArray(data.input?.grabs)?data.input.grabs.map(g=>({
        part:g?.part||null,
        x:Number(g?.x),
        y:Number(g?.y),
        screenY:Number.isFinite(g?.screenY)?Number(g.screenY):null
      })):[]
    }:null,
    scene:data?.type==='scene'?{
      puppets:Array.isArray(data.puppets)?data.puppets.map(p=>({
        slot:p?.slot,
        torso:p?.torso?{x:Number(p.torso.x),y:Number(p.torso.y),a:Number(p.torso.a||0)}:null,
        depth:Number.isFinite(p?.depth)?Number(p.depth):null,
        visualScale:Number.isFinite(p?.visualScale)?Number(p.visualScale):null,
        depthPlane:Number.isInteger(p?.depthPlane)?p.depthPlane:null
      })):[],
      propCount:Array.isArray(data.props)?data.props.length:0
    }:null
  });
  class Emitter{
    constructor(){this.handlers=new Map();}
    on(name,fn){const list=this.handlers.get(name)||[];list.push(fn);this.handlers.set(name,list);return this;}
    emit(name,...args){for(const fn of [...(this.handlers.get(name)||[])]){try{fn(...args);}catch(err){note('handler-error',{name,message:err?.message||String(err)});setTimeout(()=>{throw err;});}}}
  }
  class FakeConnection extends Emitter{
    constructor(peer,connId,remoteId){super();this.peer=remoteId;this.connId=connId;this.owner=peer;this.open=false;this.closed=false;}
    _open(){if(this.closed||this.open)return;this.open=true;note('conn-open',{owner:this.owner.id,remote:this.peer,connId:this.connId});this.emit('open');}
    send(data){
      if(!this.open||this.closed){note('send-blocked',{owner:this.owner.id,remote:this.peer,open:this.open,closed:this.closed,...msgInfo(data)});return;}
      note('send',{owner:this.owner.id,remote:this.peer,connId:this.connId,...msgInfo(data)});
      this.owner.channel.postMessage({kind:'data',connId:this.connId,from:this.owner.id,data});
    }
    close(){if(this.closed)return;this.closed=true;this.open=false;note('conn-close',{owner:this.owner.id,remote:this.peer});this.owner.channel.postMessage({kind:'close',connId:this.connId,from:this.owner.id});this.emit('close');}
    _remoteClose(){if(this.closed)return;this.closed=true;this.open=false;note('conn-remote-close',{owner:this.owner.id,remote:this.peer});this.emit('close');}
  }
  class FakePeer extends Emitter{
    constructor(id){
      super();
      this.id=id||('parity-client-'+(++autoId)+'-'+Math.random().toString(36).slice(2));
      this.destroyed=false;
      this.connections=new Map();
      this.channel=new BroadcastChannel(channelName);
      this.channel.onmessage=event=>this._message(event.data||{});
      note('peer-create',{id:this.id});
      setTimeout(()=>{if(!this.destroyed){note('peer-open',{id:this.id});this.emit('open',this.id);}},0);
    }
    connect(targetId){
      const connId=this.id+'>'+targetId+'#'+Math.random().toString(36).slice(2);
      const conn=new FakeConnection(this,connId,targetId);
      this.connections.set(connId,conn);
      note('connect-send',{sourceId:this.id,targetId,connId});
      this.channel.postMessage({kind:'connect',targetId,sourceId:this.id,connId});
      return conn;
    }
    _message(msg){
      if(this.destroyed||!msg)return;
      if(msg.kind==='connect'&&msg.targetId===this.id){
        note('connect-recv',{id:this.id,sourceId:msg.sourceId,connId:msg.connId});
        if(this.connections.has(msg.connId))return;
        const conn=new FakeConnection(this,msg.connId,msg.sourceId);
        this.connections.set(msg.connId,conn);
        this.emit('connection',conn);
        setTimeout(()=>{
          if(this.destroyed)return;
          conn._open();
          this.channel.postMessage({kind:'accept',connId:msg.connId,targetId:msg.sourceId,sourceId:this.id});
        },0);
        return;
      }
      if(msg.kind==='accept'&&msg.targetId===this.id){
        note('accept-recv',{id:this.id,sourceId:msg.sourceId,connId:msg.connId});
        this.connections.get(msg.connId)?._open();
        return;
      }
      if(msg.kind==='data'&&msg.from!==this.id){
        const conn=this.connections.get(msg.connId);
        note('recv',{
          owner:this.id,from:msg.from,connId:msg.connId,...msgInfo(msg.data),
          foregroundPatched:!!conn?.__puppetalkForegroundPatched,
          foregroundSlot:Number.isInteger(conn?.__puppetalkForegroundSlot)?conn.__puppetalkForegroundSlot:null,
          stabilityPatched:!!conn?.__puppetalkPatched,
          stabilitySlot:Number.isInteger(conn?.__puppetalkSlot)?conn.__puppetalkSlot:null,
          locomotionPatched:!!conn?.__puppetalkLocomotionPatched,
          locomotionSlot:Number.isInteger(conn?.__locomotionSlot)?conn.__locomotionSlot:null
        });
        conn?.emit('data',msg.data);
        return;
      }
      if(msg.kind==='close'&&msg.from!==this.id)this.connections.get(msg.connId)?._remoteClose();
    }
    destroy(){
      if(this.destroyed)return;
      this.destroyed=true;
      note('peer-destroy',{id:this.id});
      for(const conn of this.connections.values())conn._remoteClose();
      this.connections.clear();
      this.channel.close();
    }
  }
  Object.defineProperty(window,'Peer',{configurable:false,enumerable:true,get(){return FakePeer;},set(){}});
  window.__PUPPETALK_PARITY_FAKE_PEER__=true;
})();`;

class Cdp{
  constructor(url){
    this.ws=new WebSocket(url);
    this.next=1;
    this.pending=new Map();
    this.events=[];
    this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});
    this.ws.onmessage=event=>{
      const msg=JSON.parse(event.data);
      if(!msg.id){
        if(msg.method==='Runtime.exceptionThrown')this.events.push({type:'exception',text:msg.params?.exceptionDetails?.text||'',description:msg.params?.exceptionDetails?.exception?.description||''});
        return;
      }
      const p=this.pending.get(msg.id);
      if(!p)return;
      this.pending.delete(msg.id);
      if(msg.error)p.reject(new Error(msg.error.message));else p.resolve(msg.result||{});
    };
  }
  async call(method,params={}){
    await this.ready;
    const id=this.next++;
    const promise=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));
    this.ws.send(JSON.stringify({id,method,params}));
    return promise;
  }
  close(){try{this.ws.close();}catch{}}
}

async function target(url){
  const r=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});
  if(!r.ok)throw new Error(`Could not create Chrome target: ${r.status}`);
  const info=await r.json();
  const cdp=new Cdp(info.webSocketDebuggerUrl);
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:fakePeerSource});
  await cdp.call('Page.navigate',{url});
  return cdp;
}
async function evaluate(cdp,expression){
  const out=await cdp.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(out.exceptionDetails)throw new Error(out.exceptionDetails.text||'Browser evaluation failed.');
  return out.result?.value;
}
async function waitEval(cdp,expression,label,timeout=7000){
  const started=Date.now();
  let value;
  while(Date.now()-started<timeout){
    try{value=await evaluate(cdp,expression);if(value)return value;}catch{}
    await sleep(80);
  }
  throw new Error(`${label} timed out; final value: ${JSON.stringify(value)}`);
}
async function traceLength(cdp){return evaluate(cdp,`(window.__PUPPETALK_PARITY_TRACE__||[]).length`);}
async function waitInput(cdp,start,predicate,label,timeout=3500){
  const expression=`(()=>{
    const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${start}).filter(e=>e.event==='send'&&e.type==='input'&&e.input);
    const e=entries.find(e=>(${predicate}));
    return e?e.input:null;
  })()`;
  return waitEval(cdp,expression,label,timeout);
}
function normalizeInput(input){
  return {
    pose:input.pose,poseVersion:input.poseVersion,rag:!!input.rag,mouth:input.mouth,
    grabs:(input.grabs||[]).map(g=>({part:g.part,x:round(g.x),y:round(g.y)}))
  };
}
async function inputsSince(cdp,start){
  const values=await evaluate(cdp,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${start}).filter(e=>e.event==='send'&&e.type==='input'&&e.input).map(e=>e.input)`);
  return (values||[]).map(normalizeInput);
}
async function commandSequence(cdp,selector,requiredExpression,label){
  const start=await traceLength(cdp);
  await click(cdp,selector);
  await waitEval(cdp,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${start}).some(e=>e.event==='send'&&e.type==='input'&&e.input&&(${requiredExpression}))`,label);
  await sleep(80);
  return {messages:await inputsSince(cdp,start),ui:await commandUi(cdp)};
}
async function commandUi(cdp){
  return evaluate(cdp,`(()=>({
    activePose:document.querySelector('#poses [data-pose].active')?.dataset.pose||'',
    ragText:(document.querySelector('#poses [data-rag]')?.textContent||'').trim(),
    ragActive:document.querySelector('#poses [data-rag]')?.classList.contains('active')||false,
    hint:(document.querySelector('#stage-hint')?.textContent||'').trim()
  }))()`);
}
async function controllerState(cdp){
  return evaluate(cdp,`(()=>{const special=document.querySelector('#special-item');return {
    controllerStatus:(document.querySelector('#controller-status')?.textContent||'').trim(),
    hint:(document.querySelector('#stage-hint')?.textContent||'').trim(),
    buttonText:(special?.textContent||'').trim(),buttonDisabled:!!special?.disabled,
    dotClass:document.querySelector('#dot')?.className||'',youHidden:!!document.querySelector('#you-chip')?.hidden
  };})()`);
}
async function click(cdp,selector){
  const ok=await evaluate(cdp,`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;el.click();return true;})()`);
  if(!ok)throw new Error(`Missing clickable control ${selector}`);
}
async function latestTorsoAndCanvas(cdp){
  return evaluate(cdp,`(()=>{
    const trace=window.__PUPPETALK_PARITY_TRACE__||[];
    let torso=null;
    for(let i=trace.length-1;i>=0&&!torso;i--){
      const e=trace[i];
      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;
      const p=e.scene.puppets?.find(p=>p.slot===0);
      if(p?.torso)torso=p.torso;
    }
    const r=document.querySelector('#personal-canvas')?.getBoundingClientRect();
    return torso&&r?{torso,rect:{left:r.left,top:r.top,width:r.width,height:r.height}}:null;
  })()`);
}

async function latestTorsoScreenPoint(cdp){
  return evaluate(cdp,`(()=>{
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
    return {
      x:r.left+torso.x*r.width,
      y:r.top+torso.y*r.height
    };
  })()`);
}

async function waitDepthScene(cdp,start,plane,extra,label,timeout=3500){
  return waitEval(cdp,`(()=>{
    const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${start});
    for(const e of entries){
      if(e.event!=='recv'||e.type!=='scene'||!e.scene)continue;
      const p=e.scene.puppets?.find(p=>p.slot===0);
      if(p&&p.depthPlane===${plane}&&(${extra})){
        return {depthPlane:p.depthPlane,depth:Number(p.depth),visualScale:Number(p.visualScale)};
      }
    }
    return null;
  })()`,label,timeout);
}

async function exerciseDepthGestures(controller,stage,label){
  await waitEval(controller,`(document.querySelector('.depth-gesture-guide')?.textContent||'').includes('3 quick taps')`,`${label} depth gesture guide`);
  const guide=await evaluate(controller,`(document.querySelector('.depth-gesture-guide')?.textContent||'').trim()`);
  const startState=await evaluate(stage,`(()=>{
    const api=window.PuppetalkDepthState;
    const tuning=window.PuppetalkForegroundTuning;
    if(!api||!Array.isArray(tuning?.planes))return null;
    const plane=api.getPlaneForSlot(0);
    return {plane,depth:api.getDepthForSlot(0),planes:[...tuning.planes]};
  })()`);
  if(!startState||!Number.isInteger(startState.plane))throw new Error(`${label} could not resolve starting depth plane.`);
  const expectedCloserPlane=Math.min(startState.plane+1,startState.planes.length-1);
  if(expectedCloserPlane===startState.plane)throw new Error(`${label} depth parity began at the closest plane; cannot verify +1 gesture.`);
  const expectedCloserDepth=startState.planes[expectedCloserPlane];
  const expectedAwayPlane=startState.plane;
  const expectedAwayDepth=startState.planes[expectedAwayPlane];

  let point=await latestTorsoScreenPoint(controller);
  if(!point)throw new Error(`${label} could not resolve torso screen point for depth gesture.`);

  const closerStart=await traceLength(controller);
  for(let i=0;i<3;i++){
    await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
    await sleep(35);
    await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
    await sleep(45);
  }
  await waitEval(controller,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart}).some(e=>e.event==='send'&&e.type==='depth-step'&&e.direction===1)`,`${label} closer depth-step`);
  let stageCloser;
  try{
    stageCloser=await waitEval(stage,`(()=>{
      const api=window.PuppetalkDepthState;
      if(!api)return null;
      const plane=api.getPlaneForSlot(0);
      const depth=api.getDepthForSlot(0);
      return plane===${expectedCloserPlane}&&Math.abs(depth-${expectedCloserDepth})<.02?{plane,depth}:null;
    })()`,`${label} stage one-plane closer state`,5000);
  }catch(error){
    const actual=await evaluate(stage,`(()=>{
      const api=window.PuppetalkDepthState;
      return api?{plane:api.getPlaneForSlot(0),depth:api.getDepthForSlot(0)}:null;
    })()`);
    const stageSteps=await evaluate(stage,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart}).filter(e=>e.event==='recv'&&e.type==='depth-step').map(e=>({at:e.at,direction:e.direction,foregroundSlot:e.foregroundSlot}))`);
    const controllerSteps=await evaluate(controller,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${closerStart}).filter(e=>e.event==='send'&&e.type==='depth-step').map(e=>({at:e.at,direction:e.direction}))`);
    throw new Error(`${error.message}\n${label} relative-depth diagnostics: ${JSON.stringify({startState,expectedCloserPlane,expectedCloserDepth,actual,controllerSteps,stageSteps},null,2)}`);
  }
  const closer=await waitDepthScene(controller,closerStart,expectedCloserPlane,`Math.abs(Number(p.depth)-${expectedCloserDepth})<.02`,`${label} one-plane closer scene`,5000);

  point=await latestTorsoScreenPoint(controller);
  if(!point)throw new Error(`${label} could not resolve torso screen point after moving closer.`);
  const awayStart=await traceLength(controller);
  await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
  await sleep(300);
  await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
  await waitEval(controller,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${awayStart}).some(e=>e.event==='send'&&e.type==='depth-step'&&e.direction===-1)`,`${label} away depth-step`);
  const stageAway=await waitEval(stage,`(()=>{
    const api=window.PuppetalkDepthState;
    if(!api)return null;
    const plane=api.getPlaneForSlot(0);
    const depth=api.getDepthForSlot(0);
    return plane===${expectedAwayPlane}&&Math.abs(depth-${expectedAwayDepth})<.02?{plane,depth}:null;
  })()`,`${label} stage one-plane away state`,5000);
  const away=await waitDepthScene(controller,awayStart,expectedAwayPlane,`Math.abs(Number(p.depth)-${expectedAwayDepth})<.02`,`${label} one-plane away scene`,5000);

  return {
    guide,
    startPlane:startState.plane,
    closer:{direction:1,stagePlane:stageCloser.plane,plane:closer.depthPlane,step:stageCloser.plane-startState.plane,settled:Math.abs(closer.depth-expectedCloserDepth)<.02},
    away:{direction:-1,stagePlane:stageAway.plane,plane:away.depthPlane,step:stageAway.plane-stageCloser.plane,returned:stageAway.plane===startState.plane,settled:Math.abs(away.depth-expectedAwayDepth)<.02}
  };
}
async function exerciseCoreControls(controller,label){
  const out={};
  out.point=await commandSequence(controller,'[data-pose="point"]',"e.input.pose==='point'&&!e.input.rag",`${label} point input`);
  out.cheer=await commandSequence(controller,'[data-pose="cheer"]',"e.input.pose==='cheer'&&!e.input.rag",`${label} cheer input`);
  out.limp=await commandSequence(controller,'[data-rag]',"e.input.rag===true",`${label} limp input`);
  out.recoverToggle=await commandSequence(controller,'[data-rag]',"e.input.rag===false",`${label} recover toggle input`);

  let start=await traceLength(controller);
  await click(controller,'#centre');
  await waitInput(controller,start,"e.input.grabs?.length===1&&e.input.grabs[0]?.part==='torso'&&e.input.grabs[0]?.x===.5&&e.input.grabs[0]?.y===.55",`${label} centre grab`);
  await waitInput(controller,start,"e.input.grabs?.length===0",`${label} centre release`);
  await sleep(40);
  out.centre={messages:await inputsSince(controller,start)};

  await waitEval(controller,`(()=>{const t=window.__PUPPETALK_PARITY_TRACE__||[];return t.some(e=>e.event==='recv'&&e.type==='scene'&&e.scene?.puppets?.some(p=>p.slot===0&&p.torso));})()`,`${label} scene torso for pointer grab`);
  const geometry=await latestTorsoAndCanvas(controller);
  if(!geometry)throw new Error(`${label} could not resolve torso/canvas geometry.`);
  const sx=geometry.rect.left+geometry.torso.x*geometry.rect.width;
  const sy=geometry.rect.top+geometry.torso.y*geometry.rect.height;
  const tx=geometry.rect.left+Math.min(.95,geometry.torso.x+.08)*geometry.rect.width;
  const ty=geometry.rect.top+Math.max(.1,geometry.torso.y-.05)*geometry.rect.height;

  start=await traceLength(controller);
  await controller.call('Input.dispatchMouseEvent',{type:'mousePressed',x:sx,y:sy,button:'left',buttons:1,clickCount:1});
  const grabDown=await waitInput(controller,start,"e.input.grabs?.length===1&&e.input.grabs[0]?.part==='torso'",`${label} torso pointer down`);

  const moveStart=await traceLength(controller);
  await controller.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:tx,y:ty,button:'left',buttons:1});
  const grabMove=await waitInput(controller,moveStart,"e.input.grabs?.length===1&&e.input.grabs[0]?.part==='torso'",`${label} torso pointer move`);

  const releaseStart=await traceLength(controller);
  await controller.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:tx,y:ty,button:'left',buttons:0,clickCount:1});
  const grabUp=await waitInput(controller,releaseStart,"e.input.grabs?.length===0",`${label} torso pointer release`);

  const down=normalizeInput(grabDown);
  const move=normalizeInput(grabMove);
  const up=normalizeInput(grabUp);
  const downGrab=down.grabs[0];
  const moveGrab=move.grabs[0];
  out.pointerGrab={
    down:{pose:down.pose,poseVersion:down.poseVersion,rag:down.rag,mouth:down.mouth,part:downGrab?.part||null,grabCount:down.grabs.length},
    move:{part:moveGrab?.part||null,grabCount:move.grabs.length,dx:round((moveGrab?.x||0)-(downGrab?.x||0)),dy:round((moveGrab?.y||0)-(downGrab?.y||0))},
    up:{pose:up.pose,poseVersion:up.poseVersion,rag:up.rag,mouth:up.mouth,grabCount:up.grabs.length}
  };
  return out;
}

async function liveSession(prefix,room,label){
  const stage=await target(`${base}${prefix}?mode=stage&room=${room}&lobby=done&embedded=1`);
  await waitEval(stage,`window.__PUPPETALK_PARITY_FAKE_PEER__===true`,`${label} fake Peer injection`);
  await waitEval(stage,`document.querySelector('#stage-status')?.textContent.includes('stage live')`,`${label} stage open`);
  const controller=await target(`${base}${prefix}?mode=controller&room=${room}&lobby=done`);
  await waitEval(controller,`window.__PUPPETALK_PARITY_FAKE_PEER__===true`,`${label} controller fake Peer injection`);
  await waitEval(controller,`(document.querySelector('#controller-status')?.textContent||'').trim().startsWith('you are ')`,`${label} controller welcome`);
  await waitEval(stage,`document.querySelector('#stage-status')?.textContent.includes('1 puppeteer connected')`,`${label} host connection count`);
  await waitEval(controller,`(()=>{const b=document.querySelector('#special-item');return !!b&&!b.disabled&&b.textContent.trim().startsWith('Bring out ');})()`,`${label} special-item ready`);

  const before=await controllerState(controller);
  const stageStatus=await evaluate(stage,`(document.querySelector('#stage-status')?.textContent||'').trim()`);
  const controls=await exerciseCoreControls(controller,label);
  const depth=await exerciseDepthGestures(controller,stage,label);

  const specialStart=await traceLength(controller);
  await click(controller,'#special-item');
  await waitEval(controller,`(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${specialStart}).some(e=>e.event==='recv'&&e.message==='Brought out Laser frisbee.')`,`${label} frozen special-item transport reply`);
  await sleep(120);
  const after=await controllerState(controller);
  const reply=await evaluate(controller,`(()=>{
    const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).slice(${specialStart}).filter(e=>e.event==='recv'&&e.message==='Brought out Laser frisbee.');
    const e=entries[entries.length-1];
    return e?{type:e.type,propId:e.propId,ok:e.ok,message:e.message}:null;
  })()`);
  if(stage.events.some(e=>e.type==='exception')||controller.events.some(e=>e.type==='exception')){
    throw new Error(`${label} browser exception during session: ${JSON.stringify({stage:stage.events,controller:controller.events})}`);
  }

  // Frozen V1 accidentally lets result.type ('frisbee') overwrite the intended
  // 'special-item-result' envelope type. The controller therefore ignores the
  // acknowledgement. Parity requires the translation to reproduce that behavior
  // until we intentionally fix it after the translation is complete.
  const state={
    controllerStatus:before.controllerStatus,
    stageStatus,
    welcomeHint:before.hint,
    controls,
    depth,
    beforeButton:before.buttonText,
    reply,
    afterHint:after.hint,
    afterButton:after.buttonText,
    afterDisabled:after.buttonDisabled
  };
  controller.close();stage.close();
  return state;
}

function comparable(state){
  const copy=structuredClone(state);
  const gesture=copy.controls?.pointerGrab;
  if(gesture?.move){
    // The two independent Matter simulations can be sampled a few milliseconds
    // apart, so compare the deliberate pointer gesture rather than absolute body
    // position. The requested move is +.08,-.05; hundredths preserve that intent.
    gesture.move.dx=Number(Number(gesture.move.dx).toFixed(2));
    gesture.move.dy=Number(Number(gesture.move.dy).toFixed(2));
  }
  return copy;
}

try{
  await waitDebugger();
  const original=await liveSession('/','LIVE1','original');
  const translated=await liveSession('/translation/','LIVE2','translated');
  if(JSON.stringify(comparable(original))!==JSON.stringify(comparable(translated))){
    throw new Error(`Live session parity mismatch.\nORIGINAL ${JSON.stringify(original,null,2)}\nTRANSLATED ${JSON.stringify(translated,null,2)}`);
  }
  if(original.reply?.type!=='frisbee'||original.reply?.ok!==true){
    throw new Error(`Frozen V1 special-item reply shape changed unexpectedly: ${JSON.stringify(original.reply)}`);
  }
  console.log('PASS');
  console.log('Stage/controller handshake, pose/ragdoll controls, centre pulse, direct torso drag, discrete depth gestures and frozen special-item behavior: pass');
  console.log(JSON.stringify(comparable(original),null,2));
}finally{
  const exited=new Promise(resolve=>chrome.once('exit',resolve));
  chrome.kill('SIGTERM');
  await Promise.race([exited,sleep(1500)]);
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});}catch(error){console.warn('Could not remove Chrome parity profile:',error.message);}
}
