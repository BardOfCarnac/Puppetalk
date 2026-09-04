import fs from 'node:fs';

const html = fs.readFileSync('load.html','utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length) throw new Error('load.html has no inline script to check');
for(const source of scripts) new Function(source);

for(const required of [
  'your character',
  'Start the show',
  'Join the show',
  'Invite players',
  'Randomize once',
  'puppetalk-profile-randomized-v1',
  'puppetalk-name',
  'puppetalk-look',
  'puppetalk-special-item',
  "searchParams.set('lobby','done')"
]) if(!html.includes(required)) throw new Error(`pre-show character hook missing: ${required}`);

if(/Edit character|data-key=|class="editor"/.test(html)) throw new Error('Old detailed character editor survived into normal pre-show screen');
console.log('character-first pre-show smoke ok');