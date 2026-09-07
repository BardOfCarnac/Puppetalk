import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const root={};
const context={window:root,globalThis:root,Math};
vm.runInNewContext(source,context,{filename:'controller/app.js'});
const api=root.PuppetalkControllerApp;
assert.ok(api?.create,'Controller app candidate did not install.');
assert.equal(api.create(),null,'Incomplete controller app dependencies must fail closed.');

const app={textContent:'',innerHTML:''};
const POSES={stand:[0]};
const common={
  app,document:{querySelector(){return null;}},POSES,
  LOOK_PALETTE:['#fff'],LOOK_PARTS:{},cleanLook:v=>v,saveLook(){},savedLook:()=>({}),
  peerId:r=>`puppetalk-${r}`,NAMES:['Mara'],send(){},savedPlayerName:()=>'',clamp:v=>v,
  drawBackdrop(){},puppetalkSeatProjection(){},drawProp(){},drawAnatomy(){},
  incompleteInviteShell:()=>'<bad-invite>',controllerShell:room=>`<controller>${room}</controller>`
};
const noPeer=api.create(common);
noPeer.startController('ROOM');
assert.equal(app.textContent,'Puppetalk network library failed to load.');

root.Peer=function Peer(){};
app.textContent='';
const badInvite=api.create(common);
badInvite.startController('');
assert.equal(app.innerHTML,'<bad-invite>');

const calls=[];
const elements=new Map();
const canvas={getContext:()=>({})};
for(const id of ['#personal-stage','#stage-hint','#you-chip','#dot','#controller-status','#mic','#level','#talk']) elements.set(id,{});
elements.set('#personal-canvas',canvas);
const body={classList:{add:name=>calls.push(`body:${name}`)}};
const document={body,querySelector:selector=>elements.get(selector)||null};
root.devicePixelRatio=2;
root.addEventListener=()=>{};
root.setTimeout=()=>1;
root.clearTimeout=()=>{};
root.setInterval=()=>2;
root.clearInterval=()=>{};
root.requestAnimationFrame=()=>3;
root.cancelAnimationFrame=()=>{};
root.queueMicrotask=fn=>fn();
root.performance={now:()=>123};
root.localStorage={};
root.navigator={mediaDevices:{getUserMedia:()=>Promise.resolve({})}};
root.AudioContext=function AudioContext(){};
root.displayPoint=()=>({x:1,y:2});

const getDimensions=()=>({cw:320,ch:300});
const getConn=()=>({open:true});
const getSlot=()=>0;
const getScene=()=>[];
const getPropScene=()=>[];
const transmit=()=>{};
const connect=()=>calls.push('connect');
const renderPersonalScene=()=>{};
const activePointers=new Map();
const heldProp=()=>null;
const pointerToWorld=()=>({x:0,y:0});
const updateSpecialItemButton=value=>calls.push(`special:${value}`);
const updateGripButtons=()=>{};

root.PuppetalkControllerCanvas={create:()=>({getDimensions,setRender:fn=>calls.push(fn===renderPersonalScene?'canvas:setRender':'canvas:setRender?'),start:()=>calls.push('canvas:start')})};
root.PuppetalkControllerSession={create:()=>({setStatus(){},transmit,connect,getConn,getSlot,getScene,getPropScene,setHooks:hooks=>calls.push(hooks.renderPersonalScene===renderPersonalScene?'session:setHooks':'session:setHooks?')})};
root.PuppetalkControllerPuppetry={create:()=>({activePointers,myPuppet(){},grabSpots(){},renderGrabHandles(){},renderPersonalScene,pointerToWorld,pickGrab(){},describeActiveGrabs(){},install:()=>calls.push('puppet:install')})};
root.PuppetalkControllerItems={create:()=>({controllerSpecialType(){},controllerSpecialLabel(){},updateSpecialItemButton,bringOutMySpecialItem(){},heldProp,updateGripButtons,toggleGrip(){},propDisplayPoint(){},pickTappedProp(){},nearestPropHand(){},installPropTap:()=>calls.push('items:propTap'),installButtons:()=>calls.push('items:buttons')})};
root.PuppetalkCharacterCreator={create:()=>({install:()=>calls.push('creator:install')})};
root.PuppetalkControllerThrowGesture={create:()=>({install:()=>calls.push('throw:install')})};
root.PuppetalkControllerCommands={create:()=>({install:()=>calls.push('commands:install')})};
root.PuppetalkControllerAudio={create:()=>({install:()=>calls.push('audio:install')})};

const full=api.create({...common,document,savedLook:()=>({color:'#fff'})});
full.startController('AB12');
assert.equal(app.innerHTML,'<controller>AB12</controller>');
assert.deepEqual(calls,[
  'body:puppetalk-fullscreen','canvas:setRender','session:setHooks','puppet:install','items:propTap','creator:install','throw:install',
  'commands:install','items:buttons','special:false','audio:install','canvas:start','connect'
],'Translated controller composition or fullscreen ownership changed.');

console.log('Controller app preserves library failure/invite fallback, owns fullscreen mode and installs its subsystems coherently.');
