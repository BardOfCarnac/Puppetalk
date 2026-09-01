# Puppetalk

A tiny multi-phone ensemble puppetry experiment.

One browser is the **stage**. Other devices join the stage as **controllers**. Each controller pulls one physics puppet around the shared scene, selects loose pose targets, can drop the character into ragdoll mode, and can drive a simple three-state mouth from the phone microphone.

## Run locally

```bash
npm install
npm start
```

Open:

- Stage: `http://localhost:3000/`
- Controller: use the room code shown on the stage, or open `http://localhost:3000/?mode=controller&room=ROOMCODE`

For testing with actual phones, the phone and stage need to reach the same server address. Microphone access generally requires HTTPS outside `localhost`, so deploy the Node app behind HTTPS for the real voice-mouth test.

## Current prototype

- One stage / up to six controllers
- WebSocket room routing
- Matter.js physics
- Constrained shoulder → upper arm → elbow → forearm chains
- Constrained hips / knees / lower legs
- Spring-like torso dragging rather than teleporting the puppet
- Pose targets: stand, point, cheer, shrug, crouch
- Ragdoll / recover
- Three mouth states: closed, open, wide
- Local microphone amplitude analysis on each phone; audio itself never leaves the controller
- Manual hold-to-talk fallback

## Structure

- `server.mjs` — Express server and WebSocket room router
- `public/index.html` — app shell
- `public/app.js` — stage physics/rendering and controller logic
- `public/styles.css` — stage/controller styling

## Direction

The next useful pass is to tune the physical puppet rather than add lots of UI: foot behaviour, joint limits, better pose servos, character-to-character collisions, and movement that feels intentionally puppeteered rather than like a generic ragdoll.
