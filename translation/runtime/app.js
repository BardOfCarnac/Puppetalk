(function(){
const app = document.querySelector('#app');
const runtimeRoute = window.PuppetalkRuntimeRoute?.create?.({URLSearchParamsClass:URLSearchParams});
if(!runtimeRoute) throw new Error('Puppetalk runtime route failed to load.');
const {mode,room} = runtimeRoute.parse(location.search);
const {COLORS,NAMES} = window.PuppetalkRuntimeConfig || {};
if(!COLORS || !NAMES) throw new Error('Puppetalk runtime config failed to load.');

const {LOOK_PALETTE,LOOK_PARTS,defaultLook,cleanLook} = window.PuppetalkLookModel || {};
if(!LOOK_PALETTE || !LOOK_PARTS || !defaultLook || !cleanLook){
  throw new Error('Puppetalk look model failed to load.');
}

const runtimeHelpers = window.PuppetalkRuntimeHelpers?.create?.({
  cleanLook,defaultLook,getStorage:()=>localStorage,random:()=>Math.random()
});
if(!runtimeHelpers) throw new Error('Puppetalk runtime helpers failed to load.');
const {clamp,clean,peerId,send,cleanPlayerName,savedPlayerName,savedLook,saveLook,roomCode,angleDelta} = runtimeHelpers;

const {
  POSES,GRAB_PARTS,ensureRig,resetPins,antiTangleTarget,rootFollow
} = window.PuppetalkCharacterRigCore || {};
if(!POSES || !GRAB_PARTS || !ensureRig || !resetPins || !antiTangleTarget || !rootFollow){
  throw new Error('Puppetalk character rig core failed to load.');
}


const sceneRenderer = window.PuppetalkSceneRenderer?.create?.({
  cleanLook,document,
  Path2DClass:typeof Path2D === 'function' ? Path2D : null,
  getDisplayPoint:()=>typeof displayPoint === 'function' ? displayPoint : null,
  getProjectionRenderScale:()=>typeof projectionRenderScale === 'function' ? projectionRenderScale : null
});
if(!sceneRenderer) throw new Error('Puppetalk scene renderer failed to load.');
const {drawBackdrop,drawAnatomy,drawProp,roundRect} = sceneRenderer;

const seatProjection = window.PuppetalkSeatProjection?.create?.({
  getDepthState:()=>window.PuppetalkDepthState,
  getForegroundTuning:()=>window.PuppetalkForegroundTuning
});
if(!seatProjection) throw new Error('Puppetalk seat projection failed to load.');
const {puppetalkSeatProjection} = seatProjection;

const {incompleteInviteShell,stageShell,controllerShell} = window.PuppetalkViewShells || {};
if(!incompleteInviteShell || !stageShell || !controllerShell){
  throw new Error('Puppetalk view shells failed to load.');
}

const controllerApp = window.PuppetalkControllerApp?.create?.({
  app,document,POSES,LOOK_PALETTE,LOOK_PARTS,cleanLook,saveLook,savedLook,
  peerId,NAMES,send,savedPlayerName,clamp,drawBackdrop,puppetalkSeatProjection,
  drawProp,drawAnatomy,incompleteInviteShell,controllerShell
});
if(!controllerApp) throw new Error('Puppetalk controller app failed to load.');
const {startController} = controllerApp;

const stageApp = window.PuppetalkStageApp?.create?.({
  app,document,stageShell,clamp,angleDelta,NAMES,COLORS,defaultLook,cleanLook,
  GRAB_PARTS,POSES,ensureRig,resetPins,antiTangleTarget,rootFollow,
  drawBackdrop,drawProp,drawAnatomy,send,peerId,cleanPlayerName
});
if(!stageApp) throw new Error('Puppetalk stage app failed to load.');
const {startStage} = stageApp;

if(mode === 'controller') startController(room);
else startStage(room || roomCode());





})();
