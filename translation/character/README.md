# Character runtime

Puppetalk's rebuilt character stack now lives under `translation/character/`.

The runtime owns:

- rig construction and segmented body geometry
- pose/grab state and input normalization
- dragging, anti-tangle guidance and root following
- standing/balance/servo drive
- recover vs stand semantics and severed-joint recovery
- stability/runaway damping and joint limits
- readable pose reinforcement for segmented limbs
- torso-drag walking and foot stepping
- scene serialization and lifecycle cleanup

The active stability, pose and locomotion layers are `stability-runtime.js`, `pose-runtime.js` and `locomotion-runtime.js`. They are translation-owned runtime code; the rebuilt entry point does not load the old root `stability.js`, `pose-tuning.js`, `locomotion.js`, `segmented-stance-compat.js`, `jump-feel.js` or `control-feel.js` scripts.

`translation/generated/app-final.js` remains only as a frozen reference specimen for migration/tests. It is not a runtime dependency.

## Tuning after the rebuild

Exact V1 coordinates and forces are not the product contract. Future changes can tune figure scale, standing posture, balance, pose authority, walking and control feel provided Puppetalk's interaction semantics and deliberately loose physical character remain recognisable.

The current known tuning note is standing posture: the segmented figure can look slightly sloppy at rest. Treat that as normal character tuning, not unfinished migration architecture.
