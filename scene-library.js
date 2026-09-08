// Registers Puppetalk's approved photographic scenes with the rebuilt root app.
// The responsive crop/render work stays in scene-camera.js; this file supplies the
// actual images that were accidentally left behind in the old Hollerday sub-build.
(() => {
  if (window.PuppetalkSceneLibrary) return;

  const camera = window.PuppetalkSceneCamera;
  if (!camera?.registerScenes || !camera?.setScene) {
    console.warn('Puppetalk scene library loaded before scene camera.');
    return;
  }

  const scenes = [
    {
      id: 'western-town',
      label: 'Western town',
      image: 'https://unsplash.com/photos/1mmSOl66HGE/download?force=true&w=1800',
      floor: { horizon: .66, baseline: .88, left: .04, right: .96 },
      crops: {
        tall: { focusX: .50, focusY: .57, zoom: 1.08 },
        standard: { focusX: .50, focusY: .57, zoom: 1.04 },
        wide: { focusX: .50, focusY: .56, zoom: 1.02 }
      }
    },
    {
      id: 'lumber-yard',
      label: 'Lumber yard',
      image: 'https://unsplash.com/photos/uj7-cj5OxmI/download?force=true&w=1800',
      floor: { horizon: .65, baseline: .88, left: .04, right: .96 },
      crops: {
        tall: { focusX: .50, focusY: .58, zoom: 1.08 },
        standard: { focusX: .50, focusY: .57, zoom: 1.04 },
        wide: { focusX: .50, focusY: .56, zoom: 1.02 }
      }
    },
    {
      id: 'seabed',
      label: 'Seabed',
      image: 'https://unsplash.com/photos/Y6i5__8wmEM/download?force=true&w=1800',
      floor: { horizon: .64, baseline: .88, left: .04, right: .96 },
      crops: {
        tall: { focusX: .50, focusY: .58, zoom: 1.07 },
        standard: { focusX: .50, focusY: .57, zoom: 1.02 },
        wide: { focusX: .50, focusY: .56, zoom: 1.00 }
      }
    },
    {
      id: 'clifftop',
      label: 'Clifftop',
      image: 'https://unsplash.com/photos/hxeifzBanNI/download?force=true&w=1800',
      floor: { horizon: .63, baseline: .88, left: .04, right: .96 },
      crops: {
        tall: { focusX: .50, focusY: .62, zoom: 1.10 },
        standard: { focusX: .50, focusY: .61, zoom: 1.05 },
        wide: { focusX: .50, focusY: .59, zoom: 1.02 }
      }
    },
    {
      id: 'forest-mist',
      label: 'Forest clearing',
      image: 'https://unsplash.com/photos/qL1MqlSyu1A/download?force=true&w=1800',
      floor: { horizon: .65, baseline: .88, left: .04, right: .96 },
      crops: {
        tall: { focusX: .50, focusY: .60, zoom: 1.09 },
        standard: { focusX: .50, focusY: .59, zoom: 1.04 },
        wide: { focusX: .50, focusY: .58, zoom: 1.02 }
      }
    },
    {
      id: 'forest-clearing',
      label: 'Woodland clearing',
      image: 'https://unsplash.com/photos/lJOo9XGZnls/download?force=true&w=1800',
      floor: { horizon: .65, baseline: .88, left: .04, right: .96 },
      crops: {
        tall: { focusX: .50, focusY: .60, zoom: 1.09 },
        standard: { focusX: .50, focusY: .59, zoom: 1.04 },
        wide: { focusX: .50, focusY: .58, zoom: 1.02 }
      }
    },
    {
      id: 'ruins',
      label: 'Ruins',
      image: 'https://unsplash.com/photos/NIrZPwqeaNg/download?force=true&w=1800',
      floor: { horizon: .65, baseline: .88, left: .04, right: .96 },
      crops: {
        tall: { focusX: .50, focusY: .60, zoom: 1.09 },
        standard: { focusX: .50, focusY: .59, zoom: 1.04 },
        wide: { focusX: .50, focusY: .58, zoom: 1.02 }
      }
    }
  ];

  camera.registerScenes(scenes);

  const params = new URLSearchParams(location.search);
  const room = String(params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  function hashRoom(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function sceneForRoom(value) {
    if (!value) return null;
    return scenes[hashRoom(value) % scenes.length];
  }

  const initialScene = sceneForRoom(room);
  if (initialScene) camera.setScene(initialScene.id);

  window.PuppetalkSceneLibrary = {
    version: 1,
    scenes: scenes.map(scene => ({ id: scene.id, label: scene.label })),
    sceneForRoom,
    setScene(id) { return camera.setScene(id); }
  };
})();
