# BattleNav — improvement backlog

Tracking follow-ups from codebase review (simulation, UI, docs, tooling). Prefer checking items here when behavior or files change, so the doc stays authoritative.

---

## Completed

### Documentation & repo hygiene

- [x] Align `docs/IMPLEMENTATION_PLAN.md` §3 with the actual tree; label map editor / assets as planned-only.
- [x] Fix README local setup: `cd BattleNav` (match typical clone folder name).
- [x] `IMPLEMENTED.md` synced for geometry, procedural seed, Bézier playback, `aria-live`, backlog link.

### Architecture & maintainability

- [x] Shared **`src/game/geometry.js`** — `DIRECTION_VECTORS`, `FACING_TURN_LEFT` / `FACING_TURN_RIGHT`, `sideDirection()`. Consumed by `rules-movement.js`, `rules-combat.js`, `ai.js`, `ui/playback.js`.
- [x] Single-phase plan normalization — **`src/game/plan-normalize.js`** exports `normalizePhasePlan()`. Used by `simulation.js` and **`rules-combat.js`** (legacy `{ action }` plans normalize here; duplicate combat branch removed).
- [x] **`cloneState()`** prefers `structuredClone` with JSON fallback (`state.js`).
- [x] Cannon fallbacks — **`FALLBACK_CANNON_RANGE`** / **`FALLBACK_SHOT_DAMAGE_PER_SHOT`** in `constants.js`; `SHOOT_*` retained as `@deprecated` aliases. `rules-combat.js` / `ai.js` use the new names.

### UX

- [x] **Procedural map seed** — optional lobby field (shown when Map = Procedural); passed as `createInitialState({ mapSeed })`. Empty ⇒ existing random behaviour.
- [x] Phase log **`aria-live="polite"`** on `#event-log` for screen reader announcements.

### Presentation

- [x] **Turn animation** — full L-move uses quadratic Bézier `from → step1(knee) → to` in `playback.js` (inside corner tangent match; replaces misleading minor circular arc).

### Hazards — whirlpool (sim + playback alignment)

Simulation (`hazards.js`): 2×2 whirlpool sends a ship to the **opposite corner** and rotates facing **90°** — **CCW spin** uses `FACING_TURN_LEFT`, **CW spin** uses `FACING_TURN_RIGHT` (same as `geometry.js` / movement).

Playback fixes (implemented):

- [x] **Pivot-only whirl** (blocked slide): **same** facing/angle rules as a movement pivot (`lerpAngle`).
- [x] **Opposite-corner whirl**: **same Bézier + angle path** as a full `turn_left` / `turn_right` L (`quadraticBezier2d` from **integer** `(from) → kneeTile → (to)` where **`kneeTile` is the forward leg tile** `(from.x, from.y) + DIRECTION_VECTORS[from.facing]` when that completes the hull L to `(to)`, else spin-pattern fallback; `lerpAngle` + facing flip at `t=0.5` as movement—not spin-only perimeter knee when facing matters).
- [x] **Facing-only whirl** (spun but blocked / no displacement): tween still runs when **heading** changes (`hazardInterpolationNeeded` replaces distance-only detection).

Supporting **`classifyWhirlpoolForPlayback`** + **`applyWhirlpoolFacingChange`** live in **`hazards.js`**, reused by **`playback.js`**.

---

## Outstanding

### Testing (see `IMPLEMENTATION_PLAN.md` §9)

- [ ] Add a test runner + unit tests: facing rays, LOS, grapple, simultaneous lethal draw, determinism snapshots, whirl knee tile + Bézier parity with movement L-turn.
- [ ] Integration-ish tests: timer auto-lock (`main` / thin harness), full `resolveTurn` golden cases.

### Architecture

- [ ] Split **`main.js`** into small modules when the match loop grows (e.g. `lobby.js`, `match.js`).

### AI

- [x] **Scored multi-candidate AI** — `generateAiPlan` evaluates a greedy seed plus move/combat mutations with **`resolveTurn`** against the human’s current P1 plan (`ai.js`).
- [ ] **`applyMovePreview`** still used only to **seed** the greedy baseline; optional follow-up: drop preview entirely and seed from rule queries if desired.

### UX & accessibility

- [x] Replay **export/import** — JSON bundle (`replay.js`): lobby snapshot, procedural `grid.seed`, per-turn effective `plansByShipId`; **interactive playback** after import (`Next turn`, `Play all`, `Jump to end`) matching live **Execute Early** animations (`playPhaseResults`); **`Jump to end`** = `simulateReplayTurns`. Buttons in match UI + lobby import.
- [ ] Keyboard planner controls, visible focus rings, tighter focus management in the planner.

### Presentation (optional tuning)

- [ ] Turn moves still use shortest-path `lerpAngle` between facings — directed turn-left vs turn-right arcs if sprites should always match semantic manoeuvre buttons.

---

## Turn animation note (historical)

Simulated turns are **L-shaped**: forward into `step1`, then sideways in the **new** facing to `to`. An earlier animator used **`arcAroundCorner`** (circle centered at the knee), which followed the **minor** arc — geometrically outside the corner while endpoints stayed correct — so motion looked mirrored to the discrete path.

**Resolved:** Bézier interpolation as above.

---

_Last updated: 2026-05-16_
