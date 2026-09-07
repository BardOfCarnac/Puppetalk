import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const fragment=fs.readFileSync('translation/prop-flow-parity-fragment.txt','utf8').trimEnd();

const sceneFrom="      propCount:Array.isArray(data.props)?data.props.length:0\n";
const sceneTo="      propCount:Array.isArray(data.props)?data.props.length:0,\n      props:Array.isArray(data.props)?data.props.map(prop=>({\n        id:prop?.id||null,type:prop?.type||null,x:Number(prop?.x),y:Number(prop?.y),\n        heldBy:prop?.heldBy?{slot:prop.heldBy.slot,hand:prop.heldBy.hand}:null,\n        armed:prop?.type==='frisbee'?!!prop?.armed:null\n      })):[]\n";
if(!source.includes(sceneFrom))throw new Error('Missing scene prop trace marker.');
source=source.replace(sceneFrom,sceneTo);

const msgMarker="    direction:Number.isFinite(data?.direction)?Number(data.direction):null,\n";
const msgInsert="    direction:Number.isFinite(data?.direction)?Number(data.direction):null,\n    hand:data?.hand||null,\n    vx:Number.isFinite(data?.vx)?Number(data.vx):null,\n    vy:Number.isFinite(data?.vy)?Number(data.vy):null,\n";
if(!source.includes(msgMarker))throw new Error('Missing message trace marker.');
source=source.replace(msgMarker,msgInsert);

const helperMarker='async function liveSession(prefix,room,label){';
if(!source.includes(helperMarker))throw new Error('Missing liveSession marker.');
source=source.replace(helperMarker,fragment+'\n\n'+helperMarker);

const flowFrom="  await sleep(120);\n  const after=await controllerState(controller);\n";
const flowTo="  await sleep(120);\n  const propInteraction=await exercisePropPickupThrow(controller,label,reply?.propId);\n  const after=await controllerState(controller);\n";
if(!source.includes(flowFrom))throw new Error('Missing special-item continuation marker.');
source=source.replace(flowFrom,flowTo);

const stateFrom="    reply,\n    afterHint:after.hint,\n";
const stateTo="    reply,\n    propInteraction,\n    afterHint:after.hint,\n";
if(!source.includes(stateFrom))throw new Error('Missing live state prop marker.');
source=source.replace(stateFrom,stateTo);

const validationMarker="    const touch=state.controls?.multiTouch;\n    if(touch?.down?.grabCount!==2||touch?.down?.parts?.join(',')!=='leftHand,rightHand'||touch?.move?.grabCount!==2||!touch.move.leftMovedLeft||!touch.move.rightMovedRight||touch?.up?.grabCount!==0){\n      throw new Error(`${label} two-pointer grab behavior was not observed: ${JSON.stringify(touch)}`);\n    }\n";
const validationInsert=validationMarker+"    const propFlow=state.propInteraction;\n    if(!propFlow?.pickup?.held||propFlow.pickup.action!=='tap'||!['left','right'].includes(propFlow.pickup.hand)||propFlow.pickup.reply!=='Picked up frisbee.'||propFlow.throw?.action!=='throw'||propFlow.throw.hand!==propFlow.pickup.hand||!propFlow.throw.fast||propFlow.throw.reply!=='Threw frisbee.'||!propFlow.throw.released||!propFlow.throw.armed){\n      throw new Error(`${label} prop pickup/throw behavior was not observed: ${JSON.stringify(propFlow)}`);\n    }\n";
if(!source.includes(validationMarker))throw new Error('Missing parity validation marker.');
source=source.replace(validationMarker,validationInsert);

const summaryFrom="Stage/controller handshake, body-drag walking, pose/ragdoll controls, centre pulse, direct torso drag, two-pointer grabbing, discrete depth gestures and frozen special-item behavior: pass";
const summaryTo="Stage/controller handshake, body-drag walking, pose/ragdoll controls, centre pulse, direct torso drag, two-pointer grabbing, discrete depth gestures, prop pickup/throw and frozen special-item behavior: pass";
if(!source.includes(summaryFrom))throw new Error('Missing parity summary marker.');
source=source.replace(summaryFrom,summaryTo);

fs.writeFileSync(path,source);
console.log('Added live prop pickup/throw browser parity coverage.');
