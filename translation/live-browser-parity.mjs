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
    try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);if(r.ok)return; }catch{}
    await sleep(100);
  }
  throw new Error('Chrome DevTools endpoint did not start.');
}

class Cdp{
  constructor(url){
    this.ws=new WebSocket(url);
    this.next=1;
    this.pending=new Map();
    this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});
    this.ws.onmessage=event=>{
      const msg=JSON.parse(event.data);
      if(!msg.id)return;
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
  await cdp.call('Page.navigate',{url});
  return cdp;
}
async function evaluate(cdp,expression){
  const out=await cdp.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(out.exceptionDetails)throw new Error(out.exceptionDetails.text||'Browser evaluation failed.');
  return out.result?.value;
}
async function waitEval(cdp,expression,label,timeout=12000){
  const started=Date.now();
  let value;
  while(Date.now()-started<timeout){
    try{value=await evaluate(cdp,expression);if(value)return value;}catch{}
    await sleep(120);
  }
  throw new Error(`${label} timed out; final value: ${JSON.stringify(value)}`);
}
async function controllerState(cdp){
  return evaluate(cdp,`(()=>{
    const special=document.querySelector('#special-item');
    return {
      controllerStatus:(document.querySelector('#controller-status')?.textContent||'').trim(),
      hint:(document.querySelector('#stage-hint')?.textContent||'').trim(),
      buttonText:(special?.textContent||'').trim(),
      buttonDisabled:!!special?.disabled,
      dotClass:document.querySelector('#dot')?.className||'',
      youHidden:!!document.querySelector('#you-chip')?.hidden
    };
  })()`);
}

async function liveSession(prefix,room,label){
  const stage=await target(`${base}${prefix}?mode=stage&room=${room}&lobby=done&embedded=1`);
  await waitEval(stage,`document.querySelector('#stage-status')?.textContent.includes('stage live')`,`${label} stage open`);
  const controller=await target(`${base}${prefix}?mode=controller&room=${room}&lobby=done`);
  await waitEval(controller,`(document.querySelector('#controller-status')?.textContent||'').trim().startsWith('you are ')`,`${label} controller welcome`);
  await waitEval(stage,`document.querySelector('#stage-status')?.textContent.includes('1 puppeteer connected')`,`${label} host connection count`);
  await waitEval(controller,`(()=>{const b=document.querySelector('#special-item');return !!b && !b.disabled && b.textContent.trim().startsWith('Bring out ');})()`,`${label} special-item ready`);

  const before=await controllerState(controller);
  const stageStatus=await evaluate(stage,`(document.querySelector('#stage-status')?.textContent||'').trim()`);
  const click=await evaluate(controller,`(()=>{
    const b=document.querySelector('#special-item');
    if(!b)return {clicked:false,reason:'missing'};
    if(b.disabled)return {clicked:false,reason:'disabled',text:b.textContent.trim()};
    b.click();
    return {clicked:true,text:b.textContent.trim()};
  })()`);
  console.log(`${label} before special-item click:`,JSON.stringify({stageStatus,before,click}));
  if(!click?.clicked) throw new Error(`${label} special-item click was not dispatched: ${JSON.stringify({stageStatus,before,click})}`);

  const started=Date.now();
  let after=await controllerState(controller);
  while(Date.now()-started<12000){
    after=await controllerState(controller);
    if(after.hint.startsWith('Brought out ') || after.buttonDisabled || after.controllerStatus.includes('reconnecting') || after.controllerStatus.includes('network error')) break;
    await sleep(120);
  }
  console.log(`${label} after special-item click:`,JSON.stringify(after));
  if(!after.hint.startsWith('Brought out ')){
    const laterStageStatus=await evaluate(stage,`(document.querySelector('#stage-status')?.textContent||'').trim()`);
    throw new Error(`${label} special-item acknowledgement missing: ${JSON.stringify({stageStatus:laterStageStatus,before,click,after})}`);
  }

  const state={
    controllerStatus:before.controllerStatus,
    stageStatus,
    welcomeHint:before.hint,
    beforeButton:before.buttonText,
    propHint:after.hint,
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
  console.log('PASS');
  console.log('Live stage/controller handshake and special-item round trip: pass');
  console.log(JSON.stringify(original,null,2));
}finally{
  const exited=new Promise(resolve=>chrome.once('exit',resolve));
  chrome.kill('SIGTERM');
  await Promise.race([exited,sleep(1500)]);
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});}catch(error){console.warn('Could not remove Chrome parity profile:',error.message);}
}
