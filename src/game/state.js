import {
  ACTION,
  DEFAULT_SHIP_TYPE,
  GRID_SIZE,
  MOVE,
  PHASE_COUNT,
  SHIP_TYPES,
} from "./constants.js";

export function createEmptyPlan() {
  return Array.from({ length: PHASE_COUNT }, () => ({
    move: MOVE.NONE,
    action: ACTION.NONE,
  }));
}

export function createInitialState(options = {}) {
  const buildShip = ({ id, name, x, y, facing, typeId }) => {
    const type = SHIP_TYPES[typeId] || SHIP_TYPES[DEFAULT_SHIP_TYPE];
    return {
      id,
      name,
      x,
      y,
      facing,
      typeId: type.id,
      typeLabel: type.label,
      hp: type.hp,
      maxHp: type.hp,
      cannonRange: type.cannonRange,
      cannonballSize: type.cannonballSize,
      shotsPerAttack: type.shotsPerAttack,
      grappleRange: type.grappleRange,
      speed: type.speed,
      turnProfile: type.turnProfile,
      alive: true,
    };
  };

  const p1TypeId = options.p1TypeId || "cutter";
  const p2TypeId = options.p2TypeId || "war_brig";
  const p1Name = options.p1Name || "Captain Tide";
  const p2Name = options.p2Name || "Captain Ember";

  return {
    turnNumber: 1,
    phaseIndex: null,
    status: "planning",
    winnerId: null,
    draw: false,
    grid: {
      width: GRID_SIZE,
      height: GRID_SIZE,
      hazards: [],
    },
    ships: [
      buildShip({
        id: "P1",
        name: p1Name,
        x: 5,
        y: 12,
        facing: "E",
        typeId: p1TypeId,
      }),
      buildShip({
        id: "P2",
        name: p2Name,
        x: 18,
        y: 12,
        facing: "W",
        typeId: p2TypeId,
      }),
    ],
  };
}

export function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}
