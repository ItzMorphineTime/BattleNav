import {
  ACTION,
  DEFAULT_SHOTS_PER_ATTACK,
  GRAPPLE_RANGE,
  MOVE,
  PHASE_COUNT,
  SHOOT_RANGE,
  SIDE,
} from "./constants.js";

/** Direction lookup for grid movement. */
const DIRECTION_VECTORS = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

const PORT_DIRECTION = {
  N: "W",
  E: "N",
  S: "E",
  W: "S",
};

const STARBOARD_DIRECTION = {
  N: "E",
  E: "S",
  S: "W",
  W: "N",
};

const TURN_LEFT = { N: "W", W: "S", S: "E", E: "N" };
const TURN_RIGHT = { N: "E", E: "S", S: "W", W: "N" };

/** Resolve port/starboard into an absolute facing. */
function sideDirection(facing, side) {
  return side === SIDE.PORT ? PORT_DIRECTION[facing] : STARBOARD_DIRECTION[facing];
}

function inLineRange(attacker, target, direction, range) {
  const vec = DIRECTION_VECTORS[direction];
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
  const left = TURN_LEFT[current];
  if (left === desired) {
    return MOVE.TURN_LEFT;
  }
  return MOVE.TURN_RIGHT;
}

/** Simple forward-only collision check for AI previews. */
function canMoveForward(ship, grid, enemy) {
  const vec = DIRECTION_VECTORS[ship.facing];
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

/** Apply a lightweight move preview for AI planning. */
function applyMovePreview(ship, move, grid, enemy) {
  const next = { ...ship };
  if (move === MOVE.FORWARD && canMoveForward(ship, grid, enemy)) {
    const vec = DIRECTION_VECTORS[ship.facing];
    next.x += vec.x;
    next.y += vec.y;
  } else if (move === MOVE.TURN_LEFT) {
    next.facing = TURN_LEFT[ship.facing];
  } else if (move === MOVE.TURN_RIGHT) {
    next.facing = TURN_RIGHT[ship.facing];
  }
  return next;
}

/** Greedy action choice (grapple > shoot > none) based on current alignment. */
function chooseAction(attacker, target) {
  const cannonRange = attacker.cannonRange ?? SHOOT_RANGE;
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
 * Generate a deterministic 4-phase plan for the AI ship.
 * @param {import("./state.js").MatchState} matchState
 * @param {string} aiShipId
 * @returns {Array<{move:string, action:string, shots?:number}>}
 */
export function generateAiPlan(matchState, aiShipId) {
  const plan = [];
  const aiShip = matchState.ships.find((ship) => ship.id === aiShipId);
  const enemy = matchState.ships.find((ship) => ship.id !== aiShipId);
  if (!aiShip || !enemy) {
    return plan;
  }

  let simulatedAi = { ...aiShip };
  const staticEnemy = { ...enemy };

  for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
    const action = chooseAction(simulatedAi, staticEnemy);
    const move = chooseMove(simulatedAi, staticEnemy, matchState.grid);
    const entry = { move, action };
    if (action === ACTION.SHOOT_PORT || action === ACTION.SHOOT_STARBOARD) {
      entry.shots = simulatedAi.shotsPerAttack ?? DEFAULT_SHOTS_PER_ATTACK;
    }
    plan.push(entry);
    simulatedAi = applyMovePreview(simulatedAi, move, matchState.grid, staticEnemy);
  }

  return plan;
}
