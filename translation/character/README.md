# Character translation boundary

The frozen reference remains `translation/generated/app-final.js`.

The first live extraction is deliberately small and behaviour-neutral:

- pose tables
- legal grab-part names
- rig session/pin state creation
- pose pin reset
- initial anti-tangle target guidance
- root-follow weighting for grabbed parts

These now live in `rig-core.js`. The large `drivePuppet()` force, spring, balance and servo routine remains byte-for-byte inherited from the frozen final program except for calls into those extracted helpers.

`translation/build-runtime.mjs` builds `translation/runtime/app.js` from the frozen reference and refuses to proceed if any expected V1 block cannot be found exactly. This keeps the migration mechanical while the runtime is being decomposed.

Do not tune values in `rig-core.js` during extraction. Behaviour changes belong after parity for the translated character stack is established.