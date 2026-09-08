import fs from 'node:fs';

const source = fs.readFileSync('scene-library.js','utf8');
const index = fs.readFileSync('index.html','utf8');

for (const marker of [
  "id: 'western-town'",
  "id: 'lumber-yard'",
  "id: 'seabed'",
  "id: 'clifftop'",
  "id: 'forest-mist'",
  "id: 'forest-clearing'",
  "id: 'ruins'",
  'camera.registerScenes(scenes)',
  'camera.setScene(initialScene.id)',
  'sceneForRoom(room)'
]) {
  if (!source.includes(marker)) throw new Error(`Missing scene-library marker: ${marker}`);
}

const cameraAt = index.indexOf('./scene-camera.js');
const libraryAt = index.indexOf('./scene-library.js');
const projectionAt = index.indexOf('./device-projection.js');
const bootAt = index.indexOf('./boot.js');
if (cameraAt < 0 || libraryAt < 0 || projectionAt < 0 || bootAt < 0) {
  throw new Error('Root scene scripts are not all present in index.html.');
}
if (!(cameraAt < libraryAt && libraryAt < projectionAt && projectionAt < bootAt)) {
  throw new Error('Root scene library must load after scene-camera and before projection/boot.');
}

console.log('Root Puppetalk approved background library is registered and loaded in the correct order.');
