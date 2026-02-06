# Battle Navigation (PoC) Implementation Plan

## 1) Goal and Success Criteria
Build a playable web PoC of a 1v1 naval tactics game with simultaneous 4-phase planning and deterministic phase-by-phase execution.

### PoC Success Criteria
- Match starts and ends without crashes.
- Two ships with position, facing, HP, and side-based actions.
- 30-second planning timer with editable 4-phase queue.
- Deterministic 4-phase execution playback.
- Port/starboard shooting with per-ship range, cannonball size, and multi-shot rules.
- Grapple action (range 1) that immediately wins on hit.
- Restart flow after game over.

## 2) Technical Approach
- **Stack:** HTML, CSS, vanilla JavaScript.
- **Rendering (MVP):** 2D grid with Canvas or DOM grid (Canvas preferred for smooth playback).
- **Architecture:** Data-first deterministic simulation engine separated from rendering/UI.
- **Optional later:** Three.js presentation layer that consumes the same simulation state.
- **Visual polish (later):** Animation system for ship movement/turns + cannon VFX synced to phase playback.

## 3) Project Structure
```text
/BNav
  index.html
  map-editor.html
  styles.css
  map-editor.css
  /src
    main.js
    editor/
      map-editor.js
    game/
      constants.js
      state.js
      simulation.js
      rules-movement.js
      rules-combat.js
      rules-win.js
      hazards.js (stub for MVP)
      ai.js
    ui/
      hud.js
      planner.js
      timer.js
      playback.js
      renderer2d.js
  /assets
    ships/
    sfx/
  /docs
    IMPLEMENTATION_PLAN.md
    IMPLEMENTED.md
```

Optional / future modules:
- `src/game/types.js` (JSDoc typedefs)
- `src/ui/input.js`
- `src/util/rng.js`, `src/util/math.js`
- `src/three/` (Three.js scene, ship models, effects)
- `src/net/` (lobby + multiplayer networking)
- `src/editor/` (map editor UI + validation helpers)

## 4) Core Data Model
Define small, explicit state objects to keep simulation deterministic.

### Entities
- **Ship**
  - `id`
  - `x`, `y`
  - `facing` (`N | E | S | W`)
  - `hp`
  - `maxHp`
  - `typeId` (e.g., `cutter`, `sloop`)
  - `typeLabel`
  - `cannonRange`
  - `cannonballSize` (`small | medium | large`)
  - `shotsPerAttack` (1 or 2)
  - `grappleRange`
  - `speed` (planned use)
  - `alive`

- **MatchState**
  - `turnNumber`
  - `phaseIndex` (`0..3` during execution)
  - `grid` (`width`, `height`, `mode`, optional `seed`, hazards/rocks)
  - `ships` (2 ships)
  - `status` (`planning | executing | finished`)
  - `winnerId | draw`

- **MapDefinition**
  - `id`, `name`
  - `width`, `height`
  - `hazards`, `rocks`
  - `spawns` (P1/P2 start positions + facings)
  - `metadata` (author, notes, createdAt)

- **Plan**
  - 4 entries: `{ move, action, shots? }`
  - `move`: `none | forward | turn_left | turn_right`
  - `action`: `none | shoot_port | shoot_starboard | grapple_port | grapple_starboard`
  - `shots` (optional): number of cannon shots to fire when action is `shoot_*`

- **PhaseLog**
  - Inputs selected
  - Resulting positions/facings
  - Damage events
  - Win checks

## 5) Rules Specification (Deterministic)
Create a single source-of-truth rules document in code comments/docs.

### 5.0 Map Modes
- **Default map:** curated hazards/rocks layout tuned for readable lanes.
- **Procedural map:** random hazards/rocks with spawn safety buffers and optional seed for repeatability.
- **Custom map:** user-authored layout created in a dedicated map editor (saved as JSON).

### 5.1 Turn Order Per Phase
1. Resolve movement for both ships.
2. Apply hazards.
3. Resolve combat actions.
4. Check win conditions.

Current hazard rules:
- **Wind currents:** if a ship ends a phase on a wind tile, it is pushed 1 tile in the wind direction if clear.
- **Whirlpools:** 2x2 hazard with a `spin` (CW/CCW). Ships on any of its tiles rotate 90 degrees
  in the whirlpool's spin direction and move to the opposite corner of the 2x2.
- **Rocks:** block movement. Large rocks block cannon fire; small rocks do not.

### 5.2 Movement Rules (MVP)
- `forward`: move 1 tile in facing direction if valid.
- `turn_left` / `turn_right`:
  - Attempt a **curved turn**: move forward 1, then sideways 1 (L-shape), and end with updated facing.
  - Turn translation requires the tile directly in front of the ship (current facing) to be clear.
  - If the bow is blocked (edge, obstacle, or ship), stay in place but still rotate.
  - If the diagonal (forward + side) tile is blocked or off-grid, stay in place but still rotate.
  - Collision checks apply to both turn steps (forward and diagonal). Ships do not pass through each other.
- Invalid movement (off-grid/collision):
  - Forward: stay in place, keep facing.
  - Turn: stay in place, apply new facing.

### 5.3 Side Firing Geometry
- Port/starboard derived from ship facing:
  - Facing N: Port=W, Starboard=E
  - Facing E: Port=N, Starboard=S
  - Facing S: Port=E, Starboard=W
  - Facing W: Port=S, Starboard=N
- Shooting traces a straight ray up to the ship's cannon range.
- First enemy ship tile hit takes damage based on cannonball size.

### 5.3.1 Cannonball Damage (Ship Stat)
- `small`: 1 damage
- `medium`: 2 damage
- `large`: 4 damage
- Damage per phase = `damagePerShot * shotsPerAttack` if the shot connects.
- `shotsPerAttack` represents how many cannon shots fire when a ship chooses Shoot in a phase.
  - Multi-shot attacks are resolved as a single damage application (no per-shot accuracy roll in PoC).

### 5.4 Grapple Geometry
- Range 1 in chosen side direction.
- If enemy occupies target tile, attacker wins instantly.

### 5.5 Simultaneous Resolution Policy
To prevent order bias:
- Compute all intents first from pre-combat state.
- Apply combat effects simultaneously.
- If both ships reach lethal damage in same phase, mark draw unless grapple instant-win rule overrides.

### 5.6 Win Conditions
- Opponent HP <= 0.
- Successful grapple.
- Optional draw if both destroyed in same phase.

### 5.7 Ship Defaults (PoC Extensions)
Add base ship types to support asymmetric play:
- **Sloop:** fast turns, low durability, light cannons.
- **Cutter:** balanced baseline, double light cannons.
- **War Brig:** higher HP, double medium cannons.
- **Dhow:** medium cannons, single shot.
- **War Frigate:** highest HP + range, double large cannons.
- **Baghlah:** large cannons, single shot.

Implementation note:
- Keep stats data-driven (e.g., `shipTypes` table with `hp`, `cannonRange`, `speed`).
- Start with conservative differences to avoid destabilizing PoC balance.

Initial tuning (subject to change):
- Sloop: HP 10, range 2, cannonball small, shots 1, grapple 1.
- Cutter: HP 16, range 3, cannonball small, shots 2, grapple 1.
- War Brig: HP 20, range 3, cannonball medium, shots 2, grapple 1.
- Dhow: HP 14, range 3, cannonball medium, shots 1, grapple 1.
- War Frigate: HP 30, range 4, cannonball large, shots 2, grapple 1.
- Baghlah: HP 24, range 4, cannonball large, shots 1, grapple 1.

Current wiring:
- P1 defaults to Cutter; P2 defaults to War Brig.
- Ship selection is handled in the lobby screen.

## 6) UI/UX Plan

### 6.1 Layout
- Left: grid arena.
- Right: planning panel with 4 phase rows.
- Top: timer + turn/phase indicators.
- Bottom: event log (compact).
- Pre-game lobby screen for player count + ship type selection.
- Lobby includes map selection (default vs procedural).

### 6.2 Planning Panel
- 4 rows (Phase 1-4), each with two dropdowns/buttons:
  - Movement selector
  - Action selector
- Live validation and quick reset/clear controls.
- Lock-in button (optional early ready).
- Player count selection in lobby determines AI vs hotseat.

Current UI implementation:
- Phase stack per ship (vertical layout).
- Click the center phase tile to cycle movement (turn left/forward/turn right/none).
- Click left/right action buttons to cycle port/starboard action (1 shot -> 2 shots if available -> grapple -> none).
- Ships with 2 shots show two action buttons per side; cycling to 2 shots highlights both.
- Selecting one side clears the other (only one action per phase).
- Lobby screen with player count (1 vs AI / 2 hotseat), ship type selection, and map mode (default/procedural).
- Ship headers display cannonball size, shots per attack, and range.

### 6.6 Map Editor (Planned)
- Separate `map-editor.html` with a full-screen grid editor.
- Tool palette: wind, whirlpool (CW/CCW), rocks (small/large), erase.
- Spawn placement for P1/P2 with facing.
- Validation: no overlap, spawns within bounds, hazards within bounds.
- Save/load:
  - Local storage presets (named maps).
  - JSON export/import for sharing.
- Main game lobby should list saved custom maps alongside default/procedural.

### 6.3 Execution Playback
- Phase card highlights current phase.
- Animate movement and shots (simple line flash/projectile).
- Delay between phases (e.g., 500-900 ms) with speed toggle.
- Display concise event text per phase.

### 6.5 Visual Upgrade (3D + Effects)
- Replace 2D ship markers with 3D ship models (Three.js).
- Animate turns with curved arcs and banking for readability.
- Cannon VFX: muzzle flash, smoke, projectile trail, impact spark.
- Optional water surface shader or animated normal map for motion.

### 6.4 End Screen
- Winner/draw result.
- Replay phase log button.
- Restart match button.

## 7) AI Plan (Optional Early)
Current implementation:
- Deterministic, greedy per-phase plan generation for P2.
- Prioritizes grapple if adjacent, otherwise shoot if lined up, otherwise turn/move toward target.

Planned upgrades:
- Generate candidate 4-phase plans from a reduced action space.
- Score by:
  - Expected shot opportunities
  - Avoiding enemy side lines/grapple range
  - Maintaining board center control
- Pick highest score within time budget (<20 ms).

## 8) Milestone Roadmap

### Milestone 1 - Engine Skeleton (Day 1)
- Initialize project scaffold and state model.
- Render static 24x24 grid and two ships.
- Implement facing and position visualization.
Status: Completed.

### Milestone 2 - Planning Loop (Day 1-2)
- Build 4-phase planner UI.
- Add 30-second timer and lock-in behavior.
- Transition planning -> executing.
- Add pre-game lobby for player count + ship type selection.
Status: Completed.

### Milestone 3 - Movement + Playback (Day 2)
- Implement per-phase movement resolution.
- Add deterministic playback loop + phase indicators.
- Add phase log entries.
Status: Completed (curved turn path implemented).

### Milestone 4 - Combat + Win Logic (Day 2-3)
- Implement side-ray shooting and grapple checks.
- Apply simultaneous combat resolution.
- Add game over UI + restart.
Status: Completed.

### Milestone 5 - Polish + Optional AI/Hazards (Day 3-4)
- Improve readability animations + event log clarity.
- Add basic AI opponent.
- Add one hazard type (wind) if stable.
Status: AI done, ship types done, hazards done, map modes done.

### Milestone 6 - Map Editor + Custom Maps
- Build separate map editor page with hazard palette + spawn placement.
- Implement save/load (local storage + JSON export/import).
- Add custom map selection in lobby and load into `createInitialState`.

## 9) Testing Strategy

### 9.1 Unit Tests (Core Rules)
- Facing -> side direction mapping.
- Shot ray tracing by orientation/range.
- Grapple adjacency checks.
- Simultaneous lethal damage draw case.
- Determinism: same initial state + plans => identical final state.

### 9.2 Integration Tests
- Full turn from planning through 4-phase execution.
- End-state transitions (win/draw/restart).
- Timer expiry auto-lock behavior.

### 9.3 Manual Playtest Checklist
- Can player understand where shots come from?
- Are phase results predictable from plan?
- Are turns short and tense (30s feels right)?
- Do outplays emerge from 4-step prediction?

## 10) Risk Register and Mitigations
- **Rule ambiguity risk:** Lock exact resolution order in one rules module + tests.
- **UI confusion risk:** Add side indicators and phase-by-phase event text.
- **Scope creep risk:** Keep hazards/Three.js optional until MVP stable.
- **Balance risk:** Tune HP/range only after deterministic loop feels good.

## 11) Post-MVP Expansion Hooks
- Ship loadouts (HP, cannon range, speed).
- Obstacles and collision damage.
- Additional hazards with deterministic patterns.
- Replay export/import via serialized seed + plans.
- Map editor sharing, validation warnings, and map browser.
- Networked PvP (lockstep with shared phase inputs).
- 3D ship models + animated combat effects.
- Multiplayer lobbies (create/join/host) with turn timer sync.

## 12) Suggested Build Order (Practical)
1. Deterministic simulation engine (no visuals).
2. 2D renderer and HUD.
3. Planner + timer + playback.
4. Combat + game-over flow.
5. AI and hazards.
6. Map editor + custom map import/export.
7. Optional Three.js visual layer.
8. Ship type loadouts + tuning pass.
9. Multiplayer lobby + lockstep sync.

---

This plan intentionally prioritizes **clean deterministic rules and readability** over visual complexity, so the core mind-game loop is proven before adding heavier presentation features.
