import { HAZARD_TYPE, WHIRLPOOL_SPIN } from "./constants.js";

/** Direction lookup for grid movement. */
const DIRECTION_VECTORS = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

const TURN_RIGHT = { N: "E", E: "S", S: "W", W: "N" };
const TURN_LEFT = { N: "W", W: "S", S: "E", E: "N" };

/** @param {number} x @param {number} y */
function isInsideGrid(x, y, grid) {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

function isTileBlockedByList(x, y, list) {
  if (!Array.isArray(list)) {
    return false;
  }
  return list.some((tile) => tile && tile.x === x && tile.y === y);
}

function isStaticBlocked(x, y, grid) {
  if (!grid) {
    return false;
  }
  return (
    isTileBlockedByList(x, y, grid.obstacles) ||
    isTileBlockedByList(x, y, grid.blocks) ||
    isTileBlockedByList(x, y, grid.rocks)
  );
}

/** @returns {import("./state.js").ShipState|null} */
function findShipAt(x, y, ships, excludeId) {
  return ships.find((ship) => ship.id !== excludeId && ship.x === x && ship.y === y) || null;
}

/** Apply a single wind push if the target tile is clear. */
function applyWind(ship, hazard, grid, ships) {
  const vec = DIRECTION_VECTORS[hazard.dir];
  if (!vec) {
    return { moved: false };
  }
  const nx = ship.x + vec.x;
  const ny = ship.y + vec.y;
  if (!isInsideGrid(nx, ny, grid)) {
    return { moved: false, reason: "edge" };
  }
  if (isStaticBlocked(nx, ny, grid)) {
    return { moved: false, reason: "obstacle" };
  }
  if (findShipAt(nx, ny, ships, ship.id)) {
    return { moved: false, reason: "ship" };
  }
  ship.x = nx;
  ship.y = ny;
  return { moved: true };
}

function isWithinWhirlpool(x, y, whirlpool) {
  const size = whirlpool.size || 2;
  return x >= whirlpool.x && y >= whirlpool.y && x < whirlpool.x + size && y < whirlpool.y + size;
}

function whirlpoolDestination(x, y, whirlpool) {
  const size = whirlpool.size || 2;
  const dx = x - whirlpool.x;
  const dy = y - whirlpool.y;
  return {
    x: whirlpool.x + (size - 1 - dx),
    y: whirlpool.y + (size - 1 - dy),
  };
}

/** Whirlpool spin uses grid-facing rotation, not world rotation. */
function rotateByWhirlpoolFacing(currentFacing, whirlpool) {
  const spin = whirlpool.spin || WHIRLPOOL_SPIN.CW;
  if (spin === WHIRLPOOL_SPIN.CCW) {
    return TURN_LEFT[currentFacing] || currentFacing;
  }
  return TURN_RIGHT[currentFacing] || currentFacing;
}

/**
 * Apply hazards in two passes: whirlpools first (multi-tile), then single-tile winds.
 * @param {import("./state.js").ShipState[]} ships
 * @param {import("./state.js").MapGrid} grid
 * @returns {{ships: import("./state.js").ShipState[], events: string[]}}
 */
export function applyHazardsPhase(ships, grid) {
  const nextShips = ships.map((ship) => ({ ...ship }));
  const events = [];

  if (!grid || !Array.isArray(grid.hazards) || grid.hazards.length === 0) {
    return {
      ships: nextShips,
      events,
    };
  }

  const whirlpools = grid.hazards.filter((hazard) => hazard.type === HAZARD_TYPE.WHIRLPOOL);
  const shipsInWhirlpool = new Set();
  const whirlpoolMoves = [];

  // Collect whirlpool moves so we can apply them without mid-loop interference.
  for (const ship of nextShips) {
    const whirlpool = whirlpools.find((hazard) => isWithinWhirlpool(ship.x, ship.y, hazard));
    if (!whirlpool) {
      continue;
    }
    shipsInWhirlpool.add(ship.id);
    const dest = whirlpoolDestination(ship.x, ship.y, whirlpool);
    whirlpoolMoves.push({
      shipId: ship.id,
      whirlpool,
      dest,
    });
  }

  // Apply whirlpool rotation + displacement.
  for (const move of whirlpoolMoves) {
    const ship = nextShips.find((candidate) => candidate.id === move.shipId);
    if (!ship) {
      continue;
    }
    ship.facing = rotateByWhirlpoolFacing(ship.facing, move.whirlpool);
    if (!isInsideGrid(move.dest.x, move.dest.y, grid)) {
      events.push(`${ship.name} is spun but cannot move.`);
      continue;
    }
    if (isStaticBlocked(move.dest.x, move.dest.y, grid)) {
      events.push(`${ship.name} is spun but blocked by rocks.`);
      continue;
    }
    const blockingShip = findShipAt(move.dest.x, move.dest.y, nextShips, ship.id);
    if (blockingShip && !shipsInWhirlpool.has(blockingShip.id)) {
      events.push(`${ship.name} is spun but cannot move.`);
      continue;
    }
    ship.x = move.dest.x;
    ship.y = move.dest.y;
    events.push(`${ship.name} is spun through the whirlpool.`);
  }

  // Apply wind pushes for ships not caught in a whirlpool.
  for (const ship of nextShips) {
    if (shipsInWhirlpool.has(ship.id)) {
      continue;
    }
    const hazard = grid.hazards.find((tile) => tile.x === ship.x && tile.y === ship.y);
    if (!hazard) {
      continue;
    }
    if (hazard.type === HAZARD_TYPE.WIND) {
      const result = applyWind(ship, hazard, grid, nextShips);
      if (result.moved) {
        events.push(`${ship.name} is pushed by wind.`);
      } else if (result.reason) {
        events.push(`${ship.name} resists the wind.`);
      }
    }
  }

  return {
    ships: nextShips,
    events,
  };
}
