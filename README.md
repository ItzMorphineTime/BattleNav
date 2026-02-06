# Battle Navigation (PoC)

Fast, turn-based ship tactics inspired by Puzzle Pirates "Sea Battle / Battle Navigation".
Two captains plan 4 micro-actions under a 30-second timer, then watch the turn resolve phase-by-phase.

## Status
Proof-of-concept in progress. Core loop is playable with local hotseat or AI.

## Features (Current)
- 24x24 grid arena with facing + HP per ship
- 4-phase planning per turn (move + action each phase)
- 30-second planning timer + execute-early
- Deterministic phase playback with event log
- Port/starboard shooting with per-ship cannonball size + multi-shot rules
- Lobby screen to select player count, ship types, and map mode
- AI opponent mode for 1-player games (simple deterministic plan generation)
- Curved turn movement (rotate then advance)
- Multi-shot ships can choose 1 or 2 shots per phase
- Hazards: wind currents, 2x2 whirlpools with CW/CCW spin (opposite-corner move + 90-degree rotate),
  and rocks (large blocks shots, small does not)
- Map options: curated default arena or procedurally generated hazards/rocks

## How to Play
1) In the lobby, choose player count, ship types, and map mode, then start the match.
2) Use the planner on the right to queue 4 phases.
3) Each phase includes:
   - Movement: None | Forward | Turn Left | Turn Right
   - Action: None | Shoot Port | Shoot Starboard | Grapple Port | Grapple Starboard
4) Hit "Execute Early" or let the 30-second timer expire.
5) Watch the 4 phases resolve.

## Running Locally
Because the project uses ES modules, it should be served from a local web server.

### Option A: Python (most systems)
```bash
python -m http.server 5173
```
Then open `http://localhost:5173` in your browser.

### Option B: Any static server
Use any static file server pointed at the repo root, then open the local URL.

> Note: Opening `index.html` via `file://` may be blocked by some browsers due to module import rules.

## Ship Types (Current Defaults)
- **Sloop:** HP 10, range 2, small shot, 1 cannon
- **Cutter:** HP 16, range 3, small shot, 2 cannons
- **War Brig:** HP 20, range 3, medium shot, 2 cannons
- **Dhow:** HP 14, range 3, medium shot, 1 cannon
- **War Frigate:** HP 30, range 4, large shot, 2 cannons
- **Baghlah:** HP 24, range 4, large shot, 1 cannon

Current matchup: **P1 Cutter** vs **P2 War Brig**.

## Repository Structure
```
index.html
styles.css
src/
  main.js
  game/
    constants.js
    state.js
    simulation.js
    rules-movement.js
    rules-combat.js
    rules-win.js
    hazards.js
    ai.js
  ui/
    hud.js
    planner.js
    timer.js
    playback.js
    renderer2d.js
docs/
  IMPLEMENTATION_PLAN.md
  IMPLEMENTED.md
```

## Docs
- `docs/IMPLEMENTATION_PLAN.md` - high-level plan and milestones
- `docs/IMPLEMENTED.md` - implemented features ledger

## Roadmap (High Level)
- Replay export/import
- Map seed input + map editor tools
- 3D ships + animated combat effects (Three.js)
- Multiplayer lobbies (create/join/host) + turn sync

---

If you're contributing, keep `docs/IMPLEMENTATION_PLAN.md` and `docs/IMPLEMENTED.md` up to date as features land.
