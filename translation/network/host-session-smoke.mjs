import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/network/host-session.js','utf8'),context,{filename:'host-session.js'});
const api=context.window.PuppetalkHostSession;
assert.ok(api?.create,'Host session candidate did not install.');

const events=[];
const status={textContent:''};
const conns=new Map();
const puppets=new Map();
const props=new Map([['prop-a',{id:'prop-a'}]]);
const NAMES=['Ada','Bo','Cy','Dee','Eli','Fox'];
const timers=[];
const errors=[];
const peerInstances=[];

class FakeEmitter{
  constructor(id){this.id=id;this.handlers=new Map();this.onOrder=[];}
  on(type,fn){
    this.onOrder.push(type);
    const list=this.handlers.get(type)||[];
    list.push(fn);
    this.handlers.set(type,list);
    return this;
  }
  emit(type,payload){for(const fn of this.handlers.get(type)||[]) fn(payload);}
}
class FakePeer extends FakeEmitter{
  constructor(id){super('peer');this.peerId=id;peerInstances.push(this);events.push(['peer:new',id]);}
}
class FakeConn extends FakeEmitter{
  constructor(id){super(id);this.closed=false;}
  close(){this.closed=true;events.push(['conn:close',this.id]);}
}

const peerId=room=>{events.push(['peerId',room]);return `stage-${room}`;};
const makePuppet=slot=>{
  events.push(['makePuppet',slot]);
  if(!puppets.has(slot)) puppets.set(slot,{slot,name:NAMES[slot],color:'#aaa',look:{style:'base'}});
  return puppets.get(slot);
};
const send=(conn,msg)=>events.push(['send',conn.id,JSON.parse(JSON.stringify(msg))]);
const anatomy=p=>{events.push(['anatomy',p.slot]);return {slot:p.slot,name:p.name};};
const propState=p=>{events.push(['propState',p.id]);return {id:p.id};};
const applyInput=(slot,msg)=>events.push(['applyInput',slot,msg.tag]);
const handlePropInput=(slot,msg)=>events.push(['propInput',slot,msg.tag]);
const handleSpecialItemInput=(slot,msg)=>events.push(['specialInput',slot,msg.tag]);
const handleJointRecovery=(slot,msg)=>events.push(['recoverInput',slot,msg.tag]);
const cleanLook=(look,slot)=>{events.push(['cleanLook',slot,look?.style]);return {style:look?.style||'clean',color:'#123456'};};
const cleanPlayerName=name=>{events.push(['cleanName',name]);return typeof name==='string'?name.trim():'';};
const removePuppet=slot=>{events.push(['removePuppet',slot]);puppets.delete(slot);};
const setTimer=(fn,ms)=>{events.push(['timer',ms]);timers.push({fn,ms});};
const logError=err=>{events.push(['peerError',err.type]);errors.push(err);};

const session=api.create({
  Peer:FakePeer,room:'ROOM',peerId,status,conns,puppets,props,NAMES,
  makePuppet,send,anatomy,propState,
  applyInput,handlePropInput,handleSpecialItemInput,handleJointRecovery,
  cleanLook,cleanPlayerName,removePuppet,setTimer,logError
});
assert.ok(session?.peer && session?.updateStatus && session?.freeSlot,'Host session candidate did not expose peer/status/slot helpers.');
assert.equal(peerInstances.length,1);
assert.equal(session.peer.peerId,'stage-ROOM');
assert.deepEqual(events.splice(0),[['peerId','ROOM'],['peer:new','stage-ROOM']],'Peer construction ordering drifted from V1.');
assert.deepEqual(session.peer.onOrder,['open','connection','error'],'Peer listener registration order drifted from V1.');

session.peer.emit('open');
assert.equal(status.textContent,'stage live — waiting for puppeteers');

session.updateStatus();
assert.equal(status.textContent,'0 puppeteers connected');
session.updateStatus('hello');
assert.equal(status.textContent,'0 puppeteers connected — hello');
assert.equal(session.freeSlot(),0);
conns.set(0,{id:'occupied-0'});conns.set(2,{id:'occupied-2'});
assert.equal(session.freeSlot(),1,'freeSlot must choose the first missing slot from 0..5.');
conns.clear();

const conn=new FakeConn('conn-a');
session.peer.emit('connection',conn);
assert.equal(conns.get(0),conn,'Accepted connection must occupy its slot immediately.');
assert.equal(puppets.has(0),true,'Accepted connection must create its puppet immediately.');
assert.deepEqual(events.splice(0),[['makePuppet',0]],'Connection acceptance mutation order drifted before listener registration.');
assert.deepEqual(conn.onOrder,['open','data','data','data','data','data','close','error'],'Connection listener registration order drifted from V1.');

conn.emit('open');
assert.deepEqual(events.splice(0),[
  ['send','conn-a',{type:'welcome',slot:0,name:'Ada'}],
  ['anatomy',0],['propState','prop-a'],
  ['send','conn-a',{type:'scene',puppets:[{slot:0,name:'Ada'}],props:[{id:'prop-a'}]}]
],'Connection open must send welcome then construct/send the current scene before status update.');
assert.equal(status.textContent,'1 puppeteer connected');

conn.emit('data',{tag:'x',type:'input'});
assert.deepEqual(events.splice(0),[
  ['applyInput',0,'x'],['propInput',0,'x'],['specialInput',0,'x'],['recoverInput',0,'x']
],'First four data listeners must retain V1 registration/call order.');

conn.emit('data',{tag:'look',type:'look',look:{style:'hat'},name:'  New Name  '});
assert.deepEqual(events.splice(0),[
  ['applyInput',0,'look'],['propInput',0,'look'],['specialInput',0,'look'],['recoverInput',0,'look'],
  ['makePuppet',0],['cleanLook',0,'hat'],['cleanName','  New Name  ']
],'Look message must pass through the four existing data listeners before V1 look handling.');
assert.deepEqual(puppets.get(0).look,{style:'hat',color:'#123456'});
assert.equal(puppets.get(0).color,'#123456');
assert.equal(puppets.get(0).name,'New Name');

conn.emit('data',{tag:'blank',type:'look',look:{style:'plain'},name:'   '});
events.length=0;
assert.equal(puppets.get(0).name,'New Name','Blank cleaned name must leave the existing puppet name intact.');

const stale=new FakeConn('stale');
conns.set(0,stale);
conn.emit('close');
assert.deepEqual(events,[],'Goodbye from a stale/replaced connection must be ignored.');
assert.equal(puppets.has(0),true);
conns.set(0,conn);
conn.emit('error',{type:'network'});
assert.deepEqual(events.splice(0),[['removePuppet',0]],'Active goodbye must delete connection then remove puppet before status update.');
assert.equal(conns.has(0),false);
assert.equal(status.textContent,'0 puppeteers connected');
conn.emit('close');
assert.deepEqual(events,[],'Repeated goodbye after slot deletion must be a no-op.');

for(let i=0;i<6;i++) conns.set(i,{id:`busy-${i}`});
const full=new FakeConn('full');
session.peer.emit('connection',full);
assert.deepEqual(full.onOrder,['open'],'Full table must register only the one V1 open handler.');
assert.equal(puppets.size,0,'Full table must not construct a puppet.');
full.emit('open');
assert.deepEqual(events.splice(0),[
  ['send','full',{type:'full'}],['timer',120]
],'Full-table open must send full then schedule close at 120ms.');
assert.equal(timers.length,1);
assert.equal(timers[0].ms,120);
assert.equal(full.closed,false);
timers[0].fn();
assert.equal(full.closed,true);
assert.deepEqual(events.splice(0),[['conn:close','full']]);
conns.clear();

session.peer.emit('error',{type:'unavailable-id'});
assert.deepEqual(events.splice(0),[['peerError','unavailable-id']]);
assert.equal(status.textContent,'table already in use — start another');
session.peer.emit('error',{type:'socket-error'});
assert.deepEqual(events.splice(0),[['peerError','socket-error']]);
assert.equal(status.textContent,'network error: socket-error');
session.peer.emit('error',{});
assert.deepEqual(events.splice(0),[['peerError',undefined]]);
assert.equal(status.textContent,'network error: unknown');
assert.equal(errors.length,3);

console.log('Host session candidate preserves V1 Peer construction, slot policy, listener order, welcome/scene sends, look updates, full-table handling, disconnect cleanup and error text.');
