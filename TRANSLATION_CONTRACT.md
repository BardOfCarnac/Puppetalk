# Puppetalk translation contract

This branch is a behaviour-preserving rebuild of the frozen Puppetalk prototype on `main`.

## Governing rule

`main` is the reference experience, not a byte-for-byte or coordinate-for-coordinate specification.

The rebuild should still feel recognisably like the same Puppetalk: the same interaction model, personality, major behaviours, controls, and intentional oddities. It may reorganize, consolidate, rename, encapsulate, document, test, optimize, and simplify the implementation.

A difference from `main` is a problem when a player would reasonably notice it as a changed feature, changed interaction, or changed feel. Numerical, geometric, timing, ordering, or implementation differences are acceptable when they do not materially change that experience.

## Must remain recognisably the same

- Product identity and name: Puppetalk.
- Entry flow, character creation flow, table/join flow, and in-table interaction model.
- Visible controls, their meanings, and their interaction semantics.
- Character appearance and existing assets unless deliberately revised later.
- The broad physical character of puppets: pose behaviour, dragging, locomotion, depth behaviour, limp/stand/recover behaviour, and deliberate comic instability.
- Scene and camera behaviour at the level a player perceives and uses them.
- Toy/prop behaviour, including grabbing, throwing, sticking, severing, buoyancy, and special-item effects.
- Microphone/lip behaviour and existing fallbacks.
- Multiplayer/session behaviour and the state that is shared between peers.
- Deliberate quirks that contribute to Puppetalk's character.

## Allowed changes

- Fold patch files into coherent source modules.
- Replace implicit global coupling with explicit interfaces.
- Change internal order of operations when the perceived result is equivalent.
- Replace awkward or accidental maths with clearer equivalents.
- Allow small differences in positions, angles, timings, thresholds, interpolation, and physics where the same action still reads and feels the same.
- Remove dead, superseded, duplicated, or purely accidental behaviour when doing so does not remove something players actually experience as part of the product.
- Deduplicate logic and simplify architecture.
- Add tests, diagnostics, comments, types/contracts, and instrumentation.
- Improve performance and stability without preserving accidental implementation artefacts.
- Rename internal symbols where that improves clarity.

## Still requires deliberate approval

- New branding, visual direction, copy, or product identity.
- New interaction patterns or control layouts.
- Removing or substantially changing an existing feature.
- Changing the intended meaning of a pose, gesture, prop, depth action, recovery action, or multiplayer interaction.
- Replacing Puppetalk's loose comic physical feel with something qualitatively different.
- Treating an implementation convenience as justification for changing the player's experience.

## Translation method

Translate one behaviour cluster at a time.

For each cluster:

1. Identify the V1 files that contribute materially to the behaviour, including later patches and compatibility layers.
2. Work out the effective player-facing behaviour of that stack.
3. Reimplement that behaviour cleanly in the translated module. Prefer clarity over reproducing incidental internals.
4. Check the important interaction outcomes in both builds. Exact numerical parity is useful as a diagnostic, not as the goal.
5. Keep the old implementation available as a reference until the translated behaviour is demonstrably equivalent in use.
6. Commit coherent slices so regressions can still be understood and bisected.

## Testing principle

Parity tests should protect user-visible contracts and important behavioural boundaries, not freeze incidental floating-point values or implementation details.

Exact coordinate/timing assertions are appropriate only where exactness itself is important to the interaction. Otherwise prefer tolerances, outcome tests, state-transition tests, and full-session browser exercises.

## Important implication of the current prototype

The root `index.html` loads many tuning, compatibility, and feature patches sequentially. Their combined effect is useful evidence for what V1 does, but their exact patch ordering is not inherently sacred. The rebuild should resolve that stack into coherent systems that reproduce the intended experience rather than reproduce the patch stack itself.

## Existing `hollerday/` work

The `hollerday/` directory is not the behavioural target for this branch. It may contain implementation ideas worth reusing, but any code taken from it should be judged against the Puppetalk experience rather than treated as the intended design.
