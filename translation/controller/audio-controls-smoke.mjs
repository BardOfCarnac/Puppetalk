import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./audio-controls.js',import.meta.url),'utf8'),context,{filename:'audio-controls.js'});
const api=context.window.PuppetalkControllerAudio;
assert.ok(api?.create,'Controller audio candidate did not install.');

class FakeTarget{
  constructor(){this.listeners=new Map();this.textContent='';this.style={width:''};this.classes=new Set();this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v)};}
  addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
  fire(type,event={}){for(const fn of this.listeners.get(type)||[]) fn(event);}
}

const micButton=new FakeTarget();
const level=new FakeTarget();
const talkButton=new FakeTarget();
const input={mouth:0};
const transmissions=[];
const statuses=[];
const timerCalls=[];
const clearedTimers=[];
let timerId=0;
const timers=new Map();
let frameId=0;
const frames=new Map();
const cancelledFrames=[];
const track={stopped:false,stop(){this.stopped=true;}};
let analyserFill=128;
const analyser={
  fftSize:0,smoothingTimeConstant:0,
  getByteTimeDomainData(data){data.fill(analyserFill);}
};
const source={connected:null,connect(target){this.connected=target;}};
const audio={
  closed:false,
  createMediaStreamSource(stream){assert.equal(stream,fakeStream);return source;},
  createAnalyser(){return analyser;},
  close(){this.closed=true;}
};
const fakeStream={getTracks(){return [track];}};
const errors=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const controller=api.create({
  micButton,level,talkButton,input,clamp,
  transmit:force=>transmissions.push([input.mouth,force]),
  setStatus:(...args)=>statuses.push(args),
  getUserMedia:async constraints=>{assert.deepEqual(JSON.parse(JSON.stringify(constraints)),{audio:true});return fakeStream;},
  createAudioContext:()=>audio,
  requestFrame:callback=>{const id=++frameId;frames.set(id,callback);return id;},
  cancelFrame:id=>cancelledFrames.push(id),
  setTimer:(callback,ms)=>{const id=++timerId;timers.set(id,callback);timerCalls.push([id,ms]);return id;},
  clearTimer:id=>{clearedTimers.push(id);timers.delete(id);},
  logger:{error:error=>errors.push(error)}
});
assert.ok(controller?.install,'Controller audio factory failed.');
controller.install();
assert.equal(micButton.listeners.get('click')?.length,1);
for(const type of ['pointerdown','pointerup','pointercancel','pointerleave']) assert.equal(talkButton.listeners.get(type)?.length,1,`Missing ${type} listener.`);

let prevented=false;
talkButton.fire('pointerdown',{preventDefault(){prevented=true;}});
assert.equal(prevented,true);
assert.equal(input.mouth,2,'Manual talk must begin on the frozen open-mouth phase.');
assert.equal(talkButton.classes.has('active'),true);
assert.deepEqual(timerCalls,[[1,95]],'Manual chatter interval must remain 95ms.');
assert.deepEqual(transmissions.at(-1),[2,true]);
timers.get(1)();
assert.equal(input.mouth,1);
timers.get(1)();
assert.equal(input.mouth,1,'Frozen manual chatter sequence is 2,1,1.');
const beforeLeave=transmissions.length;
talkButton.fire('pointerleave',{buttons:0});
assert.equal(transmissions.length,beforeLeave,'Pointerleave without a pressed button must not stop manual talk.');
talkButton.fire('pointerleave',{buttons:1});
assert.equal(input.mouth,0);
assert.equal(talkButton.classes.has('active'),false);
assert.deepEqual(clearedTimers,[1]);
assert.deepEqual(transmissions.at(-1),[0,true]);

transmissions.length=0;
await controller.enableMic();
assert.equal(micButton.textContent,'Disable microphone');
assert.equal(analyser.fftSize,512);
assert.equal(analyser.smoothingTimeConstant,.45);
assert.equal(source.connected,analyser);
assert.equal(frames.size,1,'Enabling microphone must schedule the first animation frame.');
let sample=frames.get(1);
sample(100);
assert.equal(level.style.width,'0%');
assert.equal(input.mouth,0);
assert.deepEqual(transmissions,[[0,true]]);

analyserFill=134;
sample=frames.get(2);
sample(200);
assert.ok(Math.abs(parseFloat(level.style.width)-25.3125)<1e-9,'Level meter must preserve the frozen RMS×540 scale.');
assert.equal(input.mouth,1,'RMS above .028 and at/below .105 must use mouth state 1.');
assert.deepEqual(transmissions.at(-1),[1,true]);

analyserFill=160;
sample=frames.get(3);
sample(220);
assert.equal(input.mouth,1,'Mouth changes inside the frozen 45ms gate must be suppressed.');
const gatedCount=transmissions.length;
sample=frames.get(4);
sample(260);
assert.equal(input.mouth,2,'RMS above .105 must use mouth state 2 after the 45ms gate.');
assert.equal(level.style.width,'100%','Level meter must clamp at 100%.');
assert.equal(transmissions.length,gatedCount+1);

await controller.enableMic();
assert.equal(micButton.textContent,'Enable microphone');
assert.equal(input.mouth,0);
assert.equal(level.style.width,'0%');
assert.equal(track.stopped,true);
assert.equal(audio.closed,true);
assert.equal(cancelledFrames.at(-1),5,'Disabling microphone must cancel the latest scheduled frame.');
assert.deepEqual(transmissions.at(-1),[0,true]);

const failingMic=new FakeTarget(),failingLevel=new FakeTarget(),failingTalk=new FakeTarget();
const boom=new Error('denied');
const failed=api.create({
  micButton:failingMic,level:failingLevel,talkButton:failingTalk,input:{mouth:0},clamp,
  transmit(){},setStatus:(...args)=>statuses.push(args),getUserMedia:async()=>{throw boom;},logger:{error:error=>errors.push(error)}
});
await failed.enableMic();
assert.equal(errors.at(-1),boom);
assert.deepEqual(statuses.at(-1),['microphone unavailable','bad']);

console.log('Controller audio candidate preserves V1 microphone setup, RMS meter/mouth thresholds, 45ms mouth gate, teardown and 95ms manual-talk fallback semantics.');
