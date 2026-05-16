# BattleNav — improvement backlog

Tracking follow-ups from codebase review (simulation, UI, docs, tooling). Check items off as they land; link PRs or commits in parentheses when useful.

---

## Documentation & repo hygiene

- [ ] Align `docs/IMPLEMENTATION_PLAN.md` with the actual tree (remove or mark **planned** entries for `map-editor.html`, `editor/`, asset folders that are not present yet).
- [ ] Fix README clone instructions if the repo folder name is `BattleNav` but the doc still says `cd BNav`.

---

## Testing (see also `IMPLEMENTATION_PLAN.md` §9)

- [ ] Add an automated test runner (e.g. Vitest/Node) for pure rule functions.
- [ ] Unit tests: facing → port/starboard ray, LOS with large rocks, grapple range-1, simultaneous lethal → draw, grapple overriding draw.
- [ ] Golden / snapshot tests: fixed `createInitialState({ mapSeed })` + fixed plans → identical `finalState`.

---

## Architecture & maintainability

- [ ] Extract shared **grid geometry** (`DIRECTION_VECTORS`, port/starboard from facing, turn maps) into one module (e.g. `src/game/geometry.js`) consumed by `rules-movement.js`, `rules-combat.js`, `ai.js`, and `ui/playback.js`.
- [ ] Consolidate **plan normalization** (`normalizePhasePlan` in `simulation.js` vs legacy `action` branches in `rules-combat.js`) so there is a single canonical plan shape end-to-end.
- [ ] Replace or document `cloneState` (`JSON.parse(JSON.stringify)`) — consider `structuredClone` or typed clones as state grows.
- [ ] Split `main.js` when adding features (lobby vs match loop vs logging) to keep the entry file small and testable.

---

## AI

- [ ] Align AI **movement preview** with real rules (`rules-movement.js`): full L-turn, rocks, swap/head-on, not only `applyMovePreview` in `ai.js`.
- [ ] Consider multi-phase or scored candidate plans per `IMPLEMENTATION_PLAN.md` §7 (enemy is currently static across the four phases).

---

## Constants & types

- [ ] Deprecate or namespace legacy `SHOOT_RANGE` / `SHOOT_DAMAGE` / `MAX_HP` in `constants.js` in favor of per-ship stats + `CANNONBALL_DAMAGE` everywhere new code is written.

---

## UX & features

- [ ] Expose **procedural map seed** in the lobby (`createInitialState` already accepts `mapSeed` in `state.js`).
- [ ] Accessibility: keyboard planner controls, focus management, live region for phase log.
- [ ] Replay export/import (roadmap item).

---

## Turn animation — curve “wrong way” (analysis)

### Symptom

On **turn left** / **turn right**, the ship ends at the **correct** tile and facing, but the **curved path** looks like it sweeps the wrong way around the knee of the L.

### Intended simulation path (rules)

From `rules-movement.js` / `buildMovementProfiles` in `playback.js`, a successful turn is an **L**:

1. **Step 1:** one tile **forward** from current facing (bow into the cell ahead).
2. **Step 2:** one tile in the direction of the **new** facing from step 1 (completes the turn).

The knee of the L is **step1** (the tile in front of the ship before the sideways leg).

### What the animator does

In `src/ui/playback.js`, when both `step1` and `step2` exist and the ship reaches `to` (full L), `positionForProfile` calls:

```text
arcAroundCorner(from, step1, to, t)
```

`arcAroundCorner` places both `from` and `to` on a **circle centered at `step1`**, with radius `|from - step1|` (one tile). It interpolates the angle with **`lerpAngle(startAngle, endAngle, t)`**, which always takes the **shortest** signed rotation between the two radii.

For two points on a circle that are **90° apart** (orthogonal L), the shortest arc is **90°** — the **minor** arc.

### Why that looks “wrong”

The **minor** arc around the knee lies on the **convex / outside** side of the orthogonal L (it bulges into the quadrant **opposite** the tight inside corner of the path). The **simulated** route is the **two straight segments** along the **inside** of the turn. So the eye expects motion that hugs the **inside** of the L (or at least stays in the same wedge as the grid path), but the math draws the **outside** quarter-circle. Endpoints still match `from` and `to`, so the **final** position is correct.

Separately, **sprite rotation** uses `lerpAngle(startFacing, endFacing, t)` on **facing**, which also picks the **shortest** spin; that can disagree with the semantic label “turn left” vs “turn right” when the shorter rotation is the other way (less common for 90° turns but worth checking if art ever looks inverted).

### Fix (implemented)

- **Quadratic Bézier** in `src/ui/playback.js`: `from` → control `step1` → `to`. Endpoints match the sim; tangents match the L legs so the curve rounds the **inside** of the corner instead of the previous minor circular arc.

### Other options (not used)

- **Long arc:** Force the **major** (~270°) circular arc when it matches the turn “inside” better.
- **Correct fillet center:** Rounded corner with arc center offset **inside** the bend.

Presentation-only; `resolveMovementPhase` is unchanged.

---

_Last updated: 2026-05-16_
