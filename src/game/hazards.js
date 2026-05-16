import { HAZARD_TYPE, WHIRLPOOL_SPIN } from "./constants.js";
import { DIRECTION_VECTORS, FACING_TURN_LEFT, FACING_TURN_RIGHT } from "./geometry.js";

export function isInsideWhirlpool(x, y, whirlpool) {
  const size = whirlpool.size || 2;
  return x >= whirlpool.x && y >= whirlpool.y && x < whirlpool.x + size && y < whirlpool.y + size;
}

export function getWhirlpoolDestinationTile(x, y, whirlpool) {
  const size = whirlpool.size || 2;
  const dx = x - whirlpool.x;
  const dy = y - whirlpool.y;
  return {
    x: whirlpool.x + (size - 1 - dx),
    y: whirlpool.y + (size - 1 - dy),
  };
}

/** @returns {boolean} True when hazard spin matches CLOCKWISE whirl art / +90° turn-right mapping */
export function isClockwiseWhirlpoolSpin(whirlpool) {
  return (whirlpool.spin || WHIRLPOOL_SPIN.CW) === WHIRLPOOL_SPIN.CW;
}

/**
 * Spin-only knee on the 2×2 perimeter (ignores ship facing). Used as fallback when the
 * movement-style L knee does not apply, and for `getWhirlpoolKneeCenterTile`.
 */
function getWhirlpoolSpinKneeTile(whirlpool, fromTileX, fromTileY) {
  const wx = whirlpool.x;
  const wy = whirlpool.y;
  const size = whirlpool.size || 2;
  const spinCw = isClockwiseWhirlpoolSpin(whirlpool);

  if (size !== 2) {
    const cx = Math.floor(wx + size / 2);
    const cy = Math.floor(wy + size / 2);
    return { x: cx, y: cy };
  }

  const dx = fromTileX - wx;
  const dy = fromTileY - wy;

  const cornerIdx =
    dx === 0 && dy === 0 ? 0 : dx === 1 && dy === 0 ? 1 : dx === 1 && dy === 1 ? 2 : dx === 0 && dy === 1 ? 3 : -1;

  if (cornerIdx < 0) {
    const cx = Math.floor(wx + size / 2);
    const cy = Math.floor(wy + size / 2);
    return { x: cx, y: cy };
  }

  const kneeIdx = spinCw ? (cornerIdx + 1) % 4 : (cornerIdx + 3) % 4;
  const rel = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ][kneeIdx];
  return { x: wx + rel.x, y: wy + rel.y };
}

/**
 * Integer Bézier knee for playback: prefer the **movement** knee — one grid step along the
 * ship's starting facing — when it agrees with **whirlpool spin** around the block.
 *
 * A diagonal crossing has **two** valid L-shaped routes; facing can favour the perimeter
 * leg that contradicts CW/CCW. In that case we use {@link getWhirlpoolSpinKneeTile} so the
 * arc follows the whirl's swept side (same discrete corner order as `(cornerIdx ± 1) % 4`).
 *
 * @param {import("./state.js").ShipState} fromShip
 * @param {{ x: number, y: number }} toShip tile only
 */
export function getWhirlpoolKneeTile(whirlpool, fromShip, toShip) {
  const spinKnee = getWhirlpoolSpinKneeTile(whirlpool, fromShip.x, fromShip.y);

  const fx = typeof fromShip.x === "number" ? fromShip.x : NaN;
  const fy = typeof fromShip.y === "number" ? fromShip.y : NaN;
  const tx = typeof toShip?.x === "number" ? toShip.x : NaN;
  const ty = typeof toShip?.y === "number" ? toShip.y : NaN;
  const forwardVec = fromShip?.facing ? DIRECTION_VECTORS[fromShip.facing] : null;

  const manhattanFromTo =
    Number.isFinite(fx) && Number.isFinite(fy) && Number.isFinite(tx) && Number.isFinite(ty)
      ? Math.abs(tx - fx) + Math.abs(ty - fy)
      : NaN;

  const diagOpposite =
    Number.isFinite(manhattanFromTo) &&
    manhattanFromTo === 2 &&
    Number.isFinite(fx) &&
    Number.isFinite(fy) &&
    Number.isFinite(tx) &&
    Number.isFinite(ty) &&
    fx !== tx &&
    fy !== ty;

  if (diagOpposite && forwardVec) {
    const fwdKnee = { x: fx + forwardVec.x, y: fy + forwardVec.y };
    const dFromKnee = Math.abs(fwdKnee.x - fx) + Math.abs(fwdKnee.y - fy);
    const dKneeTo = Math.abs(tx - fwdKnee.x) + Math.abs(ty - fwdKnee.y);
    if (
      dFromKnee === 1 &&
      dKneeTo === 1 &&
      isInsideWhirlpool(fwdKnee.x, fwdKnee.y, whirlpool) &&
      isInsideWhirlpool(fx, fy, whirlpool)
    ) {
      const sameCorner = fwdKnee.x === spinKnee.x && fwdKnee.y === spinKnee.y;
      if (sameCorner) {
        return fwdKnee;
      }
      return spinKnee;
    }
  }

  return spinKnee;
}

/**
 * Same knee as the spin-directed helper, expressed as tile centre (float).
 */
export function getWhirlpoolKneeCenterTile(whirlpool, fromTileX, fromTileY) {
  const k = getWhirlpoolSpinKneeTile(whirlpool, fromTileX, fromTileY);
  return { x: k.x + 0.5, y: k.y + 0.5 };
}

/**
 * @param {import("./state.js").ShipState} fromShip
 * @param {import("./state.js").ShipState} toShip
 * @param {import("./state.js").MapGrid|null|undefined} grid
 * @returns {{ spinCw: boolean, whirlpool: Object, kneeTile: {x:number,y:number} } | null}
 */
export function classifyWhirlpoolForPlayback(fromShip, toShip, grid) {
  if (!grid || !Array.isArray(grid.hazards)) {
    return null;
  }
  const whirlpool = grid.hazards.find(
    (h) =>
      h.type === HAZARD_TYPE.WHIRLPOOL &&
      isInsideWhirlpool(fromShip.x, fromShip.y, h) &&
      isInsideWhirlpool(toShip.x, toShip.y, h),
  );
  if (!whirlpool) {
    return null;
  }
  const nextFacing = applyWhirlpoolFacingChange(fromShip.facing, whirlpool);
  if (toShip.facing !== nextFacing) {
    return null;
  }
  const dest = getWhirlpoolDestinationTile(fromShip.x, fromShip.y, whirlpool);
  const sameTile = fromShip.x === toShip.x && fromShip.y === toShip.y;
  const movedToOpposite = dest.x === toShip.x && dest.y === toShip.y;
  if (!(sameTile || movedToOpposite)) {
    return null;
  }
  return {
    spinCw: isClockwiseWhirlpoolSpin(whirlpool),
    whirlpool,
    kneeTile: getWhirlpoolKneeTile(whirlpool, fromShip, toShip),
  };
}

/** Exported for playback + symmetry with sim — grid-facing rotate from whirl spin */
export function applyWhirlpoolFacingChange(currentFacing, whirlpool) {
  if (isClockwiseWhirlpoolSpin(whirlpool)) {
    return FACING_TURN_RIGHT[currentFacing] || currentFacing;
  }
  return FACING_TURN_LEFT[currentFacing] || currentFacing;
}

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
    const whirlpool = whirlpools.find((hazard) => isInsideWhirlpool(ship.x, ship.y, hazard));
    if (!whirlpool) {
      continue;
    }
    shipsInWhirlpool.add(ship.id);
    const dest = getWhirlpoolDestinationTile(ship.x, ship.y, whirlpool);
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
    ship.facing = applyWhirlpoolFacingChange(ship.facing, move.whirlpool);
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
