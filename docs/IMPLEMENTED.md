# Implemented Features

Last updated: 2026-02-06

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
- AI opponent mode enabled via lobby (1 player).
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
- Hazards applied after movement with deterministic effects.

## UI/UX
- Canvas grid renderer with ship facing + HP.
- Planner panel with clickable phase selector (cycle movement and port/starboard actions).
- Multi-shot ships show two horizontal action buttons per side; each side cycles independently
  (1 shot -> 2 shots -> grapple -> none).
- Port-side action buttons are ordered by distance from the ship (2, 1, move, 1, 2).
- HUD for turn, phase, timer, and state.
- Phase event log playback.
- Animated phase playback with arc turns, collision bumps, hazard displacement, projectile shots, obstacle explosions, and miss splashes.
- Lobby screen for player count + ship type selection (1 player vs AI / 2 player hotseat).
- Lobby map selection (default or procedural).
- Back to Lobby control in match UI.
- Ship headers show shots per attack, cannonball size, and range.

## Platform/Scaffold
- HTML/CSS/JS module structure wired up.
- Local hotseat support (both plans in the planner).
- Procedural map generator with spawn safety buffer for hazards/rocks.
- Procedural map config centralized in constants and JSDoc comments across core modules.

---

# Planned Next
- Replay log export/import.
- AI heuristic upgrade (candidate plan scoring).
- Optional module cleanup (types, input, util helpers).
- 3D ships + animated combat effects (Three.js layer).
- Multiplayer lobbies (create/join/host) + turn sync.
