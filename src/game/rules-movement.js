import { MOVE } from "./constants.js";

const DIRECTION_VECTORS = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

const TURN_LEFT = { N: "W", W: "S", S: "E", E: "N" };
const TURN_RIGHT = { N: "E", E: "S", S: "W", W: "N" };

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

function sameTile(a, b) {
  return a && b && a.x === b.x && a.y === b.y;
}

function isForwardMove(move) {
  return move === MOVE.FORWARD;
}

function isTurnMove(move) {
  return move === MOVE.TURN_LEFT || move === MOVE.TURN_RIGHT;
}

function nextForwardPosition(ship, facingOverride) {
  const vec = DIRECTION_VECTORS[facingOverride || ship.facing];
  return { x: ship.x + vec.x, y: ship.y + vec.y };
}

function computeProposal(ship, move, grid) {
  const proposal = {
    move,
    start: { x: ship.x, y: ship.y },
    facingStart: ship.facing,
    facingEnd: ship.facing,
    step1: null,
    step1BlockedStatic: false,
    step1BlockedReason: null,
    step2: null,
    step2BlockedStatic: false,
    step2BlockedReason: null,
  };

  if (isForwardMove(move)) {
    const step1 = nextForwardPosition(ship);
    proposal.step1 = step1;
    if (!isInsideGrid(step1.x, step1.y, grid)) {
      proposal.step1BlockedStatic = true;
      proposal.step1BlockedReason = "edge";
    } else if (isStaticBlocked(step1.x, step1.y, grid)) {
      proposal.step1BlockedStatic = true;
      proposal.step1BlockedReason = "obstacle";
    }
    return proposal;
  }

  if (isTurnMove(move)) {
    const turnLeft = move === MOVE.TURN_LEFT;
    proposal.facingEnd = turnLeft ? TURN_LEFT[ship.facing] : TURN_RIGHT[ship.facing];

    const step1 = nextForwardPosition(ship);
    proposal.step1 = step1;
    if (!isInsideGrid(step1.x, step1.y, grid)) {
      proposal.step1BlockedStatic = true;
      proposal.step1BlockedReason = "edge";
      return proposal;
    }
    if (isStaticBlocked(step1.x, step1.y, grid)) {
      proposal.step1BlockedStatic = true;
      proposal.step1BlockedReason = "obstacle";
      return proposal;
    }

    const sideFacing = proposal.facingEnd;
    const sideVec = DIRECTION_VECTORS[sideFacing];
    const step2 = {
      x: step1.x + sideVec.x,
      y: step1.y + sideVec.y,
    };
    proposal.step2 = step2;
    if (!isInsideGrid(step2.x, step2.y, grid)) {
      proposal.step2BlockedStatic = true;
      proposal.step2BlockedReason = "edge";
    } else if (isStaticBlocked(step2.x, step2.y, grid)) {
      proposal.step2BlockedStatic = true;
      proposal.step2BlockedReason = "obstacle";
    }
  }

  return proposal;
}

export function resolveMovementPhase(ships, phasePlansByShipId, grid) {
  const [a, b] = ships.map((ship) => ({ ...ship }));
  const aPlan = phasePlansByShipId[a.id] || { move: MOVE.NONE };
  const bPlan = phasePlansByShipId[b.id] || { move: MOVE.NONE };

  const movementEvents = [];

  const aProposal = computeProposal(a, aPlan.move, grid);
  const bProposal = computeProposal(b, bPlan.move, grid);

  let aStep1Allowed = Boolean(aProposal.step1) && !aProposal.step1BlockedStatic;
  let bStep1Allowed = Boolean(bProposal.step1) && !bProposal.step1BlockedStatic;

  if (aProposal.step1BlockedStatic) {
    if (isTurnMove(aPlan.move)) {
      movementEvents.push(`${a.name} pivots but the bow is blocked.`);
    } else {
      movementEvents.push(`${a.name} cannot move forward.`);
    }
  }
  if (bProposal.step1BlockedStatic) {
    if (isTurnMove(bPlan.move)) {
      movementEvents.push(`${b.name} pivots but the bow is blocked.`);
    } else {
      movementEvents.push(`${b.name} cannot move forward.`);
    }
  }

  if (aStep1Allowed && bStep1Allowed) {
    if (sameTile(aProposal.step1, bProposal.step1)) {
      aStep1Allowed = false;
      bStep1Allowed = false;
      movementEvents.push("Both ships clash in maneuvering and remain in place.");
    } else if (
      sameTile(aProposal.step1, bProposal.start) &&
      sameTile(bProposal.step1, aProposal.start)
    ) {
      aStep1Allowed = false;
      bStep1Allowed = false;
      movementEvents.push("Both ships collide head-on and remain in place.");
    }
  }

  if (aStep1Allowed && sameTile(aProposal.step1, bProposal.start) && !bStep1Allowed) {
    aStep1Allowed = false;
    movementEvents.push(`${a.name} cannot move into ${b.name}.`);
  }
  if (bStep1Allowed && sameTile(bProposal.step1, aProposal.start) && !aStep1Allowed) {
    bStep1Allowed = false;
    movementEvents.push(`${b.name} cannot move into ${a.name}.`);
  }

  const aPos1 = aStep1Allowed ? aProposal.step1 : aProposal.start;
  const bPos1 = bStep1Allowed ? bProposal.step1 : bProposal.start;

  let aStep2Allowed =
    isTurnMove(aPlan.move) &&
    aStep1Allowed &&
    aProposal.step2 &&
    !aProposal.step2BlockedStatic;
  let bStep2Allowed =
    isTurnMove(bPlan.move) &&
    bStep1Allowed &&
    bProposal.step2 &&
    !bProposal.step2BlockedStatic;

  if (aProposal.step2BlockedStatic && isTurnMove(aPlan.move) && aStep1Allowed) {
    movementEvents.push(`${a.name} cannot complete the turn.`);
  }
  if (bProposal.step2BlockedStatic && isTurnMove(bPlan.move) && bStep1Allowed) {
    movementEvents.push(`${b.name} cannot complete the turn.`);
  }

  if (aStep2Allowed && bStep2Allowed && sameTile(aProposal.step2, bProposal.step2)) {
    aStep2Allowed = false;
    bStep2Allowed = false;
    movementEvents.push("Both ships collide during their turns and hold position.");
  }

  if (aStep2Allowed && sameTile(aProposal.step2, bPos1)) {
    aStep2Allowed = false;
    movementEvents.push(`${a.name} cannot complete the turn into ${b.name}.`);
  }
  if (bStep2Allowed && sameTile(bProposal.step2, aPos1)) {
    bStep2Allowed = false;
    movementEvents.push(`${b.name} cannot complete the turn into ${a.name}.`);
  }

  const aFinal = aStep2Allowed ? aProposal.step2 : aPos1;
  const bFinal = bStep2Allowed ? bProposal.step2 : bPos1;

  a.x = aFinal.x;
  a.y = aFinal.y;
  b.x = bFinal.x;
  b.y = bFinal.y;

  if (isTurnMove(aPlan.move)) {
    a.facing = aProposal.facingEnd;
  }
  if (isTurnMove(bPlan.move)) {
    b.facing = bProposal.facingEnd;
  }

  return {
    ships: [a, b],
    events: movementEvents,
  };
}
