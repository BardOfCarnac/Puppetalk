import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root={};
const context={window:root,globalThis:root,Map,Math,JSON};
vm.runInNewContext(fs.readFileSync(new URL('./live-voice.js',import.meta.url),'utf8'),context,{filename:'live-voice.js'});
const api=root.PuppetalkLiveVoice;
assert.ok(api?.createStage && api?.createController,'Translated live voice module did not install.');

const stageSends=[];
const stage=api.createStage({send:(conn,msg)=>stageSends.push([conn.peer,JSON.parse(JSON.stringify(msg))])});
const a={open:true,peer:'peer-a'},b={open:true,peer:'peer-b'};
assert.equal(stage.join(a,0),true);
assert.equal(stage.join(b,1),true);
assert.deepEqual(JSON.parse(JSON.stringify(stage.roster())),[
  {slot:0,peerId:'peer-a',voice:false},
  {slot:1,peerId:'peer-b',voice:false}
]);
assert.equal(stage.data(a,0,{type:'voice-state',enabled:true}),true);
assert.equal(stage.roster()[0].voice,true,'Voice-state should update the stage roster.');
assert.ok(stageSends.some(([,msg])=>msg.type==='voice-roster'&&msg.peers.some(peer=>peer.peerId==='peer-a'&&peer.voice)),'Updated voice roster should be broadcast.');
assert.equal(stage.leave(1),true);
assert.equal(stage.roster().length,1);

class Emitter{
  constructor(){this.handlers=new Map();}
  on(type,fn){const list=this.handlers.get(type)||[];list.push(fn);this.handlers.set(type,list);return this;}
  emit(type,value){for(const fn of this.handlers.get(type)||[]) fn(value);}
}
class FakeCall extends Emitter{
  constructor(peer,metadata={}){super();this.peer=peer;this.metadata=metadata;this.closed=false;this.answers=[];}
  answer(stream){this.answers.push(stream);}
  close(){this.closed=true;this.emit('close');}
}
class FakePeer extends Emitter{
  constructor(id){super();this.id=id;this.destroyed=false;this.calls=[];}
  call(peerId,stream,options){const call=new FakeCall(peerId,options?.metadata);this.calls.push({peerId,stream,options,call});return call;}
}

const timers=[];
let timerId=0;
const cleared=[];
const audios=[];
const documentRef={
  body:{appendChild(node){audios.push(node);}},
  listeners:new Map(),
  addEventListener(type,fn){this.listeners.set(type,fn);},
  createElement(tag){
    assert.equal(tag,'audio');
    return {
      paused:false,srcObject:null,removed:false,
      setAttribute(){},play(){return Promise.resolve();},pause(){this.paused=true;},remove(){this.removed=true;}
    };
  }
};
const controller=api.createController({
  documentRef,
  setTimer:(fn,ms)=>{const id=++timerId;timers.push({id,fn,ms});return id;},
  clearTimer:id=>cleared.push(id),
  random:()=>0,
  logger:{debug(){}}
});
const peer=new FakePeer('peer-a');
controller.peerReady(peer,'ROOM');
const sent=[];
const stageConn={open:true,send:msg=>sent.push(JSON.parse(JSON.stringify(msg)))};
controller.welcome(stageConn,2);
assert.deepEqual(sent.at(-1),{type:'voice-state',enabled:false});

const track={readyState:'live',enabled:true,addEventListener(){}};
const stream={getAudioTracks:()=>[track]};
controller.setLocalStream(stream);
assert.equal(controller.hasLiveMic(),true);
assert.deepEqual(sent.at(-1),{type:'voice-state',enabled:true});
controller.data({type:'voice-roster',peers:[
  {slot:2,peerId:'peer-a',voice:true},
  {slot:1,peerId:'peer-b',voice:true}
]});
assert.ok(cleared.length>=1,'A changed roster should replace any pending reconciliation timer.');
const reconcile=timers.at(-1);
assert.equal(reconcile.ms,120);
reconcile.fn();
assert.equal(peer.calls.length,1,'One side of a two-mic pair should establish the media call.');
assert.equal(peer.calls[0].peerId,'peer-b');
assert.equal(peer.calls[0].stream,stream);
assert.deepEqual(JSON.parse(JSON.stringify(peer.calls[0].options.metadata)),{puppetalkRoom:'ROOM',slot:2});

const remoteStream={id:'remote'};
peer.calls[0].call.emit('stream',remoteStream);
assert.equal(audios.length,1);
assert.equal(audios[0].srcObject,remoteStream,'Remote media should be attached to a hidden audio element.');

const wrongRoom=new FakeCall('peer-c',{puppetalkRoom:'OTHER'});
peer.emit('call',wrongRoom);
assert.equal(wrongRoom.closed,true,'Calls advertising a different Puppetalk room must be rejected.');

controller.clearLocalStream(stream);
assert.equal(controller.hasLiveMic(),false);
assert.deepEqual(sent.at(-1),{type:'voice-state',enabled:false});
assert.equal(peer.calls[0].call.closed,true,'Changing local voice state should close stale media calls before reconciling.');

console.log('Translated live voice owns stage roster signalling, controller media calls, room isolation, remote playback and mic-state reconciliation without source rewriting.');
