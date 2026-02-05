export function applyCombatResults(ships, combatResult) {
  const nextShips = ships.map((ship) => ({ ...ship }));
  const shipById = Object.fromEntries(nextShips.map((ship) => [ship.id, ship]));
  const events = [];

  for (const ship of nextShips) {
    const damage = combatResult.damageByShipId[ship.id] || 0;
    if (damage > 0) {
      ship.hp = Math.max(0, ship.hp - damage);
      events.push(`${ship.name} takes ${damage} damage (HP ${ship.hp}).`);
    }
    ship.alive = ship.hp > 0;
  }

  const [shipA, shipB] = nextShips;
  const aGrappled = Boolean(combatResult.grappleByShipId[shipA.id]);
  const bGrappled = Boolean(combatResult.grappleByShipId[shipB.id]);

  let winnerId = null;
  let draw = false;
  let reason = null;

  if (aGrappled && bGrappled) {
    draw = true;
    reason = "Both grapples connected simultaneously.";
  } else if (aGrappled) {
    winnerId = shipA.id;
    reason = `${shipA.name} wins by grapple.`;
  } else if (bGrappled) {
    winnerId = shipB.id;
    reason = `${shipB.name} wins by grapple.`;
  } else {
    const aDead = !shipById[shipA.id].alive;
    const bDead = !shipById[shipB.id].alive;

    if (aDead && bDead) {
      draw = true;
      reason = "Both ships were destroyed in the same phase.";
    } else if (aDead) {
      winnerId = shipB.id;
      reason = `${shipB.name} sinks ${shipA.name}.`;
    } else if (bDead) {
      winnerId = shipA.id;
      reason = `${shipA.name} sinks ${shipB.name}.`;
    }
  }

  return {
    ships: nextShips,
    outcome: {
      winnerId,
      draw,
      reason,
    },
    events,
  };
}
