import {
  ACTION,
  DEFAULT_SHIP_TYPE,
  FACINGS,
  GRID_SIZE,
  HAZARD_TYPE,
  MAP_MODE,
  MOVE,
  PHASE_COUNT,
  PROCEDURAL_CONFIG,
  ROCK_SIZE,
  SHIP_TYPES,
  WHIRLPOOL_SPIN,
} from "./constants.js";

/**
 * @typedef {Object} PhasePlan
 * @property {string} move
 * @property {string} action
 * @property {number=} shots
 */

/**
 * @typedef {Object} MapGrid
 * @property {number} width
 * @property {number} height
 * @property {string} mode
 * @property {number=} seed
 * @property {Array<Object>=} hazards
 * @property {Array<Object>=} rocks
 */

/**
 * @typedef {Object} ShipState
 * @property {string} id
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {string} facing
 * @property {string} typeId
 * @property {string} typeLabel
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} cannonRange
 * @property {string} cannonballSize
 * @property {number} shotsPerAttack
 * @property {number} grappleRange
 * @property {number} speed
 * @property {boolean} alive
 */

/**
 * @typedef {Object} MatchState
 * @property {number} turnNumber
 * @property {number|null} phaseIndex
 * @property {string} status
 * @property {string|null} winnerId
 * @property {boolean} draw
 * @property {MapGrid} grid
 * @property {ShipState[]} ships
 */

const DEFAULT_SPAWNS = [
  { id: "P1", x: 5, y: 12, facing: "E" },
  { id: "P2", x: 18, y: 12, facing: "W" },
];

/** @returns {PhasePlan[]} */
export function createEmptyPlan() {
  return Array.from({ length: PHASE_COUNT }, () => ({
    move: MOVE.NONE,
    action: ACTION.NONE,
  }));
}

/** @returns {MapGrid} */
function buildDefaultMap() {
  return {
    width: GRID_SIZE,
    height: GRID_SIZE,
    mode: MAP_MODE.DEFAULT,
    hazards: [
      { type: HAZARD_TYPE.WIND, x: 7, y: 5, dir: "E" },
      { type: HAZARD_TYPE.WIND, x: 7, y: 18, dir: "E" },
      { type: HAZARD_TYPE.WIND, x: 16, y: 5, dir: "W" },
      { type: HAZARD_TYPE.WIND, x: 16, y: 18, dir: "W" },
      { type: HAZARD_TYPE.WIND, x: 11, y: 4, dir: "S" },
      { type: HAZARD_TYPE.WIND, x: 12, y: 19, dir: "N" },
      { type: HAZARD_TYPE.WHIRLPOOL, x: 9, y: 8, size: 2, spin: WHIRLPOOL_SPIN.CW },
      { type: HAZARD_TYPE.WHIRLPOOL, x: 13, y: 13, size: 2, spin: WHIRLPOOL_SPIN.CCW },
    ],
    rocks: [
      { x: 11, y: 11, size: ROCK_SIZE.LARGE },
      { x: 12, y: 12, size: ROCK_SIZE.LARGE },
      { x: 6, y: 9, size: ROCK_SIZE.SMALL },
      { x: 6, y: 15, size: ROCK_SIZE.SMALL },
      { x: 17, y: 9, size: ROCK_SIZE.SMALL },
      { x: 17, y: 15, size: ROCK_SIZE.SMALL },
    ],
  };
}

/** @param {string|number|undefined} seed */
function hashSeed(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return seed >>> 0;
  }
  const seedText = seed ? String(seed) : `${Math.random()}`;
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** @param {string|number|undefined} seed */
function createRng(seed) {
  let state = hashSeed(seed);
  if (state === 0) {
    state = 1;
  }
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/** @param {() => number} rng */
function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** @param {() => number} rng */
function randomChoice(rng, list) {
  return list[randomInt(rng, 0, list.length - 1)];
}

/** @param {number} x @param {number} y */
function tileKey(x, y) {
  return `${x},${y}`;
}

/** Reserve spawn-adjacent tiles so random hazards never block early turns. */
function reserveSpawnTiles(spawnPoints, width, height, buffer) {
  const reserved = new Set();
  for (const spawn of spawnPoints) {
    for (let dx = -buffer; dx <= buffer; dx += 1) {
      for (let dy = -buffer; dy <= buffer; dy += 1) {
        const nx = spawn.x + dx;
        const ny = spawn.y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
          reserved.add(tileKey(nx, ny));
        }
      }
    }
  }
  return reserved;
}

/**
 * Build a randomized hazard/rock layout. Seed is optional but stored for replay.
 * @param {{width:number,height:number,seed?:string|number,spawnPoints:Array<{x:number,y:number}>}} options
 * @returns {MapGrid}
 */
function generateProceduralMap({ width, height, seed, spawnPoints }) {
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
  const rng = createRng(actualSeed);
  const hazards = [];
  const rocks = [];
  const occupied = new Set();
  const reserved = reserveSpawnTiles(
    spawnPoints,
    width,
    height,
    PROCEDURAL_CONFIG.spawnBuffer,
  );
  const directions = FACINGS;

  // Track occupied tiles so hazards do not overlap each other or spawns.
  const isFree = (x, y) => !reserved.has(tileKey(x, y)) && !occupied.has(tileKey(x, y));
  const markTile = (x, y) => occupied.add(tileKey(x, y));

  // Place 2x2 whirlpools with a clear footprint.
  const placeWhirlpool = () => {
    const size = 2;
    const minX = PROCEDURAL_CONFIG.edgePadding;
    const maxX = width - size - PROCEDURAL_CONFIG.edgePadding;
    const minY = PROCEDURAL_CONFIG.edgePadding;
    const maxY = height - size - PROCEDURAL_CONFIG.edgePadding;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const x = randomInt(rng, minX, maxX);
      const y = randomInt(rng, minY, maxY);
      let clear = true;
      for (let dx = 0; dx < size; dx += 1) {
        for (let dy = 0; dy < size; dy += 1) {
          if (!isFree(x + dx, y + dy)) {
            clear = false;
            break;
          }
        }
        if (!clear) {
          break;
        }
      }
      if (!clear) {
        continue;
      }
      const spin = randomChoice(rng, [WHIRLPOOL_SPIN.CW, WHIRLPOOL_SPIN.CCW]);
      hazards.push({ type: HAZARD_TYPE.WHIRLPOOL, x, y, size, spin });
      for (let dx = 0; dx < size; dx += 1) {
        for (let dy = 0; dy < size; dy += 1) {
          markTile(x + dx, y + dy);
        }
      }
      return;
    }
  };

  // Place a single wind tile with a random direction.
  const placeWind = () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const x = randomInt(
        rng,
        PROCEDURAL_CONFIG.edgePadding,
        width - 1 - PROCEDURAL_CONFIG.edgePadding,
      );
      const y = randomInt(
        rng,
        PROCEDURAL_CONFIG.edgePadding,
        height - 1 - PROCEDURAL_CONFIG.edgePadding,
      );
      if (!isFree(x, y)) {
        continue;
      }
      hazards.push({ type: HAZARD_TYPE.WIND, x, y, dir: randomChoice(rng, directions) });
      markTile(x, y);
      return;
    }
  };

  // Place a single rock tile.
  const placeRock = (size) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const x = randomInt(rng, 0, width - 1);
      const y = randomInt(rng, 0, height - 1);
      if (!isFree(x, y)) {
        continue;
      }
      rocks.push({ x, y, size });
      markTile(x, y);
      return;
    }
  };

  // Generate in batches so the layout stays readable.
  for (let i = 0; i < PROCEDURAL_CONFIG.whirlpoolCount; i += 1) {
    placeWhirlpool();
  }
  for (let i = 0; i < PROCEDURAL_CONFIG.windCount; i += 1) {
    placeWind();
  }
  for (let i = 0; i < PROCEDURAL_CONFIG.largeRockCount; i += 1) {
    placeRock(ROCK_SIZE.LARGE);
  }
  for (let i = 0; i < PROCEDURAL_CONFIG.smallRockCount; i += 1) {
    placeRock(ROCK_SIZE.SMALL);
  }

  return {
    width,
    height,
    mode: MAP_MODE.PROCEDURAL,
    seed: actualSeed,
    hazards,
    rocks,
  };
}

/**
 * Create a brand new match state.
 * @param {{p1TypeId?:string,p2TypeId?:string,p1Name?:string,p2Name?:string,mapMode?:string,mapSeed?:string|number}} options
 * @returns {MatchState}
 */
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
      alive: true,
    };
  };

  const p1TypeId = options.p1TypeId || "cutter";
  const p2TypeId = options.p2TypeId || "war_brig";
  const p1Name = options.p1Name || "Captain Tide";
  const p2Name = options.p2Name || "Captain Ember";
  const mapMode = options.mapMode || MAP_MODE.DEFAULT;
  const mapSeed = options.mapSeed;
  const grid =
    mapMode === MAP_MODE.PROCEDURAL
      ? generateProceduralMap({
          width: GRID_SIZE,
          height: GRID_SIZE,
          seed: mapSeed,
          spawnPoints: DEFAULT_SPAWNS,
        })
      : buildDefaultMap();

  return {
    turnNumber: 1,
    phaseIndex: null,
    status: "planning",
    winnerId: null,
    draw: false,
    grid,
    ships: [
      buildShip({
        id: DEFAULT_SPAWNS[0].id,
        name: p1Name,
        x: DEFAULT_SPAWNS[0].x,
        y: DEFAULT_SPAWNS[0].y,
        facing: DEFAULT_SPAWNS[0].facing,
        typeId: p1TypeId,
      }),
      buildShip({
        id: DEFAULT_SPAWNS[1].id,
        name: p2Name,
        x: DEFAULT_SPAWNS[1].x,
        y: DEFAULT_SPAWNS[1].y,
        facing: DEFAULT_SPAWNS[1].facing,
        typeId: p2TypeId,
      }),
    ],
  };
}

/** @template T @param {T} value @returns {T} */
export function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}
