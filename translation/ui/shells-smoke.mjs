import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./shells.js',import.meta.url),'utf8'),context,{filename:'shells.js'});
const shells=context.window.PuppetalkViewShells;
assert.ok(shells?.stageShell && shells?.controllerShell && shells?.incompleteInviteShell,'View shell candidate did not install.');

assert.equal(
  shells.incompleteInviteShell(),
  '<section class="join-form"><div class="join-panel card"><strong>Puppetalk</strong><div class="muted small">This invite is incomplete.</div></div></section>'
);

const stage=shells.stageShell('ABCDE','https://example.test/?mode=controller&room=ABCDE');
assert.ok(stage.startsWith('\n    <section class="stage-shell">'));
assert.match(stage,/<div class="room-code">ABCDE<\/div>/);
assert.match(stage,/https:\/\/example\.test\/\?mode=controller&room=ABCDE/);
assert.match(stage,/<div class="small muted" id="stage-status">opening stage…<\/div>/);
assert.match(stage,/<canvas id="stage-canvas" aria-label="Puppetalk ensemble stage"><\/canvas>/);
assert.equal((stage.match(/id="stage-canvas"/g)||[]).length,1);

const poses={stand:[],point:[],cheer:[],shrug:[],crouch:[]};
const controller=shells.controllerShell('R2D2',poses);
assert.ok(controller.startsWith('\n    <section class="shell controller-shell personal-controller">'));
assert.match(controller,/room R2D2/);
assert.match(controller,/<canvas id="personal-canvas" aria-label="Your Puppetalk scene"><\/canvas>/);
assert.match(controller,/id="character-card"/);
assert.match(controller,/data-look="headStyle"/);
assert.match(controller,/id="character-colors"/);
assert.match(controller,/id="mic">Enable microphone<\/button>/);
assert.match(controller,/id="talk">Hold to talk<\/button>/);
assert.match(controller,/id="special-item" class="primary" type="button">Special item<\/button>/);
assert.match(controller,/id="centre">Centre me<\/button>/);
assert.match(controller,/id="retry">Reconnect<\/button>/);
const poseButtons=[...controller.matchAll(/<button data-pose="([^"]+)" class="([^"]*)">([^<]+)<\/button>/g)].map(m=>({pose:m[1],klass:m[2],text:m[3]}));
assert.deepEqual(poseButtons,[
  {pose:'stand',klass:'active',text:'stand'},
  {pose:'point',klass:'',text:'point'},
  {pose:'cheer',klass:'',text:'cheer'},
  {pose:'shrug',klass:'',text:'shrug'},
  {pose:'crouch',klass:'',text:'crouch'}
]);
assert.equal((controller.match(/data-rag/g)||[]).length,1);
assert.match(controller,/<button data-rag>Go limp<\/button>/);

console.log('View shell candidate preserves frozen stage/controller markup, room/join text, character and voice controls, pose order and first-pose active state.');
