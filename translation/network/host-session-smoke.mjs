import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const depthSteps=[];
const root={
  innerWidth:1024,innerHeight:768,
  PuppetalkDepthState:{
    tuneScene(scene,{width,height}={}){
      return {...scene,stageViewport:{width,height},depthTuned:true};
    },
    stepDepth(slot,direction){depthSteps.push({slot,direction});return Number.isFinite(direction)&&direction!==0;}
  }
};
const context={window:root,globalThis:root};
vm.runInNewContext(fs.readFileSync('translation/network/host-session.js','utf8'),context,{filename:'host-session.js'});
const api=root.PuppetalkHostSession;
assert.ok(api?.create,'Host session candidate did not install.');

const events=[];
const status={textContent:''};
const conns=new Map();
const puppets=new Map();
const props=new Map([['prop-a',{id:'prop-a'}]]);
const NAMES=['Ada','Bo','Cy','Dee','Eli','Fox'];
const timers=[];
const errors=[];

class FakeEmitter{
  constructor(id){this.id=id;this.handlers=new Map();}
  on(type,fn){const list=this.handlers.get(type)||[];list.push(fn);this.handlers.set(type,list);return this;}
  emit(type,payload){for(const fn of this.handlers.get(type)||[]) fn(payload);}
}
class FakePeer extends FakeEmitter{
  constructor(id){super('peer');this.peerId=id;events.push(['peer:new',id]);}
}
class FakeConn extends FakeEmitter{
  constructor(id){super(id);this.closed=false;}
  close(){this.closed=true;events.push(['conn:close',this.id]);}
}

const peerId=room=>`stage-${room}`;
const makePuppet=slot=>{
  if(!puppets.has(slot)) puppets.set(slot,{slot,name:NAMES[slot],color:'#aaa',look:{style:'base'}});
  return puppets.get(slot);
};
const send=(conn,msg)=>events.push(['send',conn.id,JSON.parse(JSON.stringify(msg))]);
const anatomy=p=>({slot:p.slot,name:p.name});
const propState=p=>({id:p.id});
const applyInput=(slot,msg)=>events.push(['applyInput',slot,msg.type]);
const handlePropInput=(slot,msg)=>events.push(['propInput',slot,msg.type]);
const handleSpecialItemInput=(slot,msg)=>events.push(['specialInput',slot,msg.type]);
const handleJointRecovery=(slot,msg)=>events.push(['recoverInput',slot,msg.type]);
const cleanLook=(look,slot)=>({style:look?.style||'clean',color:'#123456',slot});
const cleanPlayerName=name=>typeof name==='string'?name.trim():'';
const removePuppet=slot=>{events.push(['removePuppet',slot]);puppets.delete(slot);};
const setTimer=(fn,ms)=>timers.push({fn,ms});
const logError=err=>errors.push(err);

const session=api.create({
  Peer:FakePeer,room:'ROOM',peerId,status,conns,puppets,props,NAMES,
  makePuppet,send,anatomy,propState,
  applyInput,handlePropInput,handleSpecialItemInput,handleJointRecovery,
  cleanLook,cleanPlayerName,removePuppet,setTimer,logError
});
assert.ok(session?.peer && session?.updateStatus && session?.freeSlot && session?.scenePayload && session?.handleDepthInput,'Host session did not expose its session helpers.');
assert.equal(session.peer.peerId,'stage-ROOM');

session.peer.emit('open');
assert.equal(status.textContent,'stage live — waiting for puppeteers');
assert.equal(session.freeSlot(),0);

const conn=new FakeConn('conn-a');
session.peer.emit('connection',conn);
assert.equal(conns.get(0),conn,'Accepted connection must occupy a free slot.');
assert.equal(puppets.has(0),true,'Accepted connection must create its puppet.');

conn.emit('open');
const sends=events.filter(e=>e[0]==='send'&&e[1]==='conn-a');
assert.equal(sends[0][2].type,'welcome','Connection should welcome the player before sending scene state.');
assert.equal(sends[0][2].slot,0);
assert.equal(sends[1][2].type,'scene');
assert.equal(sends[1][2].depthTuned,true,'Initial scene should pass through native depth tuning.');
assert.deepEqual(sends[1][2].stageViewport,{width:1024,height:768});
assert.equal(status.textContent,'1 puppeteer connected');
events.length=0;

conn.emit('data',{type:'input',tag:'x'});
assert.ok(events.some(e=>e[0]==='applyInput'&&e[1]===0),'Ordinary input must still reach puppet input handling.');
assert.ok(events.some(e=>e[0]==='propInput'&&e[1]===0),'Ordinary input must still reach prop handling.');
assert.ok(events.some(e=>e[0]==='specialInput'&&e[1]===0),'Ordinary input must still reach special-item handling.');
assert.ok(events.some(e=>e[0]==='recoverInput'&&e[1]===0),'Ordinary input must still reach recovery handling.');

depthSteps.length=0;
conn.emit('data',{type:'depth-step',direction:1});
assert.deepEqual(depthSteps,[{slot:0,direction:1}],'Depth-step messages must reach the native depth system for this slot.');

conn.emit('data',{type:'look',look:{style:'hat'},name:'  New Name  '});
assert.equal(puppets.get(0).look.style,'hat');
assert.equal(puppets.get(0).color,'#123456');
assert.equal(puppets.get(0).name,'New Name');

const stale=new FakeConn('stale');
conns.set(0,stale);
conn.emit('close');
assert.equal(puppets.has(0),true,'A stale connection must not remove the active puppet.');
conns.set(0,conn);
conn.emit('error',{type:'network'});
assert.equal(conns.has(0),false);
assert.equal(puppets.has(0),false,'Active disconnect must remove the puppet.');
assert.equal(status.textContent,'0 puppeteers connected');

for(let i=0;i<6;i++) conns.set(i,{id:`busy-${i}`});
const full=new FakeConn('full');
session.peer.emit('connection',full);
full.emit('open');
assert.ok(events.some(e=>e[0]==='send'&&e[1]==='full'&&e[2].type==='full'),'A seventh player must receive the table-full response.');
assert.equal(timers.at(-1)?.ms,120);
timers.at(-1).fn();
assert.equal(full.closed,true);
conns.clear();

session.peer.emit('error',{type:'unavailable-id'});
assert.equal(status.textContent,'table already in use — start another');
session.peer.emit('error',{type:'socket-error'});
assert.equal(status.textContent,'network error: socket-error');
assert.equal(errors.length,2);

console.log('Host session preserves player/session outcomes while owning depth messages natively rather than preserving V1 listener-count internals.');
