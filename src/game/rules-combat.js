import {
  ACTION_KIND,
  CANNONBALL_DAMAGE,
  DEFAULT_CANNONBALL_SIZE,
  DEFAULT_SHOTS_PER_ATTACK,
  FALLBACK_CANNON_RANGE,
  FALLBACK_SHOT_DAMAGE_PER_SHOT,
  GRAPPLE_RANGE,
  ROCK_SIZE,
  SIDE,
} from "./constants.js";
import { DIRECTION_VECTORS, sideDirection } from "./geometry.js";
import { normalizePhasePlan } from "./plan-normalize.js";

/** Trace a straight line of tiles out to range. */
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

function findLargeRockAt(x, y, grid) {
  if (!grid || !Array.isArray(grid.rocks)) {
    return null;
  }
  return grid.rocks.find((rock) => rock.x === x && rock.y === y && rock.size === ROCK_SIZE.LARGE);
}

/** Limit line of sight when large rocks block cannon fire. */
function applyLineOfSight(line, grid) {
  for (let i = 0; i < line.length; i += 1) {
    const tile = line[i];
    if (findLargeRockAt(tile.x, tile.y, grid)) {
      return {
        line: line.slice(0, i + 1),
        blocked: true,
      };
    }
  }
  return { line, blocked: false };
}

/**
 * Resolve combat intent for the current phase.
 * @param {import("./state.js").ShipState[]} ships
 * @param {Record<string, {port?:{kind:string, shots?:number}, starboard?:{kind:string, shots?:number}}>} phasePlansByShipId
 * @param {import("./state.js").MapGrid} grid
 */
export function resolveCombatPhase(ships, phasePlansByShipId, grid) {
  const byId = Object.fromEntries(ships.map((ship) => [ship.id, ship]));
  const damageByShipId = Object.fromEntries(ships.map((ship) => [ship.id, 0]));
  const grappleByShipId = Object.fromEntries(ships.map((ship) => [ship.id, false]));
  const events = [];
  const traces = [];

  // Evaluate each ship's action against the other ship (simultaneous resolution).
  for (const attacker of ships) {
    const defender = ships.find((ship) => ship.id !== attacker.id);
    const phasePlan = normalizePhasePlan(phasePlansByShipId[attacker.id]);

    const sidePlans = [
      { side: SIDE.PORT, plan: phasePlan.port },
      { side: SIDE.STARBOARD, plan: phasePlan.starboard },
    ];

    for (const sidePlan of sidePlans) {
      const side = sidePlan.side;
      const plan = sidePlan.plan || { kind: ACTION_KIND.NONE };
      if (plan.kind === ACTION_KIND.FIRE) {
        const firingDirection = sideDirection(attacker.facing, side);
        const cannonRange = attacker.cannonRange ?? FALLBACK_CANNON_RANGE;
        const cannonballSize = attacker.cannonballSize || DEFAULT_CANNONBALL_SIZE;
        const damagePerShot = CANNONBALL_DAMAGE[cannonballSize] ?? FALLBACK_SHOT_DAMAGE_PER_SHOT;
        const maxShots = attacker.shotsPerAttack ?? DEFAULT_SHOTS_PER_ATTACK;
        const requestedShots = Number(plan.shots);
        const shotsUsed = Number.isFinite(requestedShots)
          ? Math.min(maxShots, Math.max(1, requestedShots))
          : maxShots;
        const totalDamage = damagePerShot * shotsUsed;
        const rawLine = traceLine(attacker, firingDirection, cannonRange);
        const los = applyLineOfSight(rawLine, grid);
        const line = los.line;
        const hitIndex = line.findIndex((tile) => isOnTile(defender, tile));
        const impactIndex = hitIndex >= 0 ? hitIndex : line.length - 1;
        const impactType = hitIndex >= 0 ? "ship" : los.blocked ? "obstacle" : "miss";

        traces.push({
          attackerId: attacker.id,
          kind: "shot",
          side,
          line,
          shots: shotsUsed,
          cannonballSize,
          impact: {
            index: impactIndex,
            type: impactType,
            x: line[impactIndex]?.x,
            y: line[impactIndex]?.y,
          },
        });

        if (hitIndex >= 0) {
          damageByShipId[defender.id] += totalDamage;
          const shotSuffix =
            shotsUsed > 1
              ? ` (${shotsUsed} shots)`
              : shotsUsed === 1 && maxShots > 1
                ? " (1 shot)"
                : "";
          events.push(`${attacker.name} fires ${side}${shotSuffix} and hits ${defender.name}.`);
        } else if (los.blocked) {
          const shotSuffix =
            shotsUsed > 1
              ? ` (${shotsUsed} shots)`
              : shotsUsed === 1 && maxShots > 1
                ? " (1 shot)"
                : "";
          events.push(`${attacker.name} fires ${side}${shotSuffix} into a large rock.`);
        } else {
          const shotSuffix =
            shotsUsed > 1
              ? ` (${shotsUsed} shots)`
              : shotsUsed === 1 && maxShots > 1
                ? " (1 shot)"
                : "";
          events.push(`${attacker.name} fires ${side}${shotSuffix} and misses.`);
        }
      } else if (plan.kind === ACTION_KIND.GRAPPLE) {
        const grappleDirection = sideDirection(attacker.facing, side);
        const grappleRange = attacker.grappleRange ?? GRAPPLE_RANGE;
        const grappleTiles = traceLine(attacker, grappleDirection, grappleRange);
        const connected = grappleTiles.some((tile) => isOnTile(defender, tile));

        traces.push({
          attackerId: attacker.id,
          kind: "grapple",
          side,
          line: grappleTiles,
          impact: {
            index: grappleTiles.length ? grappleTiles.length - 1 : 0,
            type: connected ? "ship" : "miss",
            x: grappleTiles[grappleTiles.length - 1]?.x,
            y: grappleTiles[grappleTiles.length - 1]?.y,
          },
        });

        if (connected) {
          grappleByShipId[attacker.id] = true;
          events.push(`${attacker.name} lands a ${side} grapple.`);
        } else {
          events.push(`${attacker.name} attempts ${side} grapple but fails.`);
        }
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
