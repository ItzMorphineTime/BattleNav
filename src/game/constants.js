export const GRID_SIZE = 24;
export const PHASE_COUNT = 4;
export const TURN_SECONDS = 30;

export const MAP_MODE = Object.freeze({
  DEFAULT: "default",
  PROCEDURAL: "procedural",
});

export const PROCEDURAL_CONFIG = Object.freeze({
  windCount: 6,
  whirlpoolCount: 2,
  largeRockCount: 3,
  smallRockCount: 5,
  spawnBuffer: 2,
  edgePadding: 1,
});

export const MOVE = Object.freeze({
  NONE: "none",
  FORWARD: "forward",
  TURN_LEFT: "turn_left",
  TURN_RIGHT: "turn_right",
});

export const ACTION = Object.freeze({
  NONE: "none",
  SHOOT_PORT: "shoot_port",
  SHOOT_STARBOARD: "shoot_starboard",
  GRAPPLE_PORT: "grapple_port",
  GRAPPLE_STARBOARD: "grapple_starboard",
});

export const ACTION_KIND = Object.freeze({
  NONE: "none",
  FIRE: "fire",
  GRAPPLE: "grapple",
});

export const SIDE = Object.freeze({
  PORT: "port",
  STARBOARD: "starboard",
});

export const CANNONBALL_SIZE = Object.freeze({
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
});

export const HAZARD_TYPE = Object.freeze({
  WIND: "wind",
  WHIRLPOOL: "whirlpool",
});

export const WHIRLPOOL_SPIN = Object.freeze({
  CW: "cw",
  CCW: "ccw",
});

export const ROCK_SIZE = Object.freeze({
  SMALL: "small",
  LARGE: "large",
});

export const SHIP_TYPES = {
  sloop: {
    id: "sloop",
    label: "Sloop",
    hp: 10,
    cannonRange: 2,
    cannonballSize: CANNONBALL_SIZE.SMALL,
    shotsPerAttack: 1,
    grappleRange: 1,
    speed: 1,
    turnProfile: "fast",
  },
  cutter: {
    id: "cutter",
    label: "Cutter",
    hp: 16,
    cannonRange: 3,
    cannonballSize: CANNONBALL_SIZE.SMALL,
    shotsPerAttack: 2,
    grappleRange: 1,
    speed: 1,
    turnProfile: "balanced",
  },
  war_brig: {
    id: "war_brig",
    label: "War Brig",
    hp: 20,
    cannonRange: 3,
    cannonballSize: CANNONBALL_SIZE.MEDIUM,
    shotsPerAttack: 2,
    grappleRange: 1,
    speed: 1,
    turnProfile: "slow",
  },
  dhow: {
    id: "dhow",
    label: "Dhow",
    hp: 14,
    cannonRange: 3,
    cannonballSize: CANNONBALL_SIZE.MEDIUM,
    shotsPerAttack: 1,
    grappleRange: 1,
    speed: 1,
    turnProfile: "balanced",
  },
  war_frigate: {
    id: "war_frigate",
    label: "War Frigate",
    hp: 30,
    cannonRange: 4,
    cannonballSize: CANNONBALL_SIZE.LARGE,
    shotsPerAttack: 2,
    grappleRange: 1,
    speed: 1,
    turnProfile: "very_slow",
  },
  baghlah: {
    id: "baghlah",
    label: "Baghlah",
    hp: 24,
    cannonRange: 4,
    cannonballSize: CANNONBALL_SIZE.LARGE,
    shotsPerAttack: 1,
    grappleRange: 1,
    speed: 1,
    turnProfile: "slow",
  },
};

export const DEFAULT_SHIP_TYPE = "cutter";
export const CANNONBALL_DAMAGE = {
  [CANNONBALL_SIZE.SMALL]: 1,
  [CANNONBALL_SIZE.MEDIUM]: 2,
  [CANNONBALL_SIZE.LARGE]: 4,
};
export const DEFAULT_CANNONBALL_SIZE = CANNONBALL_SIZE.SMALL;
export const DEFAULT_SHOTS_PER_ATTACK = 1;
export const MAX_HP = SHIP_TYPES[DEFAULT_SHIP_TYPE].hp;
export const SHOOT_RANGE = 3;
export const SHOOT_DAMAGE = 1;
export const GRAPPLE_RANGE = 1;

export const FACINGS = ["N", "E", "S", "W"];
export const MOVES = [MOVE.NONE, MOVE.FORWARD, MOVE.TURN_LEFT, MOVE.TURN_RIGHT];
export const ACTIONS = [
  ACTION.NONE,
  ACTION.SHOOT_PORT,
  ACTION.SHOOT_STARBOARD,
  ACTION.GRAPPLE_PORT,
  ACTION.GRAPPLE_STARBOARD,
];
