import fs from 'node:fs';
import vm from 'node:vm';

class Emitter {
  constructor(){ this.listeners = new Map(); }
  on(name, fn){
    if(!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(fn);
    return this;
  }
  emit(name, ...args){ for(const fn of this.listeners.get(name) || []) fn(...args); }
}

class FakeConnection extends Emitter {
  constructor(peer){ super(); this.peer = peer; this.open = false; this.sent = []; }
  send(payload){ this.sent.push(payload); }
  close(){ this.open = false; this.emit('close'); }
}
class FakeCall extends Emitter {
  constructor(peer, metadata={}){ super(); this.peer = peer; this.metadata = metadata; }
  answer(stream){ this.answered = stream ?? true; }
  close(){ this.emit('close'); }
}
class FakePeer extends Emitter {
  constructor(id='controller-test'){ super(); this.id = id; this.destroyed = false; }
  connect(id){ this.lastConnection = new FakeConnection(id); return this.lastConnection; }
  call(id, stream, options={}){ this.lastCall = new FakeCall(id, options.metadata); this.lastCall.stream = stream; return this.lastCall; }
}

const fakeTrack = { readyState:'live', enabled:true };
const fakeStream = { getAudioTracks:()=>[fakeTrack], getTracks:()=>[fakeTrack] };
let requestedConstraints = null;
const mediaDevices = {
  getSupportedConstraints:()=>({ echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:true, latency:true }),
  getUserMedia: async constraints => { requestedConstraints = constraints; return fakeStream; }
};

const stubNode = () => ({
  hidden:false, muted:false, srcObject:null, textContent:'', className:'', dataset:{}, style:{},
  appendChild(){}, remove(){}, pause(){}, play(){ return Promise.resolve(); }, setAttribute(){}, addEventListener(){},
  querySelector(){ return null; }, classList:{ add(){}, remove(){}, toggle(){} }
});
const document = {
  documentElement:stubNode(), head:stubNode(), body:stubNode(),
  createElement:stubNode, querySelector(){ return null; }
};
class MutationObserver { constructor(fn){ this.fn=fn; } observe(){} disconnect(){} }

const context = {
  console,
  URLSearchParams,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  location:{ search:'?mode=controller&room=TEST', href:'https://puppetalk.test/?mode=controller&room=TEST' },
  navigator:{ mediaDevices },
  document,
  MutationObserver,
  addEventListener(){},
  window:{ Peer:FakePeer }
};
context.window.window = context.window;
context.globalThis = context;

vm.runInNewContext(fs.readFileSync('sound-runtime.js','utf8'), context, { filename:'sound-runtime.js' });

if(context.window.Peer !== FakePeer) throw new Error('Sound runtime replaced Peer constructor');
const peer = new context.window.Peer();
let appOpenObserved = false;
peer.on('open',()=>{ appOpenObserved = true; });
const conn = peer.connect('puppetalk-test',{serialization:'json'});
conn.open = true;
conn.emit('open');
peer.emit('open');
if(!appOpenObserved) throw new Error('Sound runtime broke normal Peer event listeners');

await context.navigator.mediaDevices.getUserMedia({audio:true});
if(!requestedConstraints?.audio?.echoCancellation) throw new Error('Echo cancellation was not requested');
if(!requestedConstraints?.audio?.noiseSuppression) throw new Error('Noise suppression was not requested');
if(!requestedConstraints?.audio?.autoGainControl) throw new Error('Auto gain was not requested');
if(context.window.PuppetalkSound?.version !== 2) throw new Error('Sound runtime did not initialize');

console.log('Isolated sound runtime smoke check passed.');
process.exit(0);
