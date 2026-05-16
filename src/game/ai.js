import {
  ACTION,
  ACTION_KIND,
  DEFAULT_SHOTS_PER_ATTACK,
  FALLBACK_CANNON_RANGE,
  GRAPPLE_RANGE,
  MOVE,
  PHASE_COUNT,
  SIDE,
} from "./constants.js";
import { DIRECTION_VECTORS, FACING_TURN_LEFT, FACING_TURN_RIGHT, sideDirection } from "./geometry.js";
import { resolveTurn } from "./simulation.js";
import { cloneState, createEmptyPlan } from "./state.js";

const ALL_MOVES = [MOVE.NONE, MOVE.FORWARD, MOVE.TURN_LEFT, MOVE.TURN_RIGHT];

function inLineRange(attacker, target, direction, range) {
  const vec = DIRECTION_VECTORS[direction];
  if (!vec) {
    return false;
  }
  for (let step = 1; step <= range; step += 1) {
    const x = attacker.x + vec.x * step;
    const y = attacker.y + vec.y * step;
    if (x === target.x && y === target.y) {
      return true;
    }
  }
  return false;
}

function desiredFacingToward(attacker, target) {
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "E" : "W";
  }
  return dy >= 0 ? "S" : "N";
}

function chooseTurn(current, desired) {
  if (current === desired) {
    return MOVE.NONE;
  }
  const left = FACING_TURN_LEFT[current];
  if (left === desired) {
    return MOVE.TURN_LEFT;
  }
  return MOVE.TURN_RIGHT;
}

/** Simple forward-only collision check for greedy AI previews. */
function canMoveForward(ship, grid, enemy) {
  const vec = DIRECTION_VECTORS[ship.facing];
  if (!vec) {
    return false;
  }
  const nx = ship.x + vec.x;
  const ny = ship.y + vec.y;
  if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) {
    return false;
  }
  if (enemy && nx === enemy.x && ny === enemy.y) {
    return false;
  }
  return true;
}

/** Lightweight move preview for greedy plan construction (full rules in {@link resolveTurn}). */
function applyMovePreview(ship, move, grid, enemy) {
  const next = { ...ship };
  if (move === MOVE.FORWARD && canMoveForward(ship, grid, enemy)) {
    const vec = DIRECTION_VECTORS[ship.facing];
    next.x += vec.x;
    next.y += vec.y;
  } else if (move === MOVE.TURN_LEFT) {
    next.facing = FACING_TURN_LEFT[ship.facing];
  } else if (move === MOVE.TURN_RIGHT) {
    next.facing = FACING_TURN_RIGHT[ship.facing];
  }
  return next;
}

/** Greedy action choice (grapple > shoot > none) based on current alignment. */
function chooseAction(attacker, target) {
  const cannonRange = attacker.cannonRange ?? FALLBACK_CANNON_RANGE;
  const grappleRange = attacker.grappleRange ?? GRAPPLE_RANGE;
  const portDir = sideDirection(attacker.facing, SIDE.PORT);
  const starDir = sideDirection(attacker.facing, SIDE.STARBOARD);

  if (inLineRange(attacker, target, portDir, grappleRange)) {
    return ACTION.GRAPPLE_PORT;
  }
  if (inLineRange(attacker, target, starDir, grappleRange)) {
    return ACTION.GRAPPLE_STARBOARD;
  }
  if (inLineRange(attacker, target, portDir, cannonRange)) {
    return ACTION.SHOOT_PORT;
  }
  if (inLineRange(attacker, target, starDir, cannonRange)) {
    return ACTION.SHOOT_STARBOARD;
  }
  return ACTION.NONE;
}

/** Turn toward the opponent, otherwise move forward when clear. */
function chooseMove(attacker, target, grid) {
  const desired = desiredFacingToward(attacker, target);
  if (attacker.facing === desired) {
    return canMoveForward(attacker, grid, target) ? MOVE.FORWARD : MOVE.NONE;
  }
  return chooseTurn(attacker.facing, desired);
}

/**
 * @param {import("./state.js").PhasePlan[]} plan
 */
function clonePlan(plan) {
  const out = [];
  for (let i = 0; i < PHASE_COUNT; i += 1) {
    const phase = plan[i] || {};
    const p = phase.port || { kind: ACTION_KIND.NONE };
    const s = phase.starboard || { kind: ACTION_KIND.NONE };
    out.push({
      move: phase.move || MOVE.NONE,
      port: {
        kind: p.kind || ACTION_KIND.NONE,
        ...(p.kind === ACTION_KIND.FIRE && p.shots ? { shots: p.shots } : {}),
      },
      starboard: {
        kind: s.kind || ACTION_KIND.NONE,
        ...(s.kind === ACTION_KIND.FIRE && s.shots ? { shots: s.shots } : {}),
      },
    });
  }
  return out;
}

/**
 * Greedy baseline: same per-phase strategy as legacy AI (preview-based motion).
 */
function buildGreedyPlan(matchState, aiShipId) {
  const plan = [];
  const aiShip = matchState.ships.find((ship) => ship.id === aiShipId);
  const enemy = matchState.ships.find((ship) => ship.id !== aiShipId);
  if (!aiShip || !enemy) {
    return createEmptyPlan();
  }

  let simulatedAi = { ...aiShip };
  const staticEnemy = { ...enemy };

  const toSidePlan = (action, shipRef) => {
    const empty = { kind: ACTION_KIND.NONE };
    if (action === ACTION.SHOOT_PORT) {
      return {
        port: {
          kind: ACTION_KIND.FIRE,
          shots: shipRef.shotsPerAttack ?? DEFAULT_SHOTS_PER_ATTACK,
        },
        starboard: empty,
      };
    }
    if (action === ACTION.SHOOT_STARBOARD) {
      return {
        port: empty,
        starboard: {
          kind: ACTION_KIND.FIRE,
          shots: shipRef.shotsPerAttack ?? DEFAULT_SHOTS_PER_ATTACK,
        },
      };
    }
    if (action === ACTION.GRAPPLE_PORT) {
      return { port: { kind: ACTION_KIND.GRAPPLE }, starboard: empty };
    }
    if (action === ACTION.GRAPPLE_STARBOARD) {
      return { port: empty, starboard: { kind: ACTION_KIND.GRAPPLE } };
    }
    return { port: empty, starboard: empty };
  };

  for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
    const action = chooseAction(simulatedAi, staticEnemy);
    const move = chooseMove(simulatedAi, staticEnemy, matchState.grid);
    const sidePlan = toSidePlan(action, simulatedAi);
    plan.push({ move, ...sidePlan });
    simulatedAi = applyMovePreview(simulatedAi, move, matchState.grid, staticEnemy);
  }

  return plan;
}

/**
 * Incoming broadside / grapple threat from `enemy` toward `ship` after a phase (static LOS).
 */
function threatPenalty(enemy, ship) {
  if (!enemy.alive || !ship.alive) {
    return 0;
  }
  const cannonRange = enemy.cannonRange ?? FALLBACK_CANNON_RANGE;
  const grappleRange = enemy.grappleRange ?? GRAPPLE_RANGE;
  const portDir = sideDirection(enemy.facing, SIDE.PORT);
  const starDir = sideDirection(enemy.facing, SIDE.STARBOARD);
  let penalty = 0;
  if (inLineRange(enemy, ship, portDir, grappleRange) || inLineRange(enemy, ship, starDir, grappleRange)) {
    penalty += 35;
  } else if (inLineRange(enemy, ship, portDir, cannonRange) || inLineRange(enemy, ship, starDir, cannonRange)) {
    penalty += 22;
  }
  return penalty;
}

function scoreOutcome(startState, endState, aiShipId, enemyId) {
  const aiStart = startState.ships.find((s) => s.id === aiShipId);
  const enStart = startState.ships.find((s) => s.id === enemyId);
  const aiEnd = endState.ships.find((s) => s.id === aiShipId);
  const enEnd = endState.ships.find((s) => s.id === enemyId);
  if (!aiStart || !enStart || !aiEnd || !enEnd) {
    return -999999;
  }

  let score = (enStart.hp - enEnd.hp) * 45 - (aiStart.hp - aiEnd.hp) * 72;
  score -= threatPenalty(enEnd, aiEnd) * 4;

  if (endState.status === "finished") {
    if (endState.winnerId === aiShipId) {
      score += 42000;
    } else if (endState.draw) {
      score -= 800;
    } else if (endState.winnerId === enemyId) {
      score -= 41000;
    }
  }

  const dist = Math.abs(aiEnd.x - enEnd.x) + Math.abs(aiEnd.y - enEnd.y);
  score -= dist * 0.35;

  return score;
}

function planDedupKey(plan) {
  return JSON.stringify(plan);
}

/**
 * Build a bounded set of full-turn candidates: greedy baseline plus move/action mutations.
 */
function buildCandidatePlans(greedy) {
  /** @type {Map<string, import("./state.js").PhasePlan[]>} */
  const seen = new Map();
  const add = (p) => {
    const key = planDedupKey(p);
    if (!seen.has(key)) {
      seen.set(key, p);
    }
  };
  add(greedy);
  const g = greedy;
  for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
    for (const m of ALL_MOVES) {
      const c = clonePlan(g);
      c[phase] = { ...c[phase], move: m };
      add(c);
    }
    const noCombat = clonePlan(g);
    noCombat[phase] = {
      ...noCombat[phase],
      port: { kind: ACTION_KIND.NONE },
      starboard: { kind: ACTION_KIND.NONE },
    };
    add(noCombat);
  }
  return [...seen.values()];
}

/**
 * Generate a deterministic 4-phase plan for the AI ship.
 * Scores candidates with a full {@link resolveTurn} using the opponent's queued plan.
 *
 * @param {import("./state.js").MatchState} matchState
 * @param {string} aiShipId
 * @param {Record<string, import("./state.js").PhasePlan[]>} [plansByShipId] Opponent phases from planner; missing ship ⇒ empty phases.
 */
export function generateAiPlan(matchState, aiShipId, plansByShipId = {}) {
  const enemy = matchState.ships.find((ship) => ship.id !== aiShipId);
  if (!enemy) {
    return createEmptyPlan();
  }
  const humanPlanRaw = plansByShipId[enemy.id];
  const humanPlan =
    Array.isArray(humanPlanRaw) && humanPlanRaw.length > 0 ? clonePlan(humanPlanRaw) : createEmptyPlan();

  const greedy = buildGreedyPlan(matchState, aiShipId);
  const candidates = buildCandidatePlans(greedy);

  let best = greedy;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const duel = {
      [enemy.id]: humanPlan,
      [aiShipId]: candidate,
    };
    const { finalState } = resolveTurn(cloneState(matchState), duel);
    const score = scoreOutcome(matchState, finalState, aiShipId, enemy.id);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}
