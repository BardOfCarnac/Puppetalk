// Frozen runtime composition for the Puppetalk translation branch.
// Keep this in exact index.html order. The order is behavioural because many
// pre-boot scripts decorate window.fetch and transform app.js sequentially.

export const styles = Object.freeze([
  './public/styles.css?v=31',
  './join.css?v=31',
  './fullscreen-controller.css?v=31',
  './character-creator.css?v=2'
]);

export const scripts = Object.freeze([
  './lobby-routing.js?v=2',
  'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js',
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',
  './stability.js?v=23',
  './pose-tuning.js?v=25',
  './foreground-tuning.js?v=36',
  './locomotion.js?v=32',
  './scene-camera.js?v=1',
  './device-projection.js?v=37',
  './segmented-stance-compat.js?v=4',
  './jump-feel.js?v=35',
  './control-feel.js?v=31',
  './fullscreen-controller.js?v=34',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  './look-migration.js?v=1',
  './character-creator-patch.js?v=2',
  './character-creator-hotfix.js?v=1',
  './line-face-mouths-patch.js?v=2',
  './line-face-features-patch.js?v=2',
  './face-spacing-patch.js?v=3',
  './profile-name-patch.js?v=2',
  './live-face-render-patch.js?v=2',
  './toy-system.js?v=1',
  './toy-tap.js?v=3',
  './dart-stick.js?v=1',
  './balloon-tie.js?v=2',
  './toy-throw.js?v=2',
  './prop-extremities.js?v=1',
  './balloon-buoyancy.js?v=2',
  './dart-balloon-pop.js?v=1',
  './severable-joints.js?v=1',
  './laser-frisbee.js?v=1',
  './item-polish.js?v=1',
  './special-items.js?v=3',
  './segmented-puppet.js?v=1',
  './seat-render.js?v=1',
  './depth-assist.js?v=1',
  './visual-thickness.js?v=1',
  './boot.js?v=32'
]);

// These scripts are the source-transforming layer between raw app.js and boot.js.
// Versions are intentionally stripped here because Node smoke tests read files.
export const appSourceDecorators = Object.freeze([
  'character-creator-patch.js',
  'character-creator-hotfix.js',
  'line-face-mouths-patch.js',
  'line-face-features-patch.js',
  'face-spacing-patch.js',
  'profile-name-patch.js',
  'live-face-render-patch.js',
  'toy-system.js',
  'toy-tap.js',
  'dart-stick.js',
  'balloon-tie.js',
  'toy-throw.js',
  'prop-extremities.js',
  'balloon-buoyancy.js',
  'dart-balloon-pop.js',
  'severable-joints.js',
  'laser-frisbee.js',
  'item-polish.js',
  'special-items.js',
  'segmented-puppet.js',
  'seat-render.js',
  'depth-assist.js',
  'visual-thickness.js'
]);

export const bootScript = 'boot.js';
export const rawAppSource = 'app.js';
