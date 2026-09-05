import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./session.js',import.meta.url),'utf8'),context,{filename:'session.js'});
const api=context.window.PuppetalkControllerSession;
assert.ok(api?.create,'Controller session candidate did not install.');

class ClassList{
  constructor(){this.values=new Set(['quiet']);}
  add(v){this.values.add(v);}
  remove(v){this.values.delete(v);}
  has(v){return this.values.has(v);}
}
class FakeConn{
  constructor(){this.open=true;this.listeners=new Map();}
  on(type,fn){this.listeners.set(type,fn);}
  emit(type,value){this.listeners.get(type)?.(value);}
}
class FakePeer{
  static instances=[];
  constructor(){this.listeners=new Map();this.destroyed=false;this.destroyCalls=0;this.connectCalls=[];FakePeer.instances.push(this);}
  on(type,fn){this.listeners.set(type,fn);}
  emit(type,value){this.listeners.get(type)?.(value);}
  connect(id,options){this.connectCalls.push([id,options]);this.conn=new FakeConn();return this.conn;}
  destroy(){this.destroyCalls++;this.destroyed=true;}
}

const timers=[];
const cleared=[];
let nextTimer=1;
const setTimeoutFn=(callback,ms)=>{const id=nextTimer++;timers.push({id,callback,ms});return id;};
const clearTimeoutFn=id=>cleared.push(id);
const sent=[];
const input={pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[],look:{headStyle:'spikes'}};
const hint={textContent:'',classList:new ClassList()};
const youChip={hidden:true};
const status={textContent:''};
const dot={className:''};
const hookCalls=[];
const controller=api.create({
  Peer:FakePeer,room:'ABCDE',peerId:r=>`puppetalk-${r.toLowerCase()}`,NAMES:['Mara','Ivo','Nix'],input,
  send:(conn,msg)=>{if(conn?.open) sent.push(msg);},savedPlayerName:()=> 'Zed',
  hint,youChip,status,dot,setTimeoutFn,clearTimeoutFn
});
assert.ok(controller?.connect,'Controller session factory failed.');
controller.setHooks({
  updateSpecialItemButton:isOut=>hookCalls.push(['special',isOut]),
  updateGripButtons:()=>hookCalls.push(['grips']),
  renderPersonalScene:()=>hookCalls.push(['render'])
});

controller.transmit(true);
assert.equal(sent.length,0,'Input must not transmit before a connection opens.');
controller.connect();
assert.equal(controller.getConnectGeneration(),1);
assert.equal(status.textContent,'connecting');
assert.equal(dot.className,'status-dot ');
assert.equal(hint.textContent,'Connecting to the ensemble…');
const firstPeer=controller.getPeer();
assert.equal(firstPeer,FakePeer.instances[0]);
firstPeer.emit('open');
assert.equal(status.textContent,'joining…');
assert.deepEqual(JSON.parse(JSON.stringify(firstPeer.connectCalls)),[['puppetalk-abcde',{serialization:'json'}]]);
const conn=controller.getConn();
assert.ok(conn?.open);

conn.emit('data',{type:'welcome',slot:2,name:'Fallback'});
assert.equal(controller.getSlot(),2);
assert.equal(status.textContent,'you are Zed');
assert.equal(dot.className,'status-dot live');
assert.equal(youChip.hidden,false);
assert.equal(hint.textContent,'Use one or two fingers on any grab point');
assert.deepEqual(hookCalls.shift(),['special',false]);
assert.equal(timers.at(-1).ms,3000);
assert.equal(sent.length,2);
assert.equal(sent[0].type,'input');
assert.equal(sent[1].type,'look');
assert.equal(sent[1].name,'Zed');

controller.transmit();
assert.equal(sent.length,2,'Unchanged input must be deduplicated.');
input.mouth=1;
controller.transmit();
assert.equal(sent.length,3);
assert.equal(sent.at(-1).type,'input');

conn.emit('data',{type:'scene',puppets:[{slot:2}],props:[{id:1}]});
assert.deepEqual(JSON.parse(JSON.stringify(controller.getScene())),[{slot:2}]);
assert.deepEqual(JSON.parse(JSON.stringify(controller.getPropScene())),[{id:1}]);
assert.deepEqual(hookCalls.splice(0),[['grips'],['render']]);
conn.emit('data',{type:'scene',puppets:'bad',props:null});
assert.deepEqual(JSON.parse(JSON.stringify(controller.getScene())),[]);
assert.deepEqual(JSON.parse(JSON.stringify(controller.getPropScene())),[]);
hookCalls.splice(0);

hint.classList.add('quiet');
conn.emit('data',{type:'prop-result',ok:true});
assert.equal(hint.textContent,'Prop grip updated.');
assert.equal(hint.classList.has('quiet'),false);
assert.equal(timers.at(-1).ms,1500);
conn.emit('data',{type:'prop-result',ok:false});
assert.equal(hint.textContent,'Could not grip prop.');
conn.emit('data',{type:'prop-result',ok:false,message:'Nope'});
assert.equal(hint.textContent,'Nope');

conn.emit('data',{type:'special-item-result',ok:true});
assert.equal(hint.textContent,'Special item updated.');
assert.deepEqual(hookCalls.shift(),['special',true]);
assert.equal(timers.at(-1).ms,1700);
conn.emit('data',{type:'special-item-result',alreadyOut:true,message:'Already'});
assert.deepEqual(hookCalls.shift(),['special',true]);
assert.equal(hint.textContent,'Already');

conn.emit('data',{type:'full'});
assert.equal(status.textContent,'table is full');
assert.equal(dot.className,'status-dot bad');
assert.equal(hint.textContent,'This table already has six puppeteers.');

conn.emit('close');
assert.equal(status.textContent,'reconnecting…');
assert.equal(dot.className,'status-dot bad');
const reconnect=controller.getReconnectTimer();
assert.ok(reconnect);
assert.equal(timers.find(t=>t.id===reconnect).ms,1200);
const timerCount=timers.length;
conn.emit('error');
assert.equal(timers.length,timerCount,'Repeated close/error must not schedule duplicate reconnects.');
const reconnectTask=timers.find(t=>t.id===reconnect);
reconnectTask.callback();
assert.equal(controller.getConnectGeneration(),2);
assert.equal(firstPeer.destroyCalls,1);
assert.equal(status.textContent,'connecting');
const secondPeer=controller.getPeer();
assert.notEqual(secondPeer,firstPeer);

// A stale connection from the prior generation cannot schedule another reconnect.
conn.emit('close');
assert.equal(controller.getReconnectTimer(),null);

secondPeer.emit('error',{type:'peer-unavailable'});
assert.equal(status.textContent,'table not found');
assert.equal(dot.className,'status-dot bad');
secondPeer.emit('error',{type:'network'});
assert.equal(status.textContent,'network error: network');
secondPeer.emit('error',{});
assert.equal(status.textContent,'network error: unknown');

// Manual reconnect clears an outstanding timer before replacing the peer.
secondPeer.emit('open');
const secondConn=controller.getConn();
secondConn.emit('close');
const pending=controller.getReconnectTimer();
assert.ok(pending);
controller.connect();
assert.ok(cleared.includes(pending));
assert.equal(controller.getReconnectTimer(),null);
assert.equal(secondPeer.destroyCalls,1);

console.log('Controller session candidate preserves V1 peer/connection lifecycle, slot and scene ownership, input dedupe, result messaging, reconnect generation guards and network status semantics.');
