import fs from 'node:fs';

function replaceOnce(source,label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label}.`);
  if(source.indexOf(from,first+1)>=0) throw new Error(`${label} matched more than once.`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const buildPath='translation/build-runtime.mjs';
let build=fs.readFileSync(buildPath,'utf8');
const insertion='new Function(source);';
if(!build.includes(insertion)) throw new Error('Missing runtime syntax-check anchor.');

const dispatchFrom=`if(mode === 'controller') startController(room);\nelse startStage(room || roomCode());`;
const dispatchTo=`const stageApp = window.PuppetalkStageApp?.create?.({\n  app,document,stageShell,clamp,angleDelta,NAMES,COLORS,defaultLook,cleanLook,\n  GRAB_PARTS,POSES,ensureRig,resetPins,antiTangleTarget,rootFollow,\n  drawBackdrop,drawProp,drawAnatomy,send,peerId,cleanPlayerName\n});\nif(!stageApp) throw new Error('Puppetalk stage app failed to load.');\nconst {startStage} = stageApp;\n\nif(mode === 'controller') startController(room);\nelse startStage(room || roomCode());`;
const transforms=`replaceOnce('stage app setup',${JSON.stringify(dispatchFrom)},${JSON.stringify(dispatchTo)});\n\nremoveBetweenOnce('embedded stage app composition','function startStage(room){','\\n\\n\\n\\n})();');`;
build=replaceOnce(build,'runtime syntax-check insertion',insertion,`${transforms}\n\n${insertion}`);
fs.writeFileSync(buildPath,build);

const indexPath='translation/index.html';
let index=fs.readFileSync(indexPath,'utf8');
index=replaceOnce(index,'stage lifecycle script',
  '  <script src="./translation/stage/stage-lifecycle.js?v=1"></script>\n',
  '  <script src="./translation/stage/stage-lifecycle.js?v=1"></script>\n  <script src="./translation/stage/app.js?v=1"></script>\n'
);
fs.writeFileSync(indexPath,index);

const smokePath='translation/entry-smoke.mjs';
let smoke=fs.readFileSync(smokePath,'utf8');
smoke=replaceOnce(smoke,'expected stage lifecycle script',
  "expectedRuntime.push('./translation/stage/stage-lifecycle.js?v=1');\n",
  "expectedRuntime.push('./translation/stage/stage-lifecycle.js?v=1');\nexpectedRuntime.push('./translation/stage/app.js?v=1');\n"
);
smoke=replaceOnce(smoke,'stage lifecycle assertion',
  "assert.ok(actualScripts.includes('./translation/stage/stage-lifecycle.js?v=1'),'Extracted stage lifecycle is missing.');\n",
  "assert.ok(actualScripts.includes('./translation/stage/stage-lifecycle.js?v=1'),'Extracted stage lifecycle is missing.');\nassert.ok(actualScripts.includes('./translation/stage/app.js?v=1'),'Extracted stage app composition is missing.');\n"
);
fs.writeFileSync(smokePath,smoke);

const parityPath='translation/runtime-parity-smoke.mjs';
let parity=fs.readFileSync(parityPath,'utf8');
const stageShellOld="assert.match(actual,/app\\.innerHTML = stageShell\\(room,joinUrl\\.href\\);/,'Stage does not render through extracted view shell.');";
const stageShellNew="const stageAppSource=fs.readFileSync('translation/stage/app.js','utf8');\nassert.match(actual,/PuppetalkStageApp/,'Translated runtime is not connected to extracted stage app composition.');\nassert.doesNotMatch(actual,/function startStage\\(room\\)/,'Embedded startStage survived stage-app extraction.');\nassert.match(stageAppSource,/app\\.innerHTML = stageShell\\(room,joinUrl\\.href\\);/,'Stage app does not render through extracted view shell.');";
parity=replaceOnce(parity,'stage app parity boundary',stageShellOld,stageShellNew);

const stageBindingAssertions=[
"assert.match(actual,/const \\{makePuppet\\} = rigFactory;/,'Runtime callers are not bound to the extracted makePuppet.');",
"assert.match(actual,/const \\{severJoint,repairSeveredJoints,handleJointRecovery,severSeam,repairBrokenSeams\\} = recoverySystem;/,'Runtime callers are not bound to the extracted recovery system.');",
"assert.match(actual,/const \\{anatomy\\} = sceneState;/,'Runtime callers are not bound to the extracted anatomy serializer.');",
"assert.match(actual,/const \\{applyInput\\} = inputSystem;/,'Runtime callers are not bound to the extracted input normalizer.');",
"assert.match(actual,/const \\{drivePuppet\\} = puppetDriver;/,'Runtime callers are not bound to the extracted puppet driver.');",
"assert.match(actual,/const \\{removePuppet\\} = puppetLifecycle;/,'Runtime callers are not bound to the extracted puppet lifecycle.');",
"assert.match(actual,/const \\{drawStage,broadcastScene,tick\\} = stageLoop;/,'Runtime callers are not bound to the extracted stage loop.');",
"assert.match(actual,/const \\{peer,updateStatus,freeSlot\\} = hostSession;/,'Runtime is not bound to the extracted host session.');",
"assert.match(actual,/const \\{handBody,handPoint,propGripLocalPoint,validPropEffector,gripKey,ATTACHABLE_PARTS,puppetPartForBody,propForBody,closestPointOnBody,nearestBalloonTarget,localOffset,worldOffset\\} = propGeometry;/,'Runtime is not bound to extracted prop geometry.');",
"assert.match(actual,/const \\{balloonAttachmentState,propState\\} = propStateSystem;/,'Runtime is not bound to extracted prop state.');",
"assert.match(actual,/const \\{makeProp,ensureTestProps,ensureLegacyTestProps\\} = propFactory;/,'Runtime is not bound to extracted prop factory.');",
"assert.match(actual,/const \\{pumpNozzleOffset,ensurePumpBalloon,inflatePumpBalloon,releasePumpBalloon\\} = pumpBalloonSystem;/,'Runtime is not bound to extracted pump balloon lifecycle.');",
"assert.match(actual,/const \\{distancePointToSegment,dartTouchesBalloon,popBalloon,driveDartBalloonPops\\} = balloonPops;/,'Runtime is not bound to extracted balloon pops.');",
"assert.match(actual,/const \\{tieBalloonToBody,driveAttachedBalloon\\} = balloonLift;/,'Runtime is not bound to extracted balloon lift.');",
"assert.match(actual,/const \\{updatePropContest,driveProps\\} = propDriver;/,'Runtime is not bound to extracted prop driver.');",
"assert.match(actual,/const \\{pointSegmentDistance,driveLaserFrisbeeCuts\\} = laserFrisbee;/,'Runtime is not bound to extracted laser frisbee.');",
"assert.match(actual,/const \\{puppetalkAimProjectPoint,puppetalkAimProjectPropPoint,driveDepthAssistedProps\\} = depthAssist;/,'Runtime is not bound to extracted depth assist.');",
"assert.match(actual,/const \\{gripRecord,freePropHand,clearPropGrip,makePropGrip,cancelPropContest,promotePropContest,releasePropHolder,beginPropHold,beginPropContest\\} = propGripCore;/,'Runtime is not bound to the extracted prop grip core.');",
"assert.match(actual,/const \\{attachPropToBody,detachPropAttachment,syncAttachedProp\\} = propAttachmentCore;/,'Runtime is not bound to the extracted prop attachment core.');",
"assert.match(actual,/const \\{propHandIsClose,tapProp,releaseAllPropGrips,throwHeldProp,handlePropInput\\} = propInputSystem;/,'Runtime is not bound to extracted prop input.');",
"assert.match(actual,/const \\{specialItemLabel,specialItemType,specialItemStillOut,bringOutSpecialItem,handleSpecialItemInput\\} = specialItemSystem;/,'Runtime is not bound to extracted special items.');",
"assert.match(actual,/const \\{installDartImpacts\\} = dartImpacts;/,'Runtime is not bound to the extracted dart impacts.');",
"assert.match(actual,/const \\{installPropContactPhysics\\} = propContactPhysics;/,'Runtime is not bound to the extracted prop contact physics.');"
];
for(let i=0;i<stageBindingAssertions.length;i++){
  const oldLine=stageBindingAssertions[i];
  parity=replaceOnce(parity,`stage composition binding ${i+1}`,oldLine,oldLine.replace('assert.match(actual','assert.match(stageAppSource').replaceAll("'Runtime ","'Stage app ").replaceAll("'Runtime callers ","'Stage app callers "));
}
parity=replaceOnce(parity,'stage lifecycle factory binding',
  "assert.match(actual,/const stageLifecycle = window\\.PuppetalkStageLifecycle\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted stage lifecycle.');",
  "assert.match(stageAppSource,/const stageLifecycle = root\\.PuppetalkStageLifecycle\\?\\.create\\?\\.\\(\\{/,'Stage app is not bound to extracted stage lifecycle.');"
);
parity=replaceOnce(parity,'stage lifecycle startup binding',
  "assert.match(actual,/stageLifecycle\\.start\\(\\);/,'Extracted stage lifecycle is not started.');",
  "assert.match(stageAppSource,/stageLifecycle\\.start\\(\\);/,'Extracted stage lifecycle is not started by stage app.');"
);
fs.writeFileSync(parityPath,parity);

console.log('Wired frozen stage app composition into the translated runtime.');
