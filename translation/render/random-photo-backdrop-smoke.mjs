import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('./random-photo-backdrop.js',import.meta.url),'utf8');
let selectedRoom='';
let photoReady=true;
let photoDraws=0;
let fallbackDraws=0;
const camera={
  selectForRoom(room){selectedRoom=room;return {id:'photo-scene'};},
  drawBackdrop(){photoDraws+=1;return photoReady;},
  getScene(){return {id:'photo-scene'};}
};
const renderer={
  create(){return {drawBackdrop(){fallbackDraws+=1;}};}
};
const root={
  PuppetalkSceneCamera:camera,
  PuppetalkSceneRenderer:renderer,
  location:{search:'?mode=controller&room=abc123!!'},
  URLSearchParams
};
const context={window:root,globalThis:root,URLSearchParams,String};
vm.runInNewContext(source,context,{filename:'random-photo-backdrop.js'});

assert.equal(selectedRoom,'ABC123','Room selection should be normalized and shared by every client.');
assert.equal(root.PuppetalkPhotoBackdrop.room,'ABC123');
assert.equal(root.PuppetalkPhotoBackdrop.scene().id,'photo-scene');
assert.equal(renderer.__puppetalkPhotoBackdropInstalled,true);

const api=renderer.create({});
assert.equal(api.drawBackdrop({},320,360),true,'Loaded photograph should own the backdrop.');
assert.equal(photoDraws,1);
assert.equal(fallbackDraws,0);

photoReady=false;
assert.equal(api.drawBackdrop({},320,360),false,'Procedural stage should remain the fallback while a photo is unavailable.');
assert.equal(photoDraws,2);
assert.equal(fallbackDraws,1);

console.log('Random photo backdrop selects a stable room scene and preserves the procedural fallback.');
