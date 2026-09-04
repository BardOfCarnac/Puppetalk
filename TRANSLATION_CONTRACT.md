# Puppetalk translation contract

This branch is a behaviour-preserving translation of the frozen Puppetalk prototype on `main`.

## Governing rule

`main` is the specification.

The translation may reorganize, consolidate, rename, encapsulate, document, test, and optimize implementation code, but it must not redesign Puppetalk.

If the translated build and `main` differ in user-visible behaviour, the translated build is wrong unless the difference is explicitly approved.

## Must remain the same

- Product identity and name: Puppetalk.
- Entry flow, character creation flow, table/join flow, and in-table interaction model.
- Visible controls, their meanings, and their interaction semantics.
- Character appearance and existing assets.
- Puppet proportions, constraints, physical feel, pose behaviour, dragging, locomotion, depth behaviour, limp/stand/recover behaviour, and deliberate oddities.
- Scene behaviour and camera behaviour.
- Toy/prop behaviour, including grabbing, throwing, sticking, severing, buoyancy, and special-item effects.
- Microphone/lip behaviour and any existing fallbacks.
- Multiplayer/session behaviour and the state that is shared between peers.
- Existing timings, thresholds, tuning constants, defaults, and edge-case behaviour unless a value is provably dead or duplicated.

## Allowed changes

- Fold patch files into coherent source modules.
- Replace implicit global coupling with explicit interfaces while preserving order of operations.
- Remove code only when it is demonstrated to be dead or superseded and doing so does not change behaviour.
- Deduplicate identical logic.
- Add tests, diagnostics, comments, types/contracts, and instrumentation.
- Improve performance only when observable behaviour is unchanged.
- Rename internal symbols where that improves clarity.

## Not allowed without explicit approval

- New branding, new visual design, new copy, or renamed product.
- New interaction patterns or control layouts.
- Reinterpreting an existing feature because another design seems cleaner.
- Replacing physics behaviour with a different approximation merely because it is architecturally nicer.
- Changing a tuneable value because the translated value seems more sensible.
- Removing an odd behaviour simply because it looks accidental.
- Combining systems in a way that changes update order or timing.

## Porting method

Translate one behaviour cluster at a time.

For each cluster:

1. Identify every V1 file that contributes to the behaviour, including later patches and compatibility layers.
2. Record load/order dependencies and effective final values.
3. Move that effective behaviour into the translated module with the smallest possible semantic change.
4. Run behavioural/smoke checks against both builds.
5. Do not delete or bypass the V1 implementation until parity is demonstrated.
6. Commit that cluster separately so regressions can be bisected.

## Important implication of the current prototype

The root `index.html` loads many tuning, compatibility, and feature patches sequentially. Their order is part of V1 behaviour. Translation therefore means resolving the *effective result of that stack* into coherent modules; it does not mean independently redesigning each underlying system.

## Existing `hollerday/` work

The `hollerday/` directory is not the behavioural target for this branch. It may contain implementation ideas worth reusing, but any code taken from it must be checked against frozen Puppetalk behaviour rather than treated as the intended design.
