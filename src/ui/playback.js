import { MOVE, ROCK_SIZE } from "../game/constants.js";

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const PROJECTILE_PHASE = 0.65;
const TURN_SPLIT = 0.6;
const BUMP_DISTANCE = 0.22;
const SHOT_COLORS = {
  small: "rgba(255, 175, 120, 0.95)",
  medium: "rgba(255, 145, 95, 0.98)",
  large: "rgba(255, 120, 80, 1)",
};

const GRAPPLE_COLOR = "rgba(120, 240, 245, 0.9)";

const DIRECTION_VECTORS = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

const TURN_LEFT = { N: "W", W: "S", S: "E", E: "N" };
const TURN_RIGHT = { N: "E", E: "S", S: "W", W: "N" };

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  const delta = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}

function facingToAngle(facing) {
  switch (facing) {
    case "N":
      return -Math.PI / 2;
    case "E":
      return 0;
    case "S":
      return Math.PI / 2;
    case "W":
      return Math.PI;
    default:
      return 0;
  }
}

function cloneShips(ships) {
  return ships.map((ship) => ({ ...ship }));
}

function shipById(ships, id) {
  return ships.find((ship) => ship.id === id);
}

function arcAroundCorner(start, corner, end, t) {
  const startVec = { x: start.x - corner.x, y: start.y - corner.y };
  const endVec = { x: end.x - corner.x, y: end.y - corner.y };
  const radius = Math.max(0.0001, Math.hypot(startVec.x, startVec.y));
  const startAngle = Math.atan2(startVec.y, startVec.x);
  const endAngle = Math.atan2(endVec.y, endVec.x);
  const angle = lerpAngle(startAngle, endAngle, t);
  return {
    x: corner.x + Math.cos(angle) * radius,
    y: corner.y + Math.sin(angle) * radius,
  };
}

function bumpFactor(t) {
  if (t <= 0) {
    return 0;
  }
  if (t >= 1) {
    return 0;
  }
  return t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
}

function buildMovementProfiles(fromShips, toShips, phasePlansByShipId) {
  return fromShips.map((from) => {
    const to = shipById(toShips, from.id) || from;
    const move = phasePlansByShipId?.[from.id]?.move || MOVE.NONE;
    const forwardVec = DIRECTION_VECTORS[from.facing];
    const step1 = forwardVec ? { x: from.x + forwardVec.x, y: from.y + forwardVec.y } : null;
    let step2 = null;
    let sideVec = null;

    if (move === MOVE.TURN_LEFT || move === MOVE.TURN_RIGHT) {
      const nextFacing = move === MOVE.TURN_LEFT ? TURN_LEFT[from.facing] : TURN_RIGHT[from.facing];
      sideVec = DIRECTION_VECTORS[nextFacing];
      if (step1 && sideVec) {
        step2 = { x: step1.x + sideVec.x, y: step1.y + sideVec.y };
      }
    }

    const endedAtStart = to.x === from.x && to.y === from.y;
    const endedAtStep1 = step1 && to.x === step1.x && to.y === step1.y;

    return {
      id: from.id,
      move,
      from,
      to,
      step1,
      step2,
      forwardVec,
      sideVec,
      endedAtStart,
      endedAtStep1,
    };
  });
}

function positionForProfile(profile, t) {
  const { from, to, move, forwardVec, sideVec, step1 } = profile;
  if (move === MOVE.NONE) {
    return { x: from.x, y: from.y };
  }

  if (move === MOVE.FORWARD) {
    if (profile.endedAtStart) {
      const bump = bumpFactor(t) * BUMP_DISTANCE;
      return {
        x: from.x + (forwardVec?.x || 0) * bump,
        y: from.y + (forwardVec?.y || 0) * bump,
      };
    }
    return {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
    };
  }

  if (move === MOVE.TURN_LEFT || move === MOVE.TURN_RIGHT) {
    if (profile.endedAtStart) {
      const bump = bumpFactor(t) * BUMP_DISTANCE;
      return {
        x: from.x + (forwardVec?.x || 0) * bump,
        y: from.y + (forwardVec?.y || 0) * bump,
      };
    }
    if (profile.endedAtStep1 && step1) {
      if (t <= TURN_SPLIT) {
        const local = t / TURN_SPLIT;
        return {
          x: lerp(from.x, step1.x, local),
          y: lerp(from.y, step1.y, local),
        };
      }
      const bump = bumpFactor((t - TURN_SPLIT) / (1 - TURN_SPLIT)) * BUMP_DISTANCE;
      return {
        x: step1.x + (sideVec?.x || 0) * bump,
        y: step1.y + (sideVec?.y || 0) * bump,
      };
    }
    if (profile.step1 && profile.step2) {
      return arcAroundCorner({ x: from.x, y: from.y }, profile.step1, { x: to.x, y: to.y }, t);
    }
  }

  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
}

function interpolateMovementShips(profiles, t) {
  return profiles.map((profile) => {
    const { from, to, move } = profile;
    const position = positionForProfile(profile, t);
    const startAngle = facingToAngle(from.facing);
    const endAngle = facingToAngle(to.facing);
    const rotate = move === MOVE.TURN_LEFT || move === MOVE.TURN_RIGHT;
    const visualAngle = rotate ? lerpAngle(startAngle, endAngle, t) : startAngle;

    return {
      ...from,
      x: position.x,
      y: position.y,
      facing: t < 0.5 ? from.facing : to.facing,
      visualAngle,
    };
  });
}

function interpolateLinearShips(fromShips, toShips, t) {
  return toShips.map((to) => {
    const from = shipById(fromShips, to.id) || to;
    const startAngle = facingToAngle(from.facing);
    const endAngle = facingToAngle(to.facing);
    const visualAngle = lerpAngle(startAngle, endAngle, t);
    return {
      ...from,
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      facing: t < 0.5 ? from.facing : to.facing,
      visualAngle,
    };
  });
}

function animate(durationMs, drawFrame) {
  if (durationMs <= 0) {
    drawFrame(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      drawFrame(t);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

function pointOnLine(line, progress) {
  if (!line || line.length === 0) {
    return null;
  }
  if (line.length === 1) {
    return { x: line[0].x, y: line[0].y };
  }
  const scaled = progress * (line.length - 1);
  const index = Math.floor(scaled);
  const t = scaled - index;
  const a = line[index];
  const b = line[Math.min(index + 1, line.length - 1)];
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

function findLargeRockAt(x, y, grid) {
  if (!grid || !Array.isArray(grid.rocks)) {
    return null;
  }
  return grid.rocks.find((rock) => rock.x === x && rock.y === y && rock.size === ROCK_SIZE.LARGE);
}

function resolveShotOutcome(line, shipsAfter, grid) {
  const hitShip = line.find((tile) => shipsAfter.some((ship) => ship.x === tile.x && ship.y === tile.y));
  if (hitShip) {
    return "ship";
  }
  const last = line[line.length - 1];
  if (last && findLargeRockAt(last.x, last.y, grid)) {
    return "obstacle";
  }
  return "miss";
}

function resolveGrappleOutcome(line, shipsAfter) {
  const connected = line.some((tile) => shipsAfter.some((ship) => ship.x === tile.x && ship.y === tile.y));
  return connected ? "ship" : "miss";
}

function buildShotOffsets(trace) {
  const shots = trace.shots ?? 1;
  if (shots <= 1 || trace.line.length < 2) {
    return [{ x: 0, y: 0 }];
  }
  const first = trace.line[0];
  const last = trace.line[trace.line.length - 1];
  const dirX = Math.sign(last.x - first.x);
  const dirY = Math.sign(last.y - first.y);
  const perpX = dirY;
  const perpY = -dirX;
  const spacing = 0.18;
  const centerIndex = (shots - 1) / 2;
  return Array.from({ length: shots }, (_, index) => {
    const offset = (index - centerIndex) * spacing;
    return {
      x: perpX * offset,
      y: perpY * offset,
    };
  });
}

function buildTraceAnimations(phaseResult, shipsAfter, grid) {
  const animations = [];
  for (const trace of phaseResult.traces || []) {
    if (!trace.line || trace.line.length === 0) {
      continue;
    }
    const impact = trace.impact;
    const impactIndex =
      impact && Number.isFinite(impact.index)
        ? Math.max(0, Math.min(impact.index, trace.line.length - 1))
        : null;
    const impactPoint =
      impact && typeof impact.x === "number" && typeof impact.y === "number"
        ? { x: impact.x, y: impact.y }
        : trace.line[trace.line.length - 1];
    const line = impactIndex !== null ? trace.line.slice(0, impactIndex + 1) : trace.line;
    if (trace.kind === "shot") {
      animations.push({
        kind: "shot",
        line,
        offsets: buildShotOffsets(trace),
        outcome: impact?.type || resolveShotOutcome(trace.line, shipsAfter, grid),
        impact: impactPoint,
        cannonballSize: trace.cannonballSize,
      });
    } else if (trace.kind === "grapple") {
      animations.push({
        kind: "grapple",
        line,
        offsets: [{ x: 0, y: 0 }],
        outcome: impact?.type || resolveGrappleOutcome(trace.line, shipsAfter),
        impact: impactPoint,
      });
    }
  }
  return animations;
}

function buildCombatOverlay(animations, progress) {
  const projectileProgress = Math.min(1, progress / PROJECTILE_PHASE);
  const impactProgress =
    progress >= PROJECTILE_PHASE ? (progress - PROJECTILE_PHASE) / (1 - PROJECTILE_PHASE) : 0;
  const projectiles = [];
  const effects = [];

  for (const anim of animations) {
    const pos = pointOnLine(anim.line, projectileProgress);
    if (pos) {
      const color =
        anim.kind === "grapple"
          ? GRAPPLE_COLOR
          : SHOT_COLORS[anim.cannonballSize] || SHOT_COLORS.small;
      const size = anim.kind === "grapple" ? 0.08 : 0.06;
      for (const offset of anim.offsets) {
        projectiles.push({
          x: pos.x + offset.x,
          y: pos.y + offset.y,
          color,
          alpha: 1,
          size,
        });
      }
    }

    if (impactProgress > 0 && anim.outcome) {
      const impactPoint = anim.impact || anim.line[anim.line.length - 1];
      if (!impactPoint) {
        continue;
      }
      if (anim.kind === "shot" && anim.outcome === "obstacle") {
        effects.push({
          type: "explosion",
          x: impactPoint.x,
          y: impactPoint.y,
          radius: 0.2 + impactProgress * 0.4,
          alpha: 1 - impactProgress,
        });
      } else if (anim.outcome === "miss") {
        effects.push({
          type: "splash",
          x: impactPoint.x,
          y: impactPoint.y,
          radius: 0.2 + impactProgress * 0.35,
          alpha: 0.9 - impactProgress * 0.6,
        });
      }
    }
  }

  return {
    projectiles,
    effects,
  };
}

function shipsMoved(fromShips, toShips) {
  return toShips.some((ship) => {
    const from = shipById(fromShips, ship.id) || ship;
    return from.x !== ship.x || from.y !== ship.y;
  });
}

async function animatePhase(renderer, baseState, fromShips, phaseResult, options) {
  const shipsAfterMovement = phaseResult.shipsAfterMovement || phaseResult.shipsAfterPhase;
  const shipsAfterHazards = phaseResult.shipsAfterHazards || phaseResult.shipsAfterPhase;
  const movementProfiles = buildMovementProfiles(
    fromShips,
    shipsAfterMovement,
    phaseResult.phasePlansByShipId,
  );

  renderer.draw({ ...baseState, ships: interpolateMovementShips(movementProfiles, 0) });

  await animate(options.moveDurationMs, (t) => {
    const ships = interpolateMovementShips(movementProfiles, t);
    renderer.draw({ ...baseState, ships });
  });

  if (shipsMoved(shipsAfterMovement, shipsAfterHazards)) {
    await animate(options.hazardDurationMs, (t) => {
      const ships = interpolateLinearShips(shipsAfterMovement, shipsAfterHazards, t);
      renderer.draw({ ...baseState, ships });
    });
  }

  const animations = buildTraceAnimations(phaseResult, shipsAfterHazards, baseState.grid);
  await animate(options.combatDurationMs, (t) => {
    const overlay = buildCombatOverlay(animations, t);
    renderer.draw({ ...baseState, ships: shipsAfterHazards }, overlay);
  });

  if (options.pauseMs > 0) {
    await sleep(options.pauseMs);
  }
}

/**
 * Play each phase result with smooth animation.
 * @param {Array<Object>} phaseResults
 * @param {{
 *  renderer: import("./renderer2d.js").Renderer2D,
 *  baseState: import("../game/state.js").MatchState,
 *  onPhase?: (phase:Object)=>Promise<void>|void,
 *  onDone?: ()=>void,
 *  moveDurationMs?: number,
 *  hazardDurationMs?: number,
 *  combatDurationMs?: number,
 *  pauseMs?: number,
 * }} options
 */
export async function playPhaseResults(phaseResults, options) {
  const moveDurationMs = options.moveDurationMs ?? 500;
  const hazardDurationMs = options.hazardDurationMs ?? 220;
  const combatDurationMs = options.combatDurationMs ?? 350;
  const pauseMs = options.pauseMs ?? 150;
  const renderer = options.renderer;
  const baseState = options.baseState;
  let previousShips = baseState ? cloneShips(baseState.ships) : [];

  for (const phaseResult of phaseResults) {
    if (options.onPhase) {
      await options.onPhase(phaseResult);
    }
    if (renderer && baseState) {
      await animatePhase(renderer, baseState, previousShips, phaseResult, {
        moveDurationMs,
        hazardDurationMs,
        combatDurationMs,
        pauseMs,
      });
    } else {
      await sleep(moveDurationMs + hazardDurationMs + combatDurationMs + pauseMs);
    }
    previousShips = cloneShips(phaseResult.shipsAfterPhase);
  }

  if (options.onDone) {
    options.onDone();
  }
}
