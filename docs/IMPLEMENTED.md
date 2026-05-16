# Implemented Features

Last updated: 2026-05-16

## Core Gameplay
- 24x24 grid arena with two ships, facing, and HP.
- Curated default map layout with tuned hazards/rocks.
- 4-phase planning per turn (move + port/starboard actions per phase).
- 30-second planning timer with execute-early button.
- Deterministic phase-by-phase execution playback.
- Port/starboard shooting with per-ship range, cannonball damage, and selectable shot count.
- Port and starboard actions can be selected simultaneously each phase.
- Grapple action (range 1) with instant win.
- Win/draw detection and restart flow.
- Ship type defaults defined in data (Sloop, Cutter, War Brig, Dhow, War Frigate, Baghlah).
- Default matchup: P1 Cutter vs P2 War Brig.
- AI opponent mode enabled via lobby (1 player): **candidate plan scoring** over `resolveTurn` using the captain’s queued P1 plan (move mutations + selective combat-off around a greedy seed).
- Hazards: wind currents, 2x2 whirlpools with CW/CCW spin (opposite-corner move + 90-degree rotate),
  and rocks (large blocks shots, small does not).

## Simulation & Rules
- Deterministic engine with movement, combat, and win checks.
- Simultaneous combat resolution with draw case.
- Shots stop at first impact (ship or large rock) with impact-aware traces for VFX.
- Movement collision handling (edge bump, clash, swap block).
- Turn-left/right uses L-shaped arc: forward 1 then side 1, ending with new facing.
- Turn collisions while turning cancel translation but keep rotation.
- Turning requires the forward tile (current facing) to be clear; otherwise rotate in place.
- Turn collisions are checked at both steps; ships cannot pass through each other.
- Ship stats applied per type (HP, cannon range, grapple range, cannonball size, shots per attack).
- Hazards applied after movement with deterministic effects;
  **whirlpool** CW/CCW uses the same **`turn_right`** / **`turn_left`** facing steps as `geometry.js`.

## UI/UX
- Canvas grid renderer with ship facing + HP.
- Planner panel with clickable phase selector (cycle movement and port/starboard actions).
- Multi-shot ships show two horizontal action buttons per side; each side cycles independently
  (1 shot -> 2 shots -> grapple -> none).
- Port-side action buttons are ordered by distance from the ship (2, 1, move, 1, 2).
- HUD for turn, phase, timer, and state.
- Phase event log playback; log list exposes `aria-live` for assistive tech.
- Animated phase playback with Bézier movement turns, **whirlpool L-tweens**
  (same integer-grid quadratic as `turn_left` / `turn_right` + `lerpAngle` sprite spin as movement), wind slides,
  collision bumps, hazard displacement, projectile shots, obstacle explosions, and miss splashes.
- Lobby screen for player count + ship type selection (1 player vs AI / 2 player hotseat).
- Lobby map selection (default or procedural) with optional **procedural seed** for repeatable layouts.
- **Replay:** export/import JSON — starting **match snapshot** plus **interactive playback** (**Next turn** / **Play all** / **Jump to end**) using the same phase animator as live play; `Jump to end` uses `simulateReplayTurns`; continued play after the recording is supported once steps finish.
- Back to Lobby control in match UI.
- Ship headers show shots per attack, cannonball size, and range.

## Platform/Scaffold
- HTML/CSS/JS module structure wired up.
- Local hotseat support (both plans in the planner).
- Procedural map generator with spawn safety buffer for hazards/rocks.
- Procedural map config centralized in constants and JSDoc comments across core modules.
- Shared **`geometry.js`** (grid vectors, facing after turn left/right, broadside directions),
  **`plan-normalize.js`** (single-phase plan shape + legacy `action` compatibility), and whirlpool playback helpers
  in **`hazards.js`** (`classifyWhirlpoolForPlayback`, **`getWhirlpoolKneeTile`**
  matching the manoeuvre **forward-leg** Bézier knee when valid, spin fallback otherwise).
- `cloneState()` uses `structuredClone` when available with JSON fallback.
- **`replay.js`** (`initialStateFromReplayPayload`, `buildReplayExport`, `parseReplayJson`, `matchStateFromReplayPayload`, `replayLobbySettingsFromPayload`, `simulateReplayTurns`, `sortedReplayTurns`).
- Backlog tracked in **`docs/IMPROVEMENTS.md`**.

---

# Planned Next
- Optional rewind / scrub timeline for imported replays beyond step-forward playback.
- Further module cleanup (shared types, dedicated input layer, tests).
- 3D ships + animated combat effects (Three.js layer).
- Multiplayer lobbies (create/join/host) + turn sync.
