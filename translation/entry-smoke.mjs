import fs from 'node:fs';
import assert from 'node:assert/strict';
import {styles,scripts} from './manifest.mjs';

const html = fs.readFileSync('translation/index.html','utf8');
const actualStyles = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
const actualScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(m=>m[1]);

assert.match(html,/<title>Puppetalk<\/title>/,'Translation entry changed the product name.');
assert.match(html,/<main id="app" aria-live="polite"><\/main>/,'Translation entry changed the app mount.');
assert.match(html,/<base href="\.\.\/"\s*\/>/,'Translation entry must resolve frozen runtime files from repository root.');
assert.deepEqual(actualStyles,[...styles],'Translation entry styles differ from frozen Puppetalk.');
assert.deepEqual(actualScripts,[...scripts],'Translation entry runtime order differs from frozen Puppetalk.');

console.log('Translation entry is a behaviour-identical Puppetalk shell.');
