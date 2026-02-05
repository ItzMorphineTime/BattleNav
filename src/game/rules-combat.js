import {
  ACTION,
  CANNONBALL_DAMAGE,
  DEFAULT_CANNONBALL_SIZE,
  DEFAULT_SHOTS_PER_ATTACK,
  GRAPPLE_RANGE,
  SHOOT_DAMAGE,
  SHOOT_RANGE,
  SIDE,
} from "./constants.js";

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

function sideDirection(facing, side) {
  return side === SIDE.PORT ? PORT_DIRECTION[facing] : STARBOARD_DIRECTION[facing];
}

function isShootAction(action) {
  return action === ACTION.SHOOT_PORT || action === ACTION.SHOOT_STARBOARD;
}

function isGrappleAction(action) {
  return action === ACTION.GRAPPLE_PORT || action === ACTION.GRAPPLE_STARBOARD;
}

function sideFromAction(action) {
  if (action === ACTION.SHOOT_PORT || action === ACTION.GRAPPLE_PORT) {
    return SIDE.PORT;
  }
  return SIDE.STARBOARD;
}

function traceLine(startShip, direction, range) {
  const vec = DIRECTION_VECTORS[direction];
  const tiles = [];
  for (let step = 1; step <= range; step += 1) {
    tiles.push({
      x: startShip.x + vec.x * step,
      y: startShip.y + vec.y * step,
      step,
    });
  }
  return tiles;
}

function isOnTile(ship, tile) {
  return ship.x === tile.x && ship.y === tile.y;
}

export function resolveCombatPhase(ships, phasePlansByShipId) {
  const byId = Object.fromEntries(ships.map((ship) => [ship.id, ship]));
  const damageByShipId = Object.fromEntries(ships.map((ship) => [ship.id, 0]));
  const grappleByShipId = Object.fromEntries(ships.map((ship) => [ship.id, false]));
  const events = [];
  const traces = [];

  for (const attacker of ships) {
    const defender = ships.find((ship) => ship.id !== attacker.id);
    const phasePlan = phasePlansByShipId[attacker.id] || { action: ACTION.NONE };
    const action = phasePlan.action || ACTION.NONE;

    if (isShootAction(action)) {
      const side = sideFromAction(action);
      const firingDirection = sideDirection(attacker.facing, side);
      const cannonRange = attacker.cannonRange ?? SHOOT_RANGE;
      const cannonballSize = attacker.cannonballSize || DEFAULT_CANNONBALL_SIZE;
      const damagePerShot = CANNONBALL_DAMAGE[cannonballSize] ?? SHOOT_DAMAGE;
      const maxShots = attacker.shotsPerAttack ?? DEFAULT_SHOTS_PER_ATTACK;
      const requestedShots = Number(phasePlan.shots);
      const shotsUsed = Number.isFinite(requestedShots)
        ? Math.min(maxShots, Math.max(1, requestedShots))
        : maxShots;
      const totalDamage = damagePerShot * shotsUsed;
      const line = traceLine(attacker, firingDirection, cannonRange);
      traces.push({
        attackerId: attacker.id,
        kind: "shot",
        line,
        shots: shotsUsed,
        cannonballSize,
      });

      const hitTile = line.find((tile) => isOnTile(defender, tile));
      if (hitTile) {
        damageByShipId[defender.id] += totalDamage;
        const shotSuffix = shotsUsed > 1 ? ` (${shotsUsed} shots)` : shotsUsed === 1 && maxShots > 1 ? " (1 shot)" : "";
        events.push(`${attacker.name} fires ${side}${shotSuffix} and hits ${defender.name}.`);
      } else {
        const shotSuffix = shotsUsed > 1 ? ` (${shotsUsed} shots)` : shotsUsed === 1 && maxShots > 1 ? " (1 shot)" : "";
        events.push(`${attacker.name} fires ${side}${shotSuffix} and misses.`);
      }
    } else if (isGrappleAction(action)) {
      const side = sideFromAction(action);
      const grappleDirection = sideDirection(attacker.facing, side);
      const grappleRange = attacker.grappleRange ?? GRAPPLE_RANGE;
      const grappleTiles = traceLine(attacker, grappleDirection, grappleRange);
      traces.push({
        attackerId: attacker.id,
        kind: "grapple",
        line: grappleTiles,
      });

      const connected = grappleTiles.some((tile) => isOnTile(defender, tile));
      if (connected) {
        grappleByShipId[attacker.id] = true;
        events.push(`${attacker.name} lands a ${side} grapple.`);
      } else {
        events.push(`${attacker.name} attempts ${side} grapple but fails.`);
      }
    }
  }

  return {
    damageByShipId,
    grappleByShipId,
    traces,
    events,
    byId,
  };
}
