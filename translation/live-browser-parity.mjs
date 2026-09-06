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
  const note=(event,extra={})=>trace.push({event,...extra});
  const msgInfo=data=>({type:data?.type||null,action:data?.action||null,propId:data?.propId||null,ok:data?.ok??null,message:data?.message||null});
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
        note('recv',{owner:this.id,from:msg.from,connId:msg.connId,...msgInfo(msg.data)});
        this.connections.get(msg.connId)?.emit('data',msg.data);
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
async function controllerState(cdp){
  return evaluate(cdp,`(()=>{const special=document.querySelector('#special-item');return {
    controllerStatus:(document.querySelector('#controller-status')?.textContent||'').trim(),
    hint:(document.querySelector('#stage-hint')?.textContent||'').trim(),
    buttonText:(special?.textContent||'').trim(),buttonDisabled:!!special?.disabled,
    dotClass:document.querySelector('#dot')?.className||'',youHidden:!!document.querySelector('#you-chip')?.hidden
  };})()`);
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
  const click=await evaluate(controller,`(()=>{const b=document.querySelector('#special-item');if(!b||b.disabled)return false;b.click();return true;})()`);
  if(!click)throw new Error(`${label} special-item click was not dispatched.`);

  await waitEval(controller,`(window.__PUPPETALK_PARITY_TRACE__||[]).some(e=>e.event==='recv'&&e.message==='Brought out Laser frisbee.')`,`${label} frozen special-item transport reply`);
  await sleep(120);
  const after=await controllerState(controller);
  const reply=await evaluate(controller,`(()=>{
    const entries=(window.__PUPPETALK_PARITY_TRACE__||[]).filter(e=>e.event==='recv'&&e.message==='Brought out Laser frisbee.');
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
    beforeButton:before.buttonText,
    reply,
    afterHint:after.hint,
    afterButton:after.buttonText,
    afterDisabled:after.buttonDisabled
  };
  controller.close();stage.close();
  return state;
}

try{
  await waitDebugger();
  const original=await liveSession('/','LIVE1','original');
  const translated=await liveSession('/translation/','LIVE2','translated');
  if(JSON.stringify(original)!==JSON.stringify(translated)){
    throw new Error(`Live session parity mismatch.\nORIGINAL ${JSON.stringify(original,null,2)}\nTRANSLATED ${JSON.stringify(translated,null,2)}`);
  }
  if(original.reply?.type!=='frisbee'||original.reply?.ok!==true){
    throw new Error(`Frozen V1 special-item reply shape changed unexpectedly: ${JSON.stringify(original.reply)}`);
  }
  console.log('PASS');
  console.log('Stage/controller handshake and frozen special-item transport behavior: pass');
  console.log(JSON.stringify(original,null,2));
}finally{
  const exited=new Promise(resolve=>chrome.once('exit',resolve));
  chrome.kill('SIGTERM');
  await Promise.race([exited,sleep(1500)]);
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});}catch(error){console.warn('Could not remove Chrome parity profile:',error.message);}
}
