import fs from 'node:fs';

const html = fs.readFileSync('creator.html','utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length) throw new Error('creator.html has no inline script to check');
for(const source of scripts) new Function(source);
if(!html.includes('Reroll · 1 left')) throw new Error('single-use reroll control missing');
if(!html.includes('puppetalk-name')) throw new Error('player name persistence missing');
if(!html.includes("searchParams.set('lobby','done')")) throw new Error('lobby completion flag missing');
console.log('creator lobby smoke ok');