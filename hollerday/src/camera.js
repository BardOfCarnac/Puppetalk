import { WORLD } from "./config.js";

export function createCamera(canvas) {
  const camera = {
    canvas,
    cssWidth: 1,
    cssHeight: 1,
    dpr: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    camera.cssWidth = Math.max(1, rect.width);
    camera.cssHeight = Math.max(1, rect.height);
    camera.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(camera.cssWidth * camera.dpr);
    canvas.height = Math.round(camera.cssHeight * camera.dpr);

    camera.scale = Math.min(camera.cssWidth / WORLD.width, camera.cssHeight / WORLD.height);
    camera.offsetX = (camera.cssWidth - WORLD.width * camera.scale) / 2;
    camera.offsetY = (camera.cssHeight - WORLD.height * camera.scale) / 2;
  }

  function worldToScreen(x, y) {
    return {
      x: camera.offsetX + x * camera.scale,
      y: camera.offsetY + y * camera.scale,
    };
  }

  function screenToWorld(x, y) {
    return {
      x: (x - camera.offsetX) / camera.scale,
      y: (y - camera.offsetY) / camera.scale,
    };
  }

  resize();
  return { camera, resize, worldToScreen, screenToWorld };
}
